"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// --- Icons ---
const Icons = {
    User: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
    ),
    Empty: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
    ),
};

interface UsageRecord {
    id: string;
    equipmentName: string;
    userName: string;
    userId: string;
    borrowTime: any;
    quantity: number;
    unit: string;
    location?: string;
}

interface UserGroup {
    userName: string;
    userId: string;
    items: UsageRecord[];
    lastActive: any;
}

export default function RealtimeUsagePage() {
    const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) return;

        // 1. Listen to Equipment for mapping
        const equipmentMap = new Map<string, string>();
        const unsubEquipment = onSnapshot(collection(db as any, "equipment"), (snapshot) => {
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.name) {
                    equipmentMap.set(data.name, data.location || "ไม่ระบุ");
                }
            });
        });

        // 2. Listen to Active Borrows
        const q = query(
            collection(db as any, "equipment-usage"),
            where("status", "==", "active"),
            where("type", "==", "borrow")
        );

        const unsubUsage = onSnapshot(q, (snapshot) => {
            const groups: { [key: string]: UserGroup } = {};

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const record: UsageRecord = {
                    id: doc.id,
                    equipmentName: data.equipmentName,
                    userName: data.userName,
                    userId: data.userId,
                    borrowTime: data.borrowTime?.toDate?.() || data.borrowTime,
                    quantity: data.quantity,
                    unit: data.unit,
                    location: equipmentMap.get(data.equipmentName) || "ไม่ระบุ"
                };

                if (!groups[record.userId]) {
                    groups[record.userId] = {
                        userName: record.userName,
                        userId: record.userId,
                        items: [],
                        lastActive: record.borrowTime
                    };
                }

                groups[record.userId].items.push(record);
                if (record.borrowTime > groups[record.userId].lastActive) {
                    groups[record.userId].lastActive = record.borrowTime;
                }
            });

            const sortedGroups = Object.values(groups).sort((a, b) => b.lastActive - a.lastActive);
            setUserGroups(sortedGroups);
            setLoading(false);
        });

        return () => {
            unsubEquipment();
            unsubUsage();
        };
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-200"></span>
                        ติดตามการยืม Realtime
                    </h1>
                    <p className="text-gray-500 text-xs mt-1">รายการอุปกรณ์ที่กำลังถูกใช้งาน</p>
                </div>
                <div className="text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                    กำลังยืมทั้งหมด {userGroups.reduce((acc, g) => acc + g.items.length, 0)} รายการ
                </div>
            </div>

            {userGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                        <Icons.Empty className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">ไม่มีอุปกรณ์ที่ถูกยืมในขณะนี้</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {userGroups.map((group) => (
                        <div key={group.userId} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] transition-all duration-200 flex flex-col h-full">
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-gray-50 bg-gradient-to-br from-white to-gray-50/50 rounded-t-2xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-sm font-semibold border border-indigo-100 shadow-sm">
                                    {group.userName.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm font-bold text-gray-900 truncate pr-2">{group.userName}</h2>
                                    <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                        กำลังใช้งาน
                                    </div>
                                </div>
                                <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded-full border border-gray-200">
                                    {group.items.length} รายการ
                                </span>
                            </div>

                            {/* List */}
                            <div className="p-2 flex-1 flex flex-col gap-1.5">
                                {group.items.map((item) => (
                                    <div key={item.id} className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                        <div className="min-w-0 pr-4">
                                            <div className="font-medium text-sm text-gray-800 truncate">{item.equipmentName}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] px-1.5 py-px rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium truncate max-w-[120px]">
                                                    {item.location}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <span className="text-sm font-bold text-gray-900">{item.quantity}</span>
                                            <span className="text-[10px] text-gray-400 ml-1 block">{item.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
