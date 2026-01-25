"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import MainHeader from '@/components/main/MainHeader';
import Image from 'next/image';

const ITEMS_PER_PAGE = 10;

interface UsageHistory {
    id: string;
    equipmentName: string;
    equipmentImageUrl?: string;
    quantity: number;
    unit?: string;
    borrowTime?: any;
    withdrawTime?: any;
    returnTime?: any;
    type?: 'borrow' | 'withdraw';
    status?: string;
    [key: string]: any;
}

export default function EquipmentHistoryPage() {
    const { user, userProfile } = useAuth();
    const [history, setHistory] = useState<UsageHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');
    const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

    useEffect(() => {
        if (!user && !userProfile) return;
        if (!db) return;

        const fetchHistory = async () => {
            const userId = userProfile?.lineId || user?.uid;
            if (!userId) return;

            try {
                const q = query(collection(db as any, "equipment-usage"), where("userId", "==", userId));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        ...d,
                        borrowTime: d.borrowTime?.toDate?.() || d.borrowTime,
                        withdrawTime: d.withdrawTime?.toDate?.() || d.withdrawTime,
                        returnTime: d.returnTime?.toDate?.() || d.returnTime,
                    } as UsageHistory;
                }).sort((a, b) => {
                    const dateA = new Date(a.borrowTime || a.withdrawTime || 0).getTime();
                    const dateB = new Date(b.borrowTime || b.withdrawTime || 0).getTime();
                    return dateB - dateA;
                });
                setHistory(data);
            } catch (error) {
                console.error("Error:", error);
            }
            setLoading(false);
        };

        fetchHistory();
    }, [user, userProfile]);

    const formatDate = (date: any) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
    };

    const filtered = filterType === 'all' ? history : history.filter(h => h.type === filterType);
    const displayed = filtered.slice(0, displayCount);
    const hasMore = displayCount < filtered.length;
    const borrowCount = history.filter(h => h.type === 'borrow').length;
    const withdrawCount = history.filter(h => h.type === 'withdraw').length;

    const loadMore = () => setDisplayCount(prev => prev + ITEMS_PER_PAGE);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <MainHeader userProfile={userProfile} activeTab="history" setActiveTab={() => { }} />
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <MainHeader userProfile={userProfile} activeTab="history" setActiveTab={() => { }} />

            <div className="px-4 -mt-16">
                {/* Filter Tabs */}
                <div className="bg-white rounded-2xl shadow-sm p-3 mb-3">
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setFilterType('all'); setDisplayCount(ITEMS_PER_PAGE); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-teal-600 text-white' : 'text-gray-600'}`}
                        >
                            ทั้งหมด ({history.length})
                        </button>
                        <button
                            onClick={() => { setFilterType('borrow'); setDisplayCount(ITEMS_PER_PAGE); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === 'borrow' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                        >
                            ยืม ({borrowCount})
                        </button>
                        <button
                            onClick={() => { setFilterType('withdraw'); setDisplayCount(ITEMS_PER_PAGE); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === 'withdraw' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
                        >
                            เบิก ({withdrawCount})
                        </button>
                    </div>
                </div>

                {/* History List */}
                {filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-500">ยังไม่มีประวัติ</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {displayed.map(item => (
                                <div key={item.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                                    {/* Image */}
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                                        {item.equipmentImageUrl ? (
                                            <Image src={item.equipmentImageUrl} alt="" width={40} height={40} className="object-cover w-full h-full" unoptimized />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-800 text-sm truncate">{item.equipmentName}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>{item.quantity} {item.unit}</span>
                                            <span>•</span>
                                            <span>{formatDate(item.borrowTime || item.withdrawTime)}</span>
                                        </div>
                                    </div>

                                    {/* Status Badges */}
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.type === 'borrow' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            {item.type === 'borrow' ? 'ยืม' : 'เบิก'}
                                        </span>
                                        {/* Status Badge - Only show for borrow type since withdraw doesn't have return concept */}
                                        {item.type === 'borrow' && (
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.status === 'returned'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {item.status === 'returned' ? 'คืนแล้ว' : 'ยังไม่คืน'}
                                            </span>
                                        )}
                                        {item.type === 'withdraw' && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                                เบิกแล้ว
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Load More */}
                        {hasMore && (
                            <button
                                onClick={loadMore}
                                className="w-full mt-4 py-3 bg-white rounded-xl shadow-sm text-sm font-medium text-teal-600 hover:bg-teal-50 transition-colors"
                            >
                                ดูเพิ่มเติม ({filtered.length - displayCount} รายการ)
                            </button>
                        )}

                        {/* Count Info */}
                        <p className="text-center text-xs text-gray-400 mt-3">
                            แสดง {displayed.length} จาก {filtered.length} รายการ
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
