"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { collection, query, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import Image from "next/image";

const ITEMS_PER_PAGE = 100; // โหลดจาก Firestore ครั้งละ 100 รายการ

interface EquipmentUsageHistory {
    id: string;
    type: 'borrow' | 'withdraw';
    status?: string;
    equipmentName?: string;
    equipmentCategory?: string;
    equipmentCode?: string;
    categoryCode?: string;
    categoryName?: string;
    categoryPhase?: string;
    equipmentLocation?: string;
    userName?: string;
    userId?: string;
    requestedByUserName?: string;
    requestedByUserId?: string;
    borrowFor?: boolean;
    borrowerName?: string;
    attachmentImageUrl?: string;
    attachmentFileName?: string;
    returnAttachmentImageUrl?: string;
    returnAttachmentFileName?: string;
    returnNote?: string;
    quantity?: number;
    unit?: string;
    borrowTime?: Date;
    withdrawTime?: Date;
    returnTime?: Date;
    [key: string]: any;
}

// Memoized History Item Component
const HistoryItem = memo(function HistoryItem({
    item,
    formatDate,
    onPreviewImage,
}: {
    item: EquipmentUsageHistory;
    formatDate: (date: Date | undefined) => string;
    onPreviewImage: (url: string, title: string) => void;
}) {
    const categoryLabel = item.categoryCode && item.categoryName
        ? `${item.categoryCode} - ${item.categoryName}`
        : item.equipmentCategory;
    const actorLabel = item.borrowFor
        ? `${item.borrowerName || item.userName || '-'} (ยืมแทนโดย ${item.requestedByUserName || '-'})`
        : item.userName;
    const statusLabel = item.status === 'returned'
        ? 'คืนแล้ว'
        : item.status === 'pending_return'
            ? 'รอตรวจสอบ'
            : item.status === 'active'
                ? 'กำลังยืม'
                : 'เบิกแล้ว';
    const statusClass = item.status === 'returned'
        ? 'bg-green-100 text-green-700'
        : item.status === 'pending_return'
            ? 'bg-amber-100 text-amber-700'
            : item.status === 'active'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600';

    return (
        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
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
    );
});

const EnhancedHistoryItem = memo(function EnhancedHistoryItem({
    item,
    formatDate,
    onPreviewImage,
}: {
    item: EquipmentUsageHistory;
    formatDate: (date: Date | undefined) => string;
    onPreviewImage: (url: string, title: string) => void;
}) {
    const categoryLabel = item.categoryCode && item.categoryName
        ? `${item.categoryCode} - ${item.categoryName}`
        : item.equipmentCategory;
    const actorLabel = item.borrowFor
        ? `${item.borrowerName || item.userName || '-'} (ยืมแทนโดย ${item.requestedByUserName || '-'})`
        : item.userName;
    const statusLabel = item.status === 'returned'
        ? 'คืนแล้ว'
        : item.status === 'pending_return'
            ? 'รอตรวจสอบ'
            : item.status === 'active'
                ? 'กำลังยืม'
                : 'เบิกแล้ว';
    const statusClass = item.status === 'returned'
        ? 'bg-green-100 text-green-700'
        : item.status === 'pending_return'
            ? 'bg-amber-100 text-amber-700'
            : item.status === 'active'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600';
    const attachments = [
        item.attachmentImageUrl ? { url: item.attachmentImageUrl, label: 'ยืม', title: `รูปตอนยืม - ${item.equipmentName || 'อุปกรณ์'}`, color: 'blue' } : null,
        item.returnAttachmentImageUrl ? { url: item.returnAttachmentImageUrl, label: 'คืน', title: `รูปตอนคืน - ${item.equipmentName || 'อุปกรณ์'}`, color: 'green' } : null,
    ].filter(Boolean) as { url: string; label: string; title: string; color: 'blue' | 'green' }[];

    return (
        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
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

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-medium text-gray-800 text-sm truncate">{item.equipmentName}</h3>
                    {item.borrowFor && <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">ยืมแทน</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mt-0.5">
                    <span className="truncate max-w-[220px]">{actorLabel}</span>
                    <span>•</span>
                    <span>{item.quantity} {item.unit}</span>
                    <span>•</span>
                    <span>{formatDate(item.borrowTime || item.withdrawTime)}</span>
                    {categoryLabel && <><span>•</span><span className="truncate max-w-[180px]">{categoryLabel}</span></>}
                    {item.categoryPhase && <><span>•</span><span className="truncate max-w-[180px]">{item.categoryPhase}</span></>}
                    {item.equipmentLocation && <><span>•</span><span className="truncate max-w-[160px]">{item.equipmentLocation}</span></>}
                </div>
            </div>

            {false && item.attachmentImageUrl && (
                <button
                    type="button"
                    onClick={() => onPreviewImage(item.attachmentImageUrl || '', item.equipmentName || 'รูปแนบ')}
                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 hover:ring-2 hover:ring-teal-200 transition"
                    title="ดูรูปแนบ"
                >
                    <Image src={item.attachmentImageUrl || ''} alt="attachment" fill className="object-cover" sizes="48px" unoptimized />
                </button>
            )}

            {attachments.length > 0 && (
                <div className="flex shrink-0 items-center gap-2">
                    {attachments.map((attachment) => (
                        <button
                            key={`${attachment.label}-${attachment.url}`}
                            type="button"
                            onClick={() => onPreviewImage(attachment.url, attachment.title)}
                            className={`relative h-12 w-12 overflow-hidden rounded-lg border transition hover:ring-2 ${attachment.color === 'blue'
                                ? 'border-blue-100 bg-blue-50 hover:ring-blue-200'
                                : 'border-green-100 bg-green-50 hover:ring-green-200'
                                }`}
                            title={attachment.title}
                        >
                            <Image src={attachment.url} alt={attachment.title} fill className="object-cover" sizes="48px" unoptimized />
                            <span className={`absolute bottom-0 left-0 right-0 py-0.5 text-[9px] font-medium text-white ${attachment.color === 'blue' ? 'bg-blue-600/85' : 'bg-green-600/85'}`}>
                                {attachment.label}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <div className="flex flex-col items-end gap-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.type === 'borrow' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {item.type === 'borrow' ? 'ยืม' : 'เบิก'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusClass}`}>{statusLabel}</span>
            </div>
        </div>
    );
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
    const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMoreData, setHasMoreData] = useState(true);

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Debounce search query
    const debouncedSearch = useDebounce(searchQuery, 300);

    const fetchHistory = useCallback(async (loadMore = false) => {
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
    }, [lastDoc]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const formatDate = useCallback((date: Date | undefined) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }, []);

    // Memoized unique categories and locations
    const { categories, locations } = useMemo(() => ({
        categories: [...new Set(history.map(item => item.categoryName || item.equipmentCategory).filter(Boolean))],
        locations: [...new Set(history.map(item => item.equipmentLocation).filter(Boolean))]
    }), [history]);

    // Memoized counts
    const { borrowCount, withdrawCount } = useMemo(() => ({
        borrowCount: history.filter(h => h.type === 'borrow').length,
        withdrawCount: history.filter(h => h.type === 'withdraw').length
    }), [history]);

    // Memoized filter logic - with debounced search
    const filtered = useMemo(() => {
        return history.filter(item => {
            const matchType = activeTab === 'all' || item.type === activeTab;
            const matchStatus = statusFilter === 'all' || item.status === statusFilter;
            const matchCategory = categoryFilter === 'all' || item.equipmentCategory === categoryFilter || item.categoryName === categoryFilter;
            const matchLocation = locationFilter === 'all' || item.equipmentLocation === locationFilter;
            const matchSearch = !debouncedSearch ||
                item.equipmentName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                item.userName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                item.borrowerName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                item.requestedByUserName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                item.categoryCode?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                item.categoryName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                item.categoryPhase?.toLowerCase().includes(debouncedSearch.toLowerCase());

            // Date filter
            const itemDate = new Date(item.borrowTime || item.withdrawTime || new Date());
            const matchDateFrom = !dateFrom || itemDate >= new Date(dateFrom);
            const matchDateTo = !dateTo || itemDate <= new Date(dateTo + 'T23:59:59');

            return matchType && matchStatus && matchCategory && matchLocation && matchSearch && matchDateFrom && matchDateTo;
        });
    }, [history, activeTab, statusFilter, categoryFilter, locationFilter, debouncedSearch, dateFrom, dateTo]);

    // Pagination calculation
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = useMemo(() => filtered.slice(startIndex, endIndex), [filtered, startIndex, endIndex]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, debouncedSearch, statusFilter, categoryFilter, locationFilter, dateFrom, dateTo]);

    // Load more data if needed when reaching last page
    useEffect(() => {
        if (currentPage === totalPages && hasMoreData && !loadingMore && filtered.length > 0) {
            fetchHistory(true);
        }
    }, [currentPage, totalPages, hasMoreData, loadingMore]);

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
                    <p className="text-sm text-gray-500">{history.length} รายการ {hasMoreData && '(มีข้อมูลเพิ่มเติม)'}</p>
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
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาอุปกรณ์, ชื่อผู้ใช้..."
                        className="w-full pl-9 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Tabs & Filters Row */}
                <div className="flex flex-wrap gap-2 items-center justify-between">
                    {/* Type Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                            ทั้งหมด ({history.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('borrow')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'borrow' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}
                        >
                            ยืม ({borrowCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('withdraw')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'withdraw' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'}`}
                        >
                            เบิก ({withdrawCount})
                        </button>
                    </div>

                    {/* Filters Row */}
                    <div className="flex gap-2 items-center flex-wrap">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="all">ทุกสถานะ</option>
                            <option value="active">กำลังยืม</option>
                            <option value="pending_return">รอตรวจสอบคืน</option>
                            <option value="returned">คืนแล้ว</option>
                            <option value="completed">เบิกแล้ว</option>
                        </select>
                        {categories.length > 0 && (
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
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
                                onChange={(e) => setLocationFilter(e.target.value)}
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
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        {(dateFrom || dateTo || categoryFilter !== 'all' || locationFilter !== 'all') && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); setCategoryFilter('all'); setLocationFilter('all'); }}
                                className="text-xs text-red-500 hover:text-red-700 px-2"
                            >
                                ล้างตัวกรอง
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Results Count & Items Per Page */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-sm text-gray-500">
                    {filtered.length > 0
                        ? `แสดง ${startIndex + 1}-${Math.min(endIndex, filtered.length)} จาก ${filtered.length} รายการ`
                        : 'ไม่พบรายการ'}
                </p>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-500">แสดง:</label>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                    <span className="text-sm text-gray-500">รายการ</span>
                </div>
            </div>

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
                        {paginatedItems.map(item => (
                            <EnhancedHistoryItem
                                key={item.id}
                                item={item}
                                formatDate={formatDate}
                                onPreviewImage={(url, title) => setPreviewImage({ url, title })}
                            />
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl shadow-sm p-4">
                            <p className="text-sm text-gray-500">
                                หน้า {currentPage} จาก {totalPages}
                            </p>
                            <div className="flex items-center gap-1">
                                {/* First Page */}
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    title="หน้าแรก"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                    </svg>
                                </button>
                                {/* Previous Page */}
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    title="หน้าก่อนหน้า"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>

                                {/* Page Numbers */}
                                <div className="flex items-center gap-1 mx-2">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(page => {
                                            if (totalPages <= 5) return true;
                                            if (page === 1 || page === totalPages) return true;
                                            if (Math.abs(page - currentPage) <= 1) return true;
                                            return false;
                                        })
                                        .map((page, index, arr) => (
                                            <span key={page} className="flex items-center">
                                                {index > 0 && arr[index - 1] !== page - 1 && (
                                                    <span className="px-1 text-gray-400">...</span>
                                                )}
                                                <button
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                                                        ? 'bg-teal-600 text-white'
                                                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            </span>
                                        ))}
                                </div>

                                {/* Next Page */}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    title="หน้าถัดไป"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                {/* Last Page */}
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    title="หน้าสุดท้าย"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loading More Indicator */}
                    {loadingMore && (
                        <div className="flex items-center justify-center py-4">
                            <div className="animate-spin h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                            <span className="ml-2 text-sm text-gray-500">กำลังโหลดข้อมูลเพิ่มเติม...</span>
                        </div>
                    )}
                </>
            )}

            {previewImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                            <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-gray-900">{previewImage.title}</h3>
                                <p className="text-xs text-gray-500">รูปแนบการยืม</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewImage(null)}
                                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                            >
                                ปิด
                            </button>
                        </div>
                        <div className="relative h-[70vh] bg-gray-950">
                            <Image
                                src={previewImage.url}
                                alt="attachment preview"
                                fill
                                className="object-contain"
                                sizes="90vw"
                                unoptimized
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


