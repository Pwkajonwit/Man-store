"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

interface StockHistory {
    id: string;
    equipmentId: string;
    equipmentName: string;
    type: 'restock' | 'adjust' | 'initial';
    quantity: number;
    note?: string;
    previousQuantity: number;
    newQuantity: number;
    createdAt: any;
}

export default function StockHistoryPage() {
    const [history, setHistory] = useState<StockHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<'all' | 'restock' | 'adjust'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

    useEffect(() => {
        if (!db) return;

        const q = query(
            collection(db as any, 'stock-history'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || new Date()
            } as StockHistory));
            setHistory(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Filter by date
    const getDateFilter = (date: Date) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (dateRange) {
            case 'today':
                return date >= today;
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return date >= weekAgo;
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return date >= monthAgo;
            default:
                return true;
        }
    };

    // Filtered history
    const filteredHistory = history.filter(item => {
        const matchType = filterType === 'all' || item.type === filterType;
        const matchSearch = !searchQuery ||
            item.equipmentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.note?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchDate = getDateFilter(new Date(item.createdAt));
        return matchType && matchSearch && matchDate;
    });

    // Format date
    const formatDateTime = (date: any) => {
        if (!date) return '-';
        try {
            const d = new Date(date);
            return d.toLocaleString('th-TH', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '-';
        }
    };

    // Stats
    const totalRestock = history.filter(h => h.type === 'restock').reduce((sum, h) => sum + h.quantity, 0);
    const todayRestock = history.filter(h => {
        const today = new Date();
        const d = new Date(h.createdAt);
        return h.type === 'restock' &&
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    }).reduce((sum, h) => sum + h.quantity, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ประวัติการเติมสต็อก</h1>
                    <p className="text-gray-500 text-sm mt-1">รายการเติมสต็อกอุปกรณ์ทั้งหมด</p>
                </div>
                <Link
                    href="/equipment"
                    className="inline-flex items-center justify-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium shadow-sm"
                >
                    <svg className="w-5 h-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    กลับไปคลังอุปกรณ์
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <span className="text-lg">📦</span>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{history.length}</div>
                            <div className="text-xs text-gray-500">รายการทั้งหมด</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <span className="text-lg">➕</span>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">+{totalRestock}</div>
                            <div className="text-xs text-gray-500">เติมรวม</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                            <span className="text-lg">📅</span>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">+{todayRestock}</div>
                            <div className="text-xs text-gray-500">เติมวันนี้</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <span className="text-lg">🏷️</span>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">
                                {new Set(history.map(h => h.equipmentId)).size}
                            </div>
                            <div className="text-xs text-gray-500">อุปกรณ์</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                <div className="flex flex-wrap gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ค้นหาชื่ออุปกรณ์, หมายเหตุ..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>

                    {/* Date Range */}
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as any)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                        <option value="all">ทุกช่วงเวลา</option>
                        <option value="today">วันนี้</option>
                        <option value="week">7 วันที่แล้ว</option>
                        <option value="month">30 วันที่แล้ว</option>
                    </select>

                    {/* Type Filter */}
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filterType === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            ทั้งหมด
                        </button>
                        <button
                            onClick={() => setFilterType('restock')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filterType === 'restock' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            เติมสต็อก
                        </button>
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">วันที่/เวลา</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">อุปกรณ์</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">ประเภท</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">จำนวนเติม</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">ก่อน → หลัง</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">หมายเหตุ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                                        <div className="text-4xl mb-2">📦</div>
                                        <div>ไม่พบประวัติการเติมสต็อก</div>
                                    </td>
                                </tr>
                            ) : (
                                filteredHistory.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-gray-900">{formatDateTime(item.createdAt)}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/equipment/${item.equipmentId}`}
                                                className="text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                                            >
                                                {item.equipmentName}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.type === 'restock'
                                                    ? 'bg-green-100 text-green-700'
                                                    : item.type === 'adjust'
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {item.type === 'restock' ? 'เติมสต็อก' : item.type === 'adjust' ? 'ปรับปรุง' : 'เริ่มต้น'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-lg font-bold text-green-600">
                                                +{item.quantity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm text-gray-500">
                                                {item.previousQuantity} → <span className="font-semibold text-gray-900">{item.newQuantity}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-gray-600 max-w-xs truncate">
                                                {item.note || '-'}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Info */}
                {filteredHistory.length > 0 && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-500 text-center">
                        แสดง {filteredHistory.length} รายการ
                    </div>
                )}
            </div>
        </div>
    );
}
