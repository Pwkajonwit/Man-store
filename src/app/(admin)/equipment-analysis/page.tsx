"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

// --- Icons ---
const Icons = {
    Tool: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
    ),
    Repeat: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
        </svg>
    ),
    Box: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
    ),
    ExclamationTriangle: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
    ),
    Clock: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    User: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
    ),
};

interface Equipment {
    id: string;
    name: string;
    type: 'borrowable' | 'consumable';
    status: string;
    location?: string;
    availableQuantity: number;
    quantity: number;
    unit: string;
    minStock?: number;
    imageUrl?: string;
}

interface UsageRecord {
    id: string;
    equipmentName: string;
    userName: string;
    borrowTime: any;
    withdrawTime: any;
    returnTime: any;
    createdAt: any;
    status: string;
    type: string;
    quantity: number;
    unit: string;
}

export default function EquipmentAnalysisPage() {
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [activeBorrows, setActiveBorrows] = useState<UsageRecord[]>([]);
    const [recentActivity, setRecentActivity] = useState<UsageRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) return;
        // Listen to equipment
        const equipmentQuery = query(collection(db as any, "equipment"));
        const unsubEquipment = onSnapshot(equipmentQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
            setEquipment(data);
        });

        // Listen to active borrows
        const borrowQuery = query(
            collection(db as any, "equipment-usage"),
            where("status", "==", "active"),
            where("type", "==", "borrow")
        );
        const unsubBorrows = onSnapshot(borrowQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    borrowTime: d.borrowTime?.toDate?.() || d.borrowTime,
                } as UsageRecord;
            });
            setActiveBorrows(data);
        });

        // Fetch recent activity (last 20) - รวมทั้ง equipment-usage และ stock-history
        const fetchRecentActivity = async () => {
            if (!db) return;
            try {
                // ดึงข้อมูลการยืม/เบิก
                const usageSnapshot = await getDocs(query(
                    collection(db as any, "equipment-usage"),
                    orderBy("createdAt", "desc"),
                    limit(20)
                ));
                const usageData = usageSnapshot.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        ...d,
                        borrowTime: d.borrowTime?.toDate?.() || d.borrowTime,
                        withdrawTime: d.withdrawTime?.toDate?.() || d.withdrawTime,
                        returnTime: d.returnTime?.toDate?.() || d.returnTime,
                        createdAt: d.createdAt?.toDate?.() || d.createdAt,
                        activityType: 'usage' as const,
                    } as UsageRecord & { activityType: 'usage' };
                });

                // ดึงข้อมูลการนำเข้า/เติมสต็อก
                const stockSnapshot = await getDocs(query(
                    collection(db as any, "stock-history"),
                    orderBy("createdAt", "desc"),
                    limit(20)
                ));
                const stockData = stockSnapshot.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        equipmentName: d.equipmentName || 'ไม่ระบุ',
                        userName: 'ระบบ',
                        borrowTime: null,
                        withdrawTime: null,
                        returnTime: null,
                        createdAt: d.createdAt?.toDate?.() || d.createdAt,
                        status: 'completed',
                        type: 'restock',
                        quantity: d.quantity || 0,
                        unit: 'ชิ้น',
                        note: d.note,
                        previousQuantity: d.previousQuantity,
                        newQuantity: d.newQuantity,
                        activityType: 'stock' as const,
                    } as UsageRecord & { activityType: 'stock'; note?: string; previousQuantity?: number; newQuantity?: number };
                });

                // รวมและเรียงลำดับตามวันที่
                const allActivity = [...usageData, ...stockData].sort((a, b) => {
                    const dateA: any = new Date(a.createdAt || a.borrowTime || a.withdrawTime);
                    const dateB: any = new Date(b.createdAt || b.borrowTime || b.withdrawTime);
                    return dateB - dateA;
                }).slice(0, 20);

                setRecentActivity(allActivity as any);
            } catch (error) {
                console.error("Error fetching recent activity:", error);
            }
            setLoading(false);
        };

        fetchRecentActivity();

        return () => {
            unsubEquipment();
            unsubBorrows();
        };
    }, []);

    const formatDateTime = (date: any) => {
        if (!date) return '-';
        try {
            const d = new Date(date);
            return d.toLocaleString('th-TH', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (e) {
            return '-';
        }
    };

    // Calculate stats
    const borrowableCount = useMemo(() => equipment.filter(e => e.type === 'borrowable').length, [equipment]);
    const consumableCount = useMemo(() => equipment.filter(e => e.type === 'consumable').length, [equipment]);

    // Low stock: เช็คจาก status หรือเทียบกับ minStock ที่ตั้งไว้
    const lowStockItems = useMemo(() => equipment.filter(e => {
        // แบบเดิม: เช็คจาก status
        if (e.status === 'low_stock' || e.status === 'out_of_stock') return true;
        // แบบใหม่: เทียบกับ minStock ที่ตั้งไว้
        if (e.minStock && e.minStock > 0 && e.availableQuantity <= e.minStock) return true;
        // หมดสต็อก
        if (e.availableQuantity <= 0) return true;
        return false;
    }), [equipment]);

    // แยกประเภท alert
    const outOfStockItems = useMemo(() => lowStockItems.filter(e => e.availableQuantity <= 0), [lowStockItems]);
    const belowMinStockItems = useMemo(() => lowStockItems.filter(e => e.availableQuantity > 0 && e.minStock && e.availableQuantity <= e.minStock), [lowStockItems]);

    const totalEquipment = equipment.length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    // Helper for location summary
    const getLocationSummary = () => {
        const locationMap: Record<string, { total: number; borrowable: number; consumable: number; items: Equipment[] }> = {};
        equipment.forEach(e => {
            const loc = e.location || 'ไม่ระบุ';
            if (!locationMap[loc]) {
                locationMap[loc] = { total: 0, borrowable: 0, consumable: 0, items: [] };
            }
            locationMap[loc].total++;
            if (e.type === 'borrowable') locationMap[loc].borrowable++;
            if (e.type === 'consumable') locationMap[loc].consumable++;
            locationMap[loc].items.push(e);
        });
        return Object.entries(locationMap).sort((a, b) => b[1].total - a[1].total);
    };

    const locations = getLocationSummary();

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ภาพรวมอุปกรณ์ช่าง</h1>
                    <p className="text-gray-500 text-sm mt-1">สถิติและรายงานการยืม-เบิกอุปกรณ์</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/equipment-usage-realtime"
                        className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                    >
                        <Icons.Clock className="w-5 h-5 mr-1.5" />
                        ดูแบบ Realtime
                    </Link>
                    <Link
                        href="/equipment"
                        className="inline-flex items-center justify-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium shadow-sm"
                    >
                        จัดการอุปกรณ์
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                            <Icons.Tool className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{totalEquipment}</div>
                            <div className="text-xs text-gray-500">อุปกรณ์ทั้งหมด</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Icons.Repeat className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{borrowableCount}</div>
                            <div className="text-xs text-gray-500">ยืม-คืน</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Icons.Box className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{consumableCount}</div>
                            <div className="text-xs text-gray-500">เบิก</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${lowStockItems.length > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                            <Icons.ExclamationTriangle className={`w-5 h-5 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-green-600'}`} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{lowStockItems.length}</div>
                            <div className="text-xs text-gray-500">ใกล้หมด/หมด</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Low Stock Alert - Simple */}
            {lowStockItems.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">⚠️</span>
                            <span className="font-bold text-red-800">ต้องเติมสต็อก ({lowStockItems.length})</span>
                        </div>
                        <Link href="/equipment" className="text-sm text-red-600 hover:underline">
                            ดูทั้งหมด →
                        </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {lowStockItems.slice(0, 8).map(item => (
                            <Link
                                key={item.id}
                                href={`/equipment/${item.id}`}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${item.availableQuantity <= 0
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                    }`}
                            >
                                {item.name} ({item.availableQuantity}/{item.quantity})
                            </Link>
                        ))}
                        {lowStockItems.length > 8 && (
                            <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm">
                                +{lowStockItems.length - 8} รายการ
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Location Summary */}
            {locations.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            ตำแหน่งจัดเก็บ ({locations.length} ที่)
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
                        {locations.map(([loc, data]) => (
                            <div key={loc} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div className="font-medium text-gray-900 text-sm truncate">{loc}</div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">ทั้งหมด</span>
                                    <span className="font-bold text-gray-900">{data.total}</span>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {data.borrowable > 0 && (
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">
                                            ยืม {data.borrowable}
                                        </span>
                                    )}
                                    {data.consumable > 0 && (
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded-full">
                                            เบิก {data.consumable}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Borrows */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <Icons.Clock className="w-5 h-5 text-yellow-600" />
                            กำลังยืมอยู่ ({activeBorrows.length})
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-96 overflow-auto">
                        {activeBorrows.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                                <p>ไม่มีอุปกรณ์ที่กำลังถูกยืม</p>
                            </div>
                        ) : (
                            activeBorrows.map(item => (
                                <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium text-gray-900">{item.equipmentName}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                <Icons.User className="w-3 h-3" />
                                                {item.userName}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                ยืมเมื่อ: {formatDateTime(item.borrowTime)}
                                            </div>
                                            {(() => {
                                                const eq = equipment.find(e => e.name === item.equipmentName);
                                                if (eq && eq.location) {
                                                    return (
                                                        <div className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                                                            <span>📍 {eq.location}</span>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <div className="text-right">
                                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                                                {item.quantity} {item.unit}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <Icons.Tool className="w-5 h-5 text-teal-600" />
                            กิจกรรมล่าสุด
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-96 overflow-auto">
                        {recentActivity.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                                <p>ยังไม่มีกิจกรรม</p>
                            </div>
                        ) : (
                            recentActivity.map(item => (
                                <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.type === 'borrow'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : item.type === 'restock'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {item.type === 'borrow' ? 'ยืม' : item.type === 'restock' ? 'นำเข้า' : 'เบิก'}
                                                </span>
                                                {item.type !== 'restock' && (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.status === 'returned'
                                                        ? 'bg-green-100 text-green-700'
                                                        : item.status === 'active'
                                                            ? 'bg-yellow-100 text-yellow-700'
                                                            : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {item.status === 'returned' ? 'คืนแล้ว' : item.status === 'active' ? 'กำลังยืม' : 'เบิกแล้ว'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-medium text-sm text-gray-900">{item.equipmentName}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {item.type === 'restock' ? (
                                                    <span className="text-green-600 font-medium">+{item.quantity} ชิ้น</span>
                                                ) : (
                                                    <>{item.userName} • {item.quantity} {item.unit}</>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {formatDateTime(item.createdAt || item.borrowTime || item.withdrawTime)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
}
