"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

const ITEMS_PER_PAGE = 50; // โหลดครั้งละ 50 รายการ

interface EquipmentUsageHistory {
    id: string;
    type: 'borrow' | 'withdraw';
    status?: string;
    equipmentName?: string;
    equipmentCategory?: string;
    equipmentLocation?: string;
    userName?: string;
    quantity?: number;
    unit?: string;
    borrowTime?: Date;
    withdrawTime?: Date;
    returnTime?: Date;
    [key: string]: any;
}

export default function EquipmentHistoryAdminPage() {
    const [history, setHistory] = useState<EquipmentUsageHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'borrow' | 'withdraw'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [displayCount, setDisplayCount] = useState(20);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMoreData, setHasMoreData] = useState(true);

    const fetchHistory = async (loadMore = false) => {
        try {
            if (!db) return;
            if (loadMore) setLoadingMore(true);

            let q = query(
                collection(db as any, "equipment-usage"),
                orderBy("borrowTime", "desc"),
                limit(ITEMS_PER_PAGE)
            );

            if (loadMore && lastDoc) {
                q = query(
                    collection(db as any, "equipment-usage"),
                    orderBy("borrowTime", "desc"),
                    startAfter(lastDoc),
                    limit(ITEMS_PER_PAGE)
                );
            }

            const snapshot = await getDocs(q);
            const data: EquipmentUsageHistory[] = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    borrowTime: d.borrowTime?.toDate?.() || (d.borrowTime ? new Date(d.borrowTime) : undefined),
                    withdrawTime: d.withdrawTime?.toDate?.() || (d.withdrawTime ? new Date(d.withdrawTime) : undefined),
                    returnTime: d.returnTime?.toDate?.() || (d.returnTime ? new Date(d.returnTime) : undefined),
                } as EquipmentUsageHistory;
            });

            if (loadMore) {
                setHistory(prev => [...prev, ...data]);
            } else {
                setHistory(data);
            }

            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMoreData(snapshot.docs.length === ITEMS_PER_PAGE);
        } catch (error) {
            console.error("Error:", error);
        }
        setLoading(false);
        setLoadingMore(false);
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const formatDate = (date: Date | undefined) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    // Get unique categories and locations
    const categories = [...new Set(history.map(item => item.equipmentCategory).filter(Boolean))];
    const locations = [...new Set(history.map(item => item.equipmentLocation).filter(Boolean))];

    // Filter logic
    const filtered = history.filter(item => {
        const matchType = activeTab === 'all' || item.type === activeTab;
        const matchStatus = statusFilter === 'all' || item.status === statusFilter;
        const matchCategory = categoryFilter === 'all' || item.equipmentCategory === categoryFilter;
        const matchLocation = locationFilter === 'all' || item.equipmentLocation === locationFilter;
        const matchSearch = !searchQuery ||
            item.equipmentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.userName?.toLowerCase().includes(searchQuery.toLowerCase());

        // Date filter
        const itemDate = new Date(item.borrowTime || item.withdrawTime || new Date());
        const matchDateFrom = !dateFrom || itemDate >= new Date(dateFrom);
        const matchDateTo = !dateTo || itemDate <= new Date(dateTo + 'T23:59:59');

        return matchType && matchStatus && matchCategory && matchLocation && matchSearch && matchDateFrom && matchDateTo;
    });

    const displayed = filtered.slice(0, displayCount);
    const hasMore = displayCount < filtered.length;
    const borrowCount = history.filter(h => h.type === 'borrow').length;
    const withdrawCount = history.filter(h => h.type === 'withdraw').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ประวัติการยืม-เบิก</h1>
                    <p className="text-sm text-gray-500">{history.length} รายการ</p>
                </div>
                <Link href="/equipment" className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                    จัดการอุปกรณ์
                </Link>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">
                {/* Search */}
                <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setDisplayCount(20); }}
                        placeholder="ค้นหาอุปกรณ์, ชื่อผู้ใช้..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>

                {/* Tabs & Filters Row */}
                <div className="flex flex-wrap gap-2 items-center justify-between">
                    {/* Type Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setActiveTab('all'); setDisplayCount(20); }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                            ทั้งหมด ({history.length})
                        </button>
                        <button
                            onClick={() => { setActiveTab('borrow'); setDisplayCount(20); }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'borrow' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}
                        >
                            ยืม ({borrowCount})
                        </button>
                        <button
                            onClick={() => { setActiveTab('withdraw'); setDisplayCount(20); }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'withdraw' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'}`}
                        >
                            เบิก ({withdrawCount})
                        </button>
                    </div>

                    {/* Filters Row */}
                    <div className="flex gap-2 items-center flex-wrap">
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setDisplayCount(20); }}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="all">ทุกสถานะ</option>
                            <option value="active">กำลังยืม</option>
                            <option value="returned">คืนแล้ว</option>
                            <option value="completed">เบิกแล้ว</option>
                        </select>
                        {categories.length > 0 && (
                            <select
                                value={categoryFilter}
                                onChange={(e) => { setCategoryFilter(e.target.value); setDisplayCount(20); }}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="all">ทุกหมวดหมู่</option>
                                {categories.map((cat: any) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        )}
                        {locations.length > 0 && (
                            <select
                                value={locationFilter}
                                onChange={(e) => { setLocationFilter(e.target.value); setDisplayCount(20); }}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="all">ทุกสถานที่เก็บ</option>
                                {locations.map((loc: any) => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Date Filter */}
                    <div className="flex gap-2 items-center flex-wrap">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setDisplayCount(20); }}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setDisplayCount(20); }}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        {(dateFrom || dateTo || categoryFilter !== 'all' || locationFilter !== 'all') && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); setCategoryFilter('all'); setLocationFilter('all'); setDisplayCount(20); }}
                                className="text-xs text-red-500 hover:text-red-700 px-2"
                            >
                                ล้างตัวกรอง
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Results Count */}
            {searchQuery || statusFilter !== 'all' ? (
                <p className="text-sm text-gray-500 mb-3">พบ {filtered.length} รายการ</p>
            ) : null}

            {/* History List */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500">ไม่พบรายการ</p>
                </div>
            ) : (
                <>
                    <div className="space-y-2">
                        {displayed.map(item => (
                            <div key={item.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                                {/* Type Badge */}
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === 'borrow' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                                    {item.type === 'borrow' ? (
                                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-gray-800 text-sm truncate">{item.equipmentName}</h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>{item.userName}</span>
                                        <span>•</span>
                                        <span>{item.quantity} {item.unit}</span>
                                        <span>•</span>
                                        <span>{formatDate(item.borrowTime || item.withdrawTime)}</span>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.type === 'borrow' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                        {item.type === 'borrow' ? 'ยืม' : 'เบิก'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.status === 'returned' ? 'bg-green-100 text-green-700'
                                        : item.status === 'active' ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {item.status === 'returned' ? 'คืนแล้ว' : item.status === 'active' ? 'กำลังยืม' : 'เบิกแล้ว'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load More */}
                    {(hasMore || (hasMoreData && displayCount >= filtered.length)) && (
                        <button
                            onClick={() => {
                                if (displayCount >= filtered.length && hasMoreData) {
                                    fetchHistory(true);
                                }
                                setDisplayCount(prev => prev + 20);
                            }}
                            disabled={loadingMore}
                            className="w-full mt-4 py-3 bg-white rounded-xl shadow-sm text-sm font-medium text-teal-600 hover:bg-teal-50 disabled:opacity-50"
                        >
                            {loadingMore ? 'กำลังโหลด...' : `ดูเพิ่มเติม ${hasMore ? `(${filtered.length - displayCount} รายการ)` : ''}`}
                        </button>
                    )}

                    <p className="text-center text-xs text-gray-400 mt-3">
                        แสดง {displayed.length} จาก {filtered.length} รายการ {hasMoreData && '(มีข้อมูลเพิ่มเติม)'}
                    </p>
                </>
            )}
        </div>
    );
}
