"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

interface UsageHistory {
    id: string;
    type: string;
    status?: string;
    userName: string;
    quantity: number;
    unit?: string;
    borrowTime?: Date;
    withdrawTime?: Date;
    returnTime?: Date;
    createdAt?: Date;
    purpose?: string;
    jobReference?: string;
    [key: string]: any;
}

export default function EquipmentHistoryPage() {
    const params = useParams();
    const equipmentId = params?.id as string;
    const [equipment, setEquipment] = useState<any>(null);
    const [history, setHistory] = useState<UsageHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'borrow' | 'withdraw'

    useEffect(() => {
        if (!equipmentId || !db) return;

        // Listen to equipment data
        const equipmentRef = doc(db as any, "equipment", equipmentId);
        const unsubEquipment = onSnapshot(equipmentRef, (docSnap) => {
            if (docSnap.exists()) {
                setEquipment({ id: docSnap.id, ...docSnap.data() });
            }
        });

        // Fetch usage history
        const fetchHistory = async () => {
            try {
                if (!db) return;
                const q = query(
                    collection(db as any, "equipment-usage"),
                    where("equipmentId", "==", equipmentId)
                );
                const snapshot = await getDocs(q);
                const historyData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        borrowTime: data.borrowTime?.toDate?.() || (data.borrowTime ? new Date(data.borrowTime) : undefined),
                        withdrawTime: data.withdrawTime?.toDate?.() || (data.withdrawTime ? new Date(data.withdrawTime) : undefined),
                        returnTime: data.returnTime?.toDate?.() || (data.returnTime ? new Date(data.returnTime) : undefined),
                        createdAt: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : undefined),
                    } as UsageHistory;
                }).sort((a: any, b: any) => {
                    const dateA = new Date(a.borrowTime || a.withdrawTime || a.createdAt);
                    const dateB = new Date(b.borrowTime || b.withdrawTime || b.createdAt);
                    return dateB.getTime() - dateA.getTime();
                });
                setHistory(historyData);
            } catch (error) {
                console.error("Error fetching history:", error);
            }
            setLoading(false);
        };

        fetchHistory();
        return () => unsubEquipment();
    }, [equipmentId]);

    const formatDateTime = (date: Date | undefined) => {
        if (!date) return '-';
        try {
            return date.toLocaleString('th-TH', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (e) {
            return '-';
        }
    };

    const filteredHistory = activeTab === 'all'
        ? history
        : history.filter(h => h.type === activeTab);

    // Stats
    const borrowCount = history.filter(h => h.type === 'borrow').length;
    const withdrawCount = history.filter(h => h.type === 'withdraw').length;
    const totalWithdrawn = history
        .filter(h => h.type === 'withdraw')
        .reduce((sum, h) => sum + (h.quantity || 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/equipment"
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ประวัติการใช้งาน</h1>
                    <p className="text-gray-500 text-sm">{equipment?.name || 'อุปกรณ์'}</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{borrowCount}</div>
                    <div className="text-sm text-gray-500">ครั้งที่ยืม</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{withdrawCount}</div>
                    <div className="text-sm text-gray-500">ครั้งที่เบิก</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{totalWithdrawn}</div>
                    <div className="text-sm text-gray-500">จำนวนที่เบิกไป</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all'
                        ? 'border-teal-600 text-teal-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    ทั้งหมด ({history.length})
                </button>
                <button
                    onClick={() => setActiveTab('borrow')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'borrow'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    ยืม ({borrowCount})
                </button>
                <button
                    onClick={() => setActiveTab('withdraw')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'withdraw'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    เบิก ({withdrawCount})
                </button>
            </div>

            {/* History List */}
            {filteredHistory.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">ไม่มีประวัติการใช้งาน</h3>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="divide-y divide-gray-100">
                        {filteredHistory.map(item => (
                            <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.type === 'borrow'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {item.type === 'borrow' ? 'ยืม' : 'เบิก'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.status === 'returned'
                                                ? 'bg-green-100 text-green-700'
                                                : item.status === 'active'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {item.status === 'returned' ? 'คืนแล้ว' : item.status === 'active' ? 'กำลังยืม' : 'เบิกแล้ว'}
                                            </span>
                                        </div>
                                        <div className="text-sm font-medium text-gray-900">{item.userName}</div>
                                        <div className="text-xs text-gray-500 space-y-1 mt-1">
                                            <div>จำนวน: {item.quantity} {item.unit}</div>
                                            <div>
                                                {item.type === 'borrow' ? 'ยืมเมื่อ' : 'เบิกเมื่อ'}: {formatDateTime(item.borrowTime || item.withdrawTime)}
                                            </div>
                                            {item.returnTime && (
                                                <div>คืนเมื่อ: {formatDateTime(item.returnTime)}</div>
                                            )}
                                            {item.purpose && (
                                                <div>วัตถุประสงค์: {item.purpose}</div>
                                            )}
                                            {item.jobReference && (
                                                <div>อ้างอิงงาน: {item.jobReference}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
