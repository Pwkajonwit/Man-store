"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, deleteDoc, Timestamp, getDocs, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from 'next/image';
import { useModal } from '@/components/ui/Modal';
import { Repair, RepairStatus } from "@/types/repair";
import { repairCompletedFlex } from '@/lib/lineFlexMessages';
import { Equipment } from "@/types/equipment";

export default function RepairPage() {
    const [loading, setLoading] = useState(true);
    const [repairs, setRepairs] = useState<Repair[]>([]);
    const [damagedEquipment, setDamagedEquipment] = useState<Equipment[]>([]);
    const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
    const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'completed'>('pending');

    // Modal states
    const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
    const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
    const [repairModal, setRepairModal] = useState(false);
    const [editModal, setEditModal] = useState(false);
    const [addModal, setAddModal] = useState(false);
    const [detailModal, setDetailModal] = useState(false);

    // Form states
    const [repairNote, setRepairNote] = useState('');
    const [repairCost, setRepairCost] = useState('');
    const [repairTechnician, setRepairTechnician] = useState('');
    const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterLocation, setFilterLocation] = useState('');

    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        if (!db) return;
        const unsubscribe = onSnapshot(collection(db as any, 'equipment'), (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
            setAllEquipment(items);
            setDamagedEquipment(items.filter(item => item.status === 'damaged'));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db as any, 'repairs'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Repair));
            setRepairs(items);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setRepairNote('');
        setRepairCost('');
        setRepairTechnician('');
        setSelectedEquipmentId('');
        setSelectedItem(null);
        setSelectedRepair(null);
    };

    const startRepair = async (equipment: Equipment) => {
        if (!db) return;
        setSaving(true);
        try {
            await addDoc(collection(db as any, 'repairs'), {
                equipmentId: equipment.id,
                equipmentName: equipment.name,
                equipmentImage: equipment.imageUrl || null,
                status: 'in_progress',
                note: repairNote,
                cost: repairCost ? parseFloat(repairCost) : 0,
                technician: repairTechnician,
                reportedBy: equipment.reportedBy || null,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            await updateDoc(doc(db as any, 'equipment', equipment.id), { status: 'repairing', updatedAt: new Date() });

            // อัพเดท repair-reports status เป็น in_progress
            try {
                const reportsQuery = query(
                    collection(db as any, 'repair-reports'),
                    where('equipmentId', '==', equipment.id)
                );
                const reportsSnap = await getDocs(reportsQuery);
                for (const reportDoc of reportsSnap.docs) {
                    const reportData = reportDoc.data();
                    if (reportData.status === 'pending' || reportData.status === 'approved') {
                        await updateDoc(doc(db as any, 'repair-reports', reportDoc.id), {
                            status: 'in_progress',
                            updatedAt: Timestamp.now()
                        });
                    }
                }
            } catch (updateError) {
                console.error('Failed to update repair-reports:', updateError);
            }

            // ปิด modal ก่อนแสดง alert เพื่อไม่ให้บัง
            resetForm();
            setRepairModal(false);
            setSaving(false);
            await showAlert('เริ่มซ่อมอุปกรณ์แล้ว', 'success');
            return;
        } catch (error: any) {
            await showAlert('เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
        setSaving(false);
    };

    const addNewRepair = async () => {
        if (!db) return;
        if (!selectedEquipmentId) { await showAlert('กรุณาเลือกอุปกรณ์', 'warning'); return; }
        const equipment = allEquipment.find(e => e.id === selectedEquipmentId);
        if (!equipment) { await showAlert('ไม่พบอุปกรณ์', 'error'); return; }
        setSaving(true);
        try {
            await addDoc(collection(db as any, 'repairs'), {
                equipmentId: equipment.id,
                equipmentName: equipment.name,
                equipmentImage: equipment.imageUrl || null,
                status: 'in_progress',
                note: repairNote,
                cost: repairCost ? parseFloat(repairCost) : 0,
                technician: repairTechnician,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            await updateDoc(doc(db as any, 'equipment', equipment.id), { status: 'repairing', updatedAt: new Date() });

            // อัพเดท repair-reports status เป็น in_progress
            try {
                const reportsQuery = query(
                    collection(db as any, 'repair-reports'),
                    where('equipmentId', '==', equipment.id)
                );
                const reportsSnap = await getDocs(reportsQuery);
                for (const reportDoc of reportsSnap.docs) {
                    const reportData = reportDoc.data();
                    if (reportData.status === 'pending' || reportData.status === 'approved') {
                        await updateDoc(doc(db as any, 'repair-reports', reportDoc.id), {
                            status: 'in_progress',
                            updatedAt: Timestamp.now()
                        });
                    }
                }
            } catch (updateError) {
                console.error('Failed to update repair-reports:', updateError);
            }

            // ปิด modal ก่อนแสดง alert เพื่อไม่ให้บัง
            resetForm();
            setAddModal(false);
            setSaving(false);
            await showAlert('เพิ่มรายการซ่อมแล้ว', 'success');
            return;
        } catch (error: any) { await showAlert('เกิดข้อผิดพลาด: ' + error.message, 'error'); }
        setSaving(false);
    };

    const updateRepair = async () => {
        if (!db) return;
        if (!selectedRepair) return;
        setSaving(true);
        try {
            await updateDoc(doc(db as any, 'repairs', selectedRepair.id), {
                note: repairNote,
                cost: repairCost ? parseFloat(repairCost) : 0,
                technician: repairTechnician,
                updatedAt: Timestamp.now(),
            });
            await showAlert('บันทึกการแก้ไขแล้ว', 'success');
            resetForm();
            setEditModal(false);
        } catch (error: any) { await showAlert('เกิดข้อผิดพลาด: ' + error.message, 'error'); }
        setSaving(false);
    };

    const deleteRepair = async (repair: Repair) => {
        if (!db) return;
        if (!(await showConfirm('ลบรายการซ่อมนี้? ข้อมูลจะถูกลบถาวร'))) return;
        try {
            await deleteDoc(doc(db as any, 'repairs', repair.id));
            if (repair.status === 'in_progress') {
                await updateDoc(doc(db as any, 'equipment', repair.equipmentId), { status: 'damaged', updatedAt: new Date() });
            }
            await showAlert('ลบรายการซ่อมแล้ว', 'success');
        } catch (error: any) { await showAlert('เกิดข้อผิดพลาด: ' + error.message, 'error'); }
    };

    const completeRepair = async (repair: Repair) => {
        if (!db) return;
        if (!(await showConfirm('ซ่อมเสร็จแล้วใช่ไหม? อุปกรณ์จะกลับไปสถานะ "พร้อมใช้งาน"'))) return;
        setSaving(true);
        try {
            await updateDoc(doc(db as any, 'repairs', repair.id), {
                status: 'completed',
                completedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            await updateDoc(doc(db as any, 'equipment', repair.equipmentId), { status: 'available', updatedAt: new Date() });

            // อัพเดทสถานะ repair-reports เป็น completed
            try {
                console.log('🔧 [completeRepair] Starting to update repair-reports...');
                console.log('🔧 [completeRepair] repair.equipmentId:', repair.equipmentId);
                console.log('🔧 [completeRepair] repair.equipmentName:', repair.equipmentName);

                // ค้นหา repair-reports ที่มี equipmentId ตรงกัน
                const reportsQuery = query(
                    collection(db as any, 'repair-reports'),
                    where('equipmentId', '==', repair.equipmentId)
                );
                const reportsSnap = await getDocs(reportsQuery);

                console.log('🔧 [completeRepair] Found repair-reports count:', reportsSnap.docs.length);

                if (reportsSnap.docs.length === 0) {
                    console.log('⚠️ [completeRepair] No repair-reports found for this equipmentId');

                    // ลองค้นหาด้วยชื่ออุปกรณ์แทน
                    const allReportsSnap = await getDocs(collection(db as any, 'repair-reports'));
                    console.log('🔧 [completeRepair] Total repair-reports in DB:', allReportsSnap.docs.length);

                    allReportsSnap.docs.forEach(d => {
                        const data = d.data();
                        console.log('🔧 [completeRepair] Report:', d.id, 'equipmentId:', data.equipmentId, 'name:', data.equipmentName, 'status:', data.status);
                    });
                }

                for (const reportDoc of reportsSnap.docs) {
                    const reportData = reportDoc.data();
                    console.log('🔧 [completeRepair] Processing report:', reportDoc.id, 'current status:', reportData.status);

                    // อัพเดททุกรายการที่ยังไม่เสร็จ
                    if (reportData.status !== 'completed') {
                        await updateDoc(doc(db as any, 'repair-reports', reportDoc.id), {
                            status: 'completed',
                            completedAt: Timestamp.now(),
                            updatedAt: Timestamp.now()
                        });
                        console.log('✅ [completeRepair] Updated repair-report to completed:', reportDoc.id);
                    } else {
                        console.log('⏭️ [completeRepair] Skipping already completed report:', reportDoc.id);
                    }
                }
            } catch (updateError) {
                console.error('❌ [completeRepair] Failed to update repair-reports:', updateError);
            }

            // ส่ง LINE แจ้งผู้แจ้งซ่อมว่าซ่อมเสร็จแล้ว (ถ้าเปิดใช้งาน)
            try {
                const notifyDocSnap = await getDoc(doc(db as any, 'settings', 'notifications'));
                const notifySettings = notifyDocSnap.exists() ? notifyDocSnap.data() : {};

                if (notifySettings?.line?.notifyRepairCompleted) {
                    // ค้นหา repair-report เพื่อส่ง LINE notification
                    const reportsQuery = query(
                        collection(db as any, 'repair-reports'),
                        where('equipmentId', '==', repair.equipmentId)
                    );
                    const reportsSnap = await getDocs(reportsQuery);

                    for (const reportDoc of reportsSnap.docs) {
                        const reportData = reportDoc.data();

                        // ส่ง LINE ไปหาผู้แจ้ง (reportedBy = lineId)
                        if (reportData.reportedBy) {
                            const flexMessage = repairCompletedFlex({
                                equipmentName: repair.equipmentName,
                                technician: repair.technician,
                                note: repair.note,
                                cost: repair.cost,
                                completedAt: new Date()
                            });

                            await fetch('/api/send-line-flex', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    to: reportData.reportedBy,
                                    flexMessage
                                })
                            });
                        }
                    }
                }
            } catch (lineError) {
                console.log('LINE notification failed (non-critical):', lineError);
            }

            await showAlert('บันทึกการซ่อมเสร็จแล้ว', 'success');
        } catch (error: any) { await showAlert('เกิดข้อผิดพลาด: ' + error.message, 'error'); }
        setSaving(false);
    };

    const cancelRepair = async (repair: Repair) => {
        if (!db) return;
        if (!(await showConfirm('ยกเลิกการซ่อม? อุปกรณ์จะกลับไปสถานะ "ชำรุด"'))) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'repairs', repair.id), { status: 'cancelled', updatedAt: Timestamp.now() });
            await updateDoc(doc(db, 'equipment', repair.equipmentId), { status: 'damaged', updatedAt: new Date() });
            await showAlert('ยกเลิกการซ่อมแล้ว', 'info');
        } catch (error: any) { await showAlert('เกิดข้อผิดพลาด: ' + error.message, 'error'); }
        setSaving(false);
    };

    const openEditModal = (repair: Repair) => {
        setSelectedRepair(repair);
        setRepairNote(repair.note || '');
        setRepairCost(repair.cost?.toString() || '');
        setRepairTechnician(repair.technician || '');
        setEditModal(true);
    };

    const openDetailModal = (repair: Repair) => {
        setSelectedRepair(repair);
        setDetailModal(true);
    };

    const filteredRepairs = repairs.filter(r => {
        if (activeTab === 'pending') return false;
        if (activeTab === 'in_progress') return r.status === 'in_progress';
        if (activeTab === 'completed') return r.status === 'completed' || r.status === 'cancelled';
        return true;
    });

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'in_progress': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">กำลังซ่อม</span>;
            case 'completed': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">ซ่อมเสร็จ</span>;
            case 'cancelled': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">ยกเลิก</span>;
            default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{status}</span>;
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div></div>;

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">ระบบซ่อมอุปกรณ์</h1>
                        <p className="text-sm text-gray-500">จัดการอุปกรณ์ที่ชำรุดและติดตามสถานะการซ่อม</p>
                    </div>
                </div>
                <button
                    onClick={() => { resetForm(); setAddModal(true); }}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    เพิ่มงานซ่อม
                </button>
            </div>
            {/* Status Filter Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {/* รอซ่อม */}
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`relative p-4 rounded-xl border-2 transition-all ${activeTab === 'pending'
                        ? 'bg-red-50 border-red-400 shadow-md'
                        : 'bg-white border-gray-100 hover:border-red-200 hover:bg-red-50/50'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeTab === 'pending' ? 'bg-red-200' : 'bg-red-100'
                            }`}>
                            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <div className={`text-2xl font-bold ${activeTab === 'pending' ? 'text-red-700' : 'text-red-600'}`}>
                                {damagedEquipment.length}
                            </div>
                            <div className="text-xs text-red-600 font-medium">รอซ่อม</div>
                        </div>
                    </div>
                    {activeTab === 'pending' && (
                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-red-500 rounded-full"></div>
                    )}
                </button>

                {/* กำลังซ่อม */}
                <button
                    onClick={() => setActiveTab('in_progress')}
                    className={`relative p-4 rounded-xl border-2 transition-all ${activeTab === 'in_progress'
                        ? 'bg-yellow-50 border-yellow-400 shadow-md'
                        : 'bg-white border-gray-100 hover:border-yellow-200 hover:bg-yellow-50/50'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeTab === 'in_progress' ? 'bg-yellow-200' : 'bg-yellow-100'
                            }`}>
                            <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <div className={`text-2xl font-bold ${activeTab === 'in_progress' ? 'text-yellow-700' : 'text-yellow-600'}`}>
                                {repairs.filter(r => r.status === 'in_progress').length}
                            </div>
                            <div className="text-xs text-yellow-600 font-medium">กำลังซ่อม</div>
                        </div>
                    </div>
                    {activeTab === 'in_progress' && (
                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-yellow-500 rounded-full"></div>
                    )}
                </button>

                {/* ประวัติ/ซ่อมเสร็จ */}
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`relative p-4 rounded-xl border-2 transition-all ${activeTab === 'completed'
                        ? 'bg-green-50 border-green-400 shadow-md'
                        : 'bg-white border-gray-100 hover:border-green-200 hover:bg-green-50/50'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeTab === 'completed' ? 'bg-green-200' : 'bg-green-100'
                            }`}>
                            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <div className={`text-2xl font-bold ${activeTab === 'completed' ? 'text-green-700' : 'text-green-600'}`}>
                                {repairs.filter(r => r.status === 'completed' || r.status === 'cancelled').length}
                            </div>
                            <div className="text-xs text-green-600 font-medium">ซ่อมเสร็จ</div>
                        </div>
                    </div>
                    {activeTab === 'completed' && (
                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-green-500 rounded-full"></div>
                    )}
                </button>
            </div>
            {/* Content - รอซ่อม */}
            {activeTab === 'pending' && (
                <div className="space-y-3">
                    {damagedEquipment.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl">
                            <svg className="w-12 h-12 mx-auto mb-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-gray-500">ไม่มีอุปกรณ์ที่รอซ่อม</div>
                        </div>
                    ) : (
                        damagedEquipment.map(item => (
                            <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
                                {item.imageUrl ? (
                                    <Image src={item.imageUrl} alt={item.name} width={60} height={60} className="rounded-lg object-cover" />
                                ) : (
                                    <div className="w-[60px] h-[60px] bg-gray-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                        </svg>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="font-semibold text-gray-900">{item.name}</div>
                                    <div className="text-sm text-gray-500">{item.category || 'ไม่ระบุหมวดหมู่'}</div>
                                    <div className="text-xs text-red-600 mt-1">สถานะ: ชำรุด</div>
                                </div>
                                <button
                                    onClick={() => { resetForm(); setSelectedItem(item); setRepairModal(true); }}
                                    disabled={saving}
                                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                                >
                                    เริ่มซ่อม
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Content - กำลังซ่อม */}
            {activeTab === 'in_progress' && (
                <div className="space-y-3">
                    {filteredRepairs.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl">
                            <svg className="w-12 h-12 mx-auto mb-3 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                            </svg>
                            <div className="text-gray-500">ไม่มีอุปกรณ์ที่กำลังซ่อม</div>
                        </div>
                    ) : (
                        filteredRepairs.map(repair => (
                            <div key={repair.id} className="bg-white rounded-xl p-4 shadow-sm border border-yellow-200">
                                <div className="flex items-center gap-4">
                                    {repair.equipmentImage ? (
                                        <Image src={repair.equipmentImage} alt={repair.equipmentName} width={60} height={60} className="rounded-lg object-cover" />
                                    ) : (
                                        <div className="w-[60px] h-[60px] bg-yellow-50 rounded-lg flex items-center justify-center">
                                            <svg className="w-7 h-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900">{repair.equipmentName}</div>
                                        {repair.note && <div className="text-sm text-gray-500">{repair.note}</div>}
                                        <div className="flex gap-4 text-xs text-gray-500 mt-1">
                                            <span>เริ่มซ่อม: {formatDate(repair.createdAt)}</span>
                                            {repair.technician && <span>ช่าง: {repair.technician}</span>}
                                            {repair.cost && repair.cost > 0 && <span>ค่าใช้จ่าย: ฿{repair.cost.toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openDetailModal(repair)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="ดูรายละเอียด">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                        <button onClick={() => openEditModal(repair)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="แก้ไข">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button onClick={() => deleteRepair(repair)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="ลบ">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                                    <button onClick={() => completeRepair(repair)} disabled={saving} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                                        ✓ ซ่อมเสร็จ
                                    </button>
                                    <button onClick={() => cancelRepair(repair)} disabled={saving} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50">
                                        ยกเลิก
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Content - ประวัติ */}
            {activeTab === 'completed' && (
                <div className="space-y-3">
                    {filteredRepairs.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl">
                            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="text-gray-500">ยังไม่มีประวัติการซ่อม</div>
                        </div>
                    ) : (
                        filteredRepairs.map(repair => (
                            <div key={repair.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-4">
                                    {repair.equipmentImage ? (
                                        <Image src={repair.equipmentImage} alt={repair.equipmentName} width={60} height={60} className="rounded-lg object-cover" />
                                    ) : (
                                        <div className="w-[60px] h-[60px] bg-gray-100 rounded-lg flex items-center justify-center">
                                            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900">{repair.equipmentName}</div>
                                        {repair.note && <div className="text-sm text-gray-500">{repair.note}</div>}
                                        <div className="flex gap-4 text-xs text-gray-400 mt-1">
                                            <span>{formatDate(repair.completedAt || repair.updatedAt)}</span>
                                            {repair.technician && <span>ช่าง: {repair.technician}</span>}
                                            {repair.cost && repair.cost > 0 && <span>ค่าใช้จ่าย: ฿{repair.cost.toLocaleString()}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(repair.status)}
                                        <button onClick={() => openDetailModal(repair)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="ดูรายละเอียด">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                        <button onClick={() => deleteRepair(repair)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="ลบ">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
            {/* Modal - เริ่มซ่อม */}
            {repairModal && selectedItem && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setRepairModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 z-10">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">เริ่มซ่อมอุปกรณ์</h3>

                        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                            {selectedItem.imageUrl ? (
                                <Image src={selectedItem.imageUrl} alt={selectedItem.name} width={50} height={50} className="rounded-lg object-cover" />
                            ) : (
                                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            )}
                            <div>
                                <div className="font-medium">{selectedItem.name}</div>
                                <div className="text-sm text-gray-500">{selectedItem.category}</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ / อาการ</label>
                                <textarea value={repairNote} onChange={(e) => setRepairNote(e.target.value)} placeholder="ระบุปัญหาหรือรายละเอียดการซ่อม..." rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ช่างผู้รับผิดชอบ</label>
                                <input type="text" value={repairTechnician} onChange={(e) => setRepairTechnician(e.target.value)} placeholder="ชื่อช่าง" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ค่าใช้จ่ายโดยประมาณ (บาท)</label>
                                <input type="number" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setRepairModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">ยกเลิก</button>
                            <button onClick={() => startRepair(selectedItem)} disabled={saving} className="flex-1 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50">
                                {saving ? 'กำลังบันทึก...' : 'เริ่มซ่อม'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal - เพิ่มงานซ่อม */}
            {addModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in flex flex-col">
                        <div className="p-6 pb-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">เพิ่มงานซ่อมใหม่</h3>
                            <p className="text-sm text-gray-500">เลือกอุปกรณ์ที่ต้องการส่งซ่อม</p>
                        </div>

                        {/* Search & Filters */}
                        <div className="p-4 bg-gray-50 border-b border-gray-100">
                            <div className="relative mb-3">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ค้นหาอุปกรณ์..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="">ทุกหมวดหมู่</option>
                                    {[...new Set(allEquipment.map(e => e.category).filter(Boolean))].map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <select
                                    value={filterLocation}
                                    onChange={(e) => setFilterLocation(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="">ทุกสถานที่</option>
                                    {[...new Set(allEquipment.map(e => e.location).filter(Boolean))].map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Equipment List */}
                        <div className="flex-1 overflow-y-auto p-4 max-h-[300px]">
                            <div className="space-y-2">
                                {allEquipment
                                    .filter(e => e.status !== 'repairing')
                                    .filter(e => !searchQuery || e.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .filter(e => !filterCategory || e.category === filterCategory)
                                    .filter(e => !filterLocation || e.location === filterLocation)
                                    .map(eq => (
                                        <div
                                            key={eq.id}
                                            onClick={() => setSelectedEquipmentId(eq.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedEquipmentId === eq.id
                                                ? 'bg-teal-50 border-2 border-teal-500'
                                                : 'bg-white border border-gray-100 hover:border-teal-300'
                                                }`}
                                        >
                                            {eq.imageUrl ? (
                                                <Image src={eq.imageUrl} alt={eq.name} width={40} height={40} className="rounded-lg object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                                    </svg>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 truncate">{eq.name}</div>
                                                <div className="text-xs text-gray-500 truncate">{eq.category} • {eq.location}</div>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs ${eq.status === 'damaged' ? 'bg-red-100 text-red-700' :
                                                eq.status === 'available' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {eq.status === 'damaged' ? 'ชำรุด' : eq.status === 'available' ? 'พร้อมใช้' : eq.status}
                                            </span>
                                            {selectedEquipmentId === eq.id && (
                                                <svg className="w-5 h-5 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    ))
                                }
                                {allEquipment.filter(e => e.status !== 'repairing').filter(e => !searchQuery || e.name?.toLowerCase().includes(searchQuery.toLowerCase())).filter(e => !filterCategory || e.category === filterCategory).filter(e => !filterLocation || e.location === filterLocation).length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        ไม่พบอุปกรณ์ที่ตรงกับการค้นหา
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Repair Details */}
                        {selectedEquipmentId && (
                            <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3">
                                <div className="text-sm font-medium text-gray-700">รายละเอียดการซ่อม</div>
                                <textarea
                                    value={repairNote}
                                    onChange={(e) => setRepairNote(e.target.value)}
                                    placeholder="ระบุปัญหาหรือรายละเอียดการซ่อม..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        value={repairTechnician}
                                        onChange={(e) => setRepairTechnician(e.target.value)}
                                        placeholder="ช่างผู้รับผิดชอบ"
                                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                    <input
                                        type="number"
                                        value={repairCost}
                                        onChange={(e) => setRepairCost(e.target.value)}
                                        placeholder="ค่าใช้จ่าย (บาท)"
                                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="p-4 border-t border-gray-100 flex gap-3">
                            <button onClick={() => { setAddModal(false); setSearchQuery(''); setFilterCategory(''); setFilterLocation(''); }} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                                ยกเลิก
                            </button>
                            <button onClick={addNewRepair} disabled={saving || !selectedEquipmentId} className="flex-1 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50">
                                {saving ? 'กำลังบันทึก...' : 'เพิ่มงานซ่อม'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editModal && selectedRepair && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setEditModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 z-10">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">แก้ไขรายการซ่อม</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                                <textarea value={repairNote} onChange={(e) => setRepairNote(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ช่าง</label>
                                <input type="text" value={repairTechnician} onChange={(e) => setRepairTechnician(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ค่าใช้จ่าย</label>
                                <input type="number" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg">ยกเลิก</button>
                            <button onClick={updateRepair} className="flex-1 py-2 bg-blue-600 text-white rounded-lg">บันทึก</button>
                        </div>
                    </div>
                </div>
            )}

            {detailModal && selectedRepair && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setDetailModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">รายละเอียดงานซ่อม</h3>
                            <button onClick={() => setDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                                {selectedRepair.equipmentImage ? (
                                    <Image src={selectedRepair.equipmentImage} alt={selectedRepair.equipmentName} width={80} height={80} className="rounded-lg object-cover" />
                                ) : (
                                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63" />
                                        </svg>
                                    </div>
                                )}
                                <div>
                                    <div className="font-bold text-lg text-gray-900">{selectedRepair.equipmentName}</div>
                                    <div className="text-sm text-gray-500 mt-1">{selectedRepair.note || 'ไม่มีระบุอาการ'}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-white border border-gray-100 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">วันที่แจ้งซ่อม</div>
                                    <div className="font-medium">{formatDate(selectedRepair.createdAt)}</div>
                                </div>
                                <div className="p-3 bg-white border border-gray-100 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">สถานะ</div>
                                    <div>{getStatusBadge(selectedRepair.status)}</div>
                                </div>
                                <div className="p-3 bg-white border border-gray-100 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">ช่างผู้รับผิดชอบ</div>
                                    <div className="font-medium">{selectedRepair.technician || '-'}</div>
                                </div>
                                <div className="p-3 bg-white border border-gray-100 rounded-lg">
                                    <div className="text-xs text-gray-500 mb-1">ค่าใช้จ่าย</div>
                                    <div className="font-medium">{selectedRepair.cost ? `฿${selectedRepair.cost.toLocaleString()}` : '-'}</div>
                                </div>
                            </div>

                            {selectedRepair.completedAt && (
                                <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                                    <div className="text-xs text-green-600 mb-1">ซ่อมเสร็จเมื่อ</div>
                                    <div className="font-medium text-green-700">{formatDate(selectedRepair.completedAt)}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
