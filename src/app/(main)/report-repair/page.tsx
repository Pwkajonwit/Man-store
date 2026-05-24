"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, Timestamp, orderBy, getDoc } from "firebase/firestore";
import MainHeader from '@/components/main/MainHeader';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useModal } from '@/components/ui/Modal';
import { useAppSettings } from '@/context/AppSettingsContext';

const QRScannerModal = dynamic(() => import('@/components/ui/QRScannerModal'), {
    ssr: false,
    loading: () => null,
});

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// Memoized Equipment Item Component
interface EquipmentItemProps {
    eq: Equipment;
    onSelect: () => void;
}

const EquipmentItem = memo(function EquipmentItem({ eq, onSelect }: EquipmentItemProps) {
    return (
        <div
            onClick={onSelect}
            className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
        >
            {eq.imageUrl ? (
                <Image src={eq.imageUrl} alt={eq.name} width={48} height={48} className="rounded-lg object-cover" />
            ) : (
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                    </svg>
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">{eq.name}</div>
                <div className="text-xs text-gray-500">{eq.category || 'ไม่ระบุหมวดหมู่'}</div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </div>
    );
});

interface Equipment {
    id: string;
    name: string;
    imageUrl?: string;
    category?: string;
    status: string;
    [key: string]: any;
}

interface RepairReport {
    id: string;
    equipmentId: string;
    equipmentName: string;
    equipmentImage?: string;
    category?: string;
    problemNote: string;
    quantity?: number;
    status: 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'write_off';
    reportedBy: string;
    reporterName: string;
    createdAt: any;
    [key: string]: any;
}

export default function ReportRepairPage() {
    const { user, userProfile } = useAuth();
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [myReports, setMyReports] = useState<RepairReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('report'); // 'report' | 'my-reports'
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
    const [reportModal, setReportModal] = useState(false);
    const [problemNote, setProblemNote] = useState('');
    const [repairQuantity, setRepairQuantity] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [displayCount, setDisplayCount] = useState(20); // Load More
    const { showAlert } = useModal();
    const { lineSettings } = useAppSettings();
    const userChatMessageEnabled = lineSettings.userChatMessage;

    // Debounce search query
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Handle QR Scan
    const handleScan = (decodedText: string) => {
        try {
            // Try to parse as JSON first (from our generator)
            const data = JSON.parse(decodedText);
            if (data.id) {
                // Find matching equipment
                const item = equipment.find(e => e.id === data.id);
                if (item) {
                    setSearchQuery(item.name);
                } else if (data.code) {
                    setSearchQuery(data.code);
                } else if (data.name) {
                    setSearchQuery(data.name);
                }
            }
        } catch (e) {
            // Not JSON, assume plain text (name or code)
            setSearchQuery(decodedText);
        }
        setShowScanner(false);
    };

    // โหลดอุปกรณ์ที่สถานะ available หรือ in_use (เฉพาะ borrowable - ไม่รวมวัสดุสิ้นเปลือง)
    useEffect(() => {
        if (!db) return;
        const unsubscribe = onSnapshot(collection(db as any, 'equipment'), (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Equipment)).filter(item =>
                (item.status === 'available' || item.status === 'in_use') &&
                item.type === 'borrowable' // เฉพาะอุปกรณ์ยืม-คืน
            );
            setEquipment(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // โหลดรายการแจ้งซ่อมของผู้ใช้
    useEffect(() => {
        if (!user && !userProfile) return;
        if (!db) return;

        const userId = userProfile?.lineId || user?.uid;
        if (!userId) return;

        const q = query(
            collection(db as any, 'repair-reports'),
            where('reportedBy', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as RepairReport));
            setMyReports(items);
        });

        return () => unsubscribe();
    }, [user, userProfile]);

    // Reset display count when filter changes
    useEffect(() => {
        setDisplayCount(20);
    }, [debouncedSearch, filterCategory]);

    // Memoized categories
    const categories = useMemo(() => {
        return [...new Set(equipment.map(e => e.category).filter(Boolean))];
    }, [equipment]);

    // Memoized filtered equipment
    const filteredEquipment = useMemo(() => {
        return equipment
            .filter(e => !debouncedSearch || e.name?.toLowerCase().includes(debouncedSearch.toLowerCase()))
            .filter(e => !filterCategory || e.category === filterCategory);
    }, [equipment, debouncedSearch, filterCategory]);

    // Displayed equipment (with Load More)
    const displayedEquipment = useMemo(() => {
        return filteredEquipment.slice(0, displayCount);
    }, [filteredEquipment, displayCount]);

    const hasMore = displayCount < filteredEquipment.length;

    // Handle select equipment (memoized)
    const handleSelectEquipment = useCallback((eq: Equipment) => {
        setSelectedEquipment(eq);
        setProblemNote('');
        setReportModal(true);
    }, []);

    // ส่งแจ้งซ่อม
    const submitReport = async () => {
        if (!selectedEquipment) return;
        if (!db) return;
        if (!problemNote.trim()) {
            showAlert('กรุณาระบุปัญหาหรืออาการที่พบ', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            // ตรวจสอบจำนวนที่ซ่อมไม่เกินจำนวนที่มี
            const maxQty = selectedEquipment.availableQuantity || selectedEquipment.quantity || 1;
            const qty = Math.min(repairQuantity, maxQty);

            const reportData = {
                equipmentId: selectedEquipment.id,
                equipmentName: selectedEquipment.name,
                equipmentImage: selectedEquipment.imageUrl || null,
                category: selectedEquipment.category || '',
                problemNote: problemNote.trim(),
                quantity: qty,
                status: 'pending', // pending, approved, rejected
                reportedBy: userProfile?.lineId || user?.uid,
                reporterName: userProfile?.name || 'ไม่ทราบชื่อ',
                createdAt: Timestamp.now(),
            };

            // สร้างรายการแจ้งซ่อม
            await addDoc(collection(db as any, 'repair-reports'), reportData);

            // อัพเดทสถานะอุปกรณ์เป็น damaged และลด availableQuantity ตามจำนวนที่ซ่อม
            const equipmentRef = doc(db as any, 'equipment', selectedEquipment.id);
            const equipmentSnap = await getDoc(equipmentRef);
            const equipmentData = equipmentSnap.data();
            const currentAvailable = equipmentData?.availableQuantity || equipmentData?.quantity || 1;
            const newAvailable = Math.max(0, currentAvailable - qty);

            await updateDoc(equipmentRef, {
                status: 'damaged',
                availableQuantity: newAvailable,
                updatedAt: new Date()
            });

            // ส่ง LINE Message ถ้าเปิดใช้งาน (ส่งจากผู้ใช้ ไม่ใช่จาก Bot)
            try {
                const notifyDocSnap = await getDoc(doc(db as any, 'settings', 'notifications'));
                const notifySettings = notifyDocSnap.exists() ? notifyDocSnap.data() : {};

                if (notifySettings.line?.notifyRepairReport && userChatMessageEnabled) {
                    const liff = (await import('@line/liff')).default;
                    if (liff.isInClient()) {
                        const now = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                        await liff.sendMessages([{
                        type: 'flex',
                        altText: `แจ้งซ่อม: ${selectedEquipment.name}`,
                        contents: {
                            type: 'bubble',
                            size: 'kilo',
                            body: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    { type: 'text', text: '🔧 แจ้งซ่อมอุปกรณ์', weight: 'bold', size: 'md', color: '#DC2626' },
                                    { type: 'separator', margin: 'lg' },
                                    {
                                        type: 'box',
                                        layout: 'horizontal',
                                        contents: [
                                            { type: 'text', text: selectedEquipment.name, size: 'sm', color: '#333333', flex: 3, wrap: true },
                                            { type: 'text', text: 'ชำรุด', size: 'sm', color: '#DC2626', align: 'end', flex: 1 }
                                        ],
                                        margin: 'lg'
                                    },
                                    {
                                        type: 'text',
                                        text: problemNote.trim(),
                                        size: 'xs',
                                        color: '#888888',
                                        margin: 'md',
                                        wrap: true
                                    },
                                    { type: 'separator', margin: 'lg' },
                                    { type: 'text', text: now, size: 'xs', color: '#AAAAAA', margin: 'lg', align: 'end' }
                                ],
                                paddingAll: '16px'
                            }
                        }
                        } as any]);
                    }
                }
            } catch (lineError) {
                console.log('LINE message not sent:', lineError);
            }

            showAlert('แจ้งซ่อมสำเร็จ', 'success');
            setReportModal(false);
            setProblemNote('');
            setRepairQuantity(1);
            setSelectedEquipment(null);
            setActiveView('my-reports');
        } catch (error: any) {
            console.error('Error submitting report:', error);
            showAlert('เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
        setSubmitting(false);
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">รอดำเนินการ</span>;
            case 'approved':
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">อนุมัติแล้ว</span>;
            case 'rejected':
                return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">ไม่อนุมัติ</span>;
            case 'in_progress':
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">กำลังซ่อม</span>;
            case 'completed':
                return <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">ซ่อมเสร็จแล้ว</span>;
            case 'write_off':
                return <span className="px-2 py-1 bg-gray-600 text-white rounded-full text-xs font-medium">ซ่อมไม่ได้/ตัดออก</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{status}</span>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <MainHeader userProfile={userProfile} activeTab="report-repair" setActiveTab={() => { }} />
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <MainHeader userProfile={userProfile} activeTab="report-repair" setActiveTab={() => { }} />

            <div className="px-4 -mt-16">
                {/* Toggle View */}
                <div className="bg-white rounded-2xl shadow-sm p-2 mb-4 flex gap-2">
                    <button
                        onClick={() => setActiveView('report')}
                        className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${activeView === 'report'
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        แจ้งซ่อม
                    </button>
                    <button
                        onClick={() => setActiveView('my-reports')}
                        className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${activeView === 'my-reports'
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        รายการของฉัน ({myReports.length})
                    </button>
                </div>

                {/* Report View - เลือกอุปกรณ์แจ้งซ่อม */}
                {activeView === 'report' && (
                    <div className="space-y-4">
                        {/* Search & Filter */}
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="relative mb-3">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ค้นหาอุปกรณ์..."
                                    className="w-full pl-10 pr-14 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-teal-600 text-white hover:bg-teal-700 transition-colors p-2 rounded-lg shadow-sm"
                                    title="สแกน QR Code"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                                    </svg>
                                </button>
                            </div>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="">ทุกหมวดหมู่</option>
                                {categories.map(cat => (
                                    <option key={cat!} value={cat}>{cat}</option>
                                ))}
                            </select>
                            {/* Results count */}
                            <p className="text-xs text-gray-500 mt-2">
                                {debouncedSearch || filterCategory
                                    ? `พบ ${filteredEquipment.length} รายการ`
                                    : `ทั้งหมด ${equipment.length} รายการ`}
                            </p>
                        </div>

                        {/* Equipment List */}
                        <div className="space-y-2">
                            {filteredEquipment.length === 0 ? (
                                <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <p className="text-gray-500">ไม่พบอุปกรณ์</p>
                                </div>
                            ) : (
                                <>
                                    {displayedEquipment.map(eq => (
                                        <EquipmentItem
                                            key={eq.id}
                                            eq={eq}
                                            onSelect={() => handleSelectEquipment(eq)}
                                        />
                                    ))}

                                    {/* Load More Button */}
                                    {hasMore && (
                                        <button
                                            onClick={() => setDisplayCount(prev => prev + 20)}
                                            className="w-full py-3 bg-white rounded-xl shadow-sm text-sm font-medium text-teal-600 hover:bg-teal-50 transition-colors"
                                        >
                                            ดูเพิ่มเติม ({filteredEquipment.length - displayCount} รายการ)
                                        </button>
                                    )}

                                    {/* Show count */}
                                    <p className="text-center text-xs text-gray-400 mt-2">
                                        แสดง {displayedEquipment.length} จาก {filteredEquipment.length} รายการ
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* My Reports View */}
                {activeView === 'my-reports' && (
                    <div className="space-y-3">
                        {myReports.length === 0 ? (
                            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                                <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-gray-500 mb-4">ยังไม่มีรายการแจ้งซ่อม</p>
                                <button
                                    onClick={() => setActiveView('report')}
                                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                                >
                                    แจ้งซ่อมอุปกรณ์
                                </button>
                            </div>
                        ) : (
                            myReports.map(report => (
                                <div key={report.id} className="bg-white rounded-xl p-4 shadow-sm">
                                    <div className="flex items-start gap-3">
                                        {report.equipmentImage ? (
                                            <Image src={report.equipmentImage} alt={report.equipmentName} width={48} height={48} className="rounded-lg object-cover" />
                                        ) : (
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                                </svg>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900 text-sm">{report.equipmentName}</span>
                                                    {report.quantity && report.quantity > 1 && (
                                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                                                            {report.quantity} ชิ้น
                                                        </span>
                                                    )}
                                                </div>
                                                {getStatusBadge(report.status)}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">{report.category}</div>
                                            <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                                                <div className="text-xs text-gray-600">{report.problemNote}</div>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-2">{formatDate(report.createdAt)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Report Modal */}
            {reportModal && selectedEquipment && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setReportModal(false)} />
                    <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-hidden animate-slide-up">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">แจ้งซ่อมอุปกรณ์</h3>
                        </div>

                        <div className="p-5">
                            {/* Equipment Info */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
                                {selectedEquipment.imageUrl ? (
                                    <Image src={selectedEquipment.imageUrl} alt={selectedEquipment.name} width={50} height={50} className="rounded-lg object-cover" />
                                ) : (
                                    <div className="w-[50px] h-[50px] bg-gray-200 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                        </svg>
                                    </div>
                                )}
                                <div>
                                    <div className="font-medium text-gray-900">{selectedEquipment.name}</div>
                                    <div className="text-sm text-gray-500">{selectedEquipment.category}</div>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">จำนวนที่ต้องการซ่อม</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRepairQuantity(Math.max(1, repairQuantity - 1))}
                                        className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200"
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        value={repairQuantity}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 1;
                                            const max = selectedEquipment.availableQuantity || selectedEquipment.quantity || 1;
                                            setRepairQuantity(Math.min(Math.max(1, val), max));
                                        }}
                                        min={1}
                                        max={selectedEquipment.availableQuantity || selectedEquipment.quantity || 1}
                                        className="w-16 h-10 text-center border border-gray-200 rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const max = selectedEquipment.availableQuantity || selectedEquipment.quantity || 1;
                                            setRepairQuantity(Math.min(repairQuantity + 1, max));
                                        }}
                                        className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200"
                                    >
                                        +
                                    </button>
                                    <span className="text-sm text-gray-500">
                                        / {selectedEquipment.availableQuantity || selectedEquipment.quantity || 0} {selectedEquipment.unit || 'ชิ้น'}
                                    </span>
                                </div>
                            </div>

                            {/* Problem Note */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">ปัญหา / อาการที่พบ *</label>
                                <textarea
                                    value={problemNote}
                                    onChange={(e) => setProblemNote(e.target.value)}
                                    placeholder="เช่น เปิดไม่ติด, มีเสียงดังผิดปกติ, หน้าจอไม่แสดงผล..."
                                    rows={4}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setReportModal(false)}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={submitReport}
                                disabled={submitting || !problemNote.trim()}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {submitting ? 'กำลังส่ง...' : 'แจ้งซ่อม'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Scanner Modal */}
            {showScanner && (
                <QRScannerModal
                    onClose={() => setShowScanner(false)}
                    onScan={handleScan}
                />
            )}

            <style jsx>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
