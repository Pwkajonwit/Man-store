"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { query, collection, where, onSnapshot } from "firebase/firestore";
import MainHeader from '@/components/main/MainHeader';
import Image from 'next/image';
// import liff from '@line/liff'; // Import dynamically to avoid SSR issues if package not optimized
import { useModal } from '@/components/ui/Modal';

// Define Interface for Usage
interface EquipmentUsage {
    id: string;
    equipmentName: string;
    equipmentImageUrl?: string;
    quantity: number;
    unit?: string;
    borrowTime?: any; // Timestamp or Date
    [key: string]: any;
}

export default function MyEquipmentPage() {
    const { user, userProfile } = useAuth();
    const { lineSettings } = useAppSettings();
    const router = useRouter();
    const [activeUsages, setActiveUsages] = useState<EquipmentUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [returningId, setReturningId] = useState<string | null>(null);
    const [returningAll, setReturningAll] = useState(false);
    const { showAlert, showConfirm } = useModal();

    // Get LINE settings from context (loaded once in layout)
    const userChatMessageEnabled = lineSettings.userChatMessage;

    useEffect(() => {
        if (!user && !userProfile) return;
        if (!db) return;

        const userId = userProfile?.lineId || user?.uid;
        if (!userId) return;

        const usageQuery = query(
            collection(db as any, 'equipment-usage'),
            where('userId', '==', userId),
            where('status', '==', 'active'),
            where('type', '==', 'borrow')
        );

        const unsubscribe = onSnapshot(usageQuery, (snapshot) => {
            const usagesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                borrowTime: doc.data().borrowTime?.toDate?.() || doc.data().borrowTime,
            })) as EquipmentUsage[];
            setActiveUsages(usagesData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userProfile]);

    const handleReturn = async (usage: EquipmentUsage) => {
        if (returningId) return;
        setReturningId(usage.id);

        try {
            // Import Firestore functions dynamically
            const { doc, runTransaction, Timestamp } = await import("firebase/firestore");

            await runTransaction(db as any, async (transaction) => {
                // 1. READ Operations first
                const usageRef = doc(db as any, "equipment-usage", usage.id);
                const usageDoc = await transaction.get(usageRef);

                const equipmentRef = doc(db as any, "equipment", usage.equipmentId);
                const equipmentDoc = await transaction.get(equipmentRef);

                if (!usageDoc.exists()) throw new Error("ไม่พบรายการยืม");
                const currentUsage = usageDoc.data();
                if (currentUsage.status !== 'active') throw new Error("รายการนี้ถูกคืนไปแล้ว");

                // 2. Prepare Data
                const newQty = equipmentDoc.exists()
                    ? (equipmentDoc.data().availableQuantity || 0) + usage.quantity
                    : usage.quantity;

                const equipmentUpdateData: any = {
                    availableQuantity: newQty,
                    updatedAt: Timestamp.now()
                };
                if (newQty > 0) equipmentUpdateData.status = 'available';

                // 3. WRITE Operations last
                transaction.update(usageRef, {
                    status: 'returned',
                    returnTime: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });

                if (equipmentDoc.exists()) {
                    transaction.update(equipmentRef, equipmentUpdateData);
                }
            });

            // Send LINE Flex Message (optional - keeping existing logic)
            if (userChatMessageEnabled) {
                try {
                    // Dynamic import liff
                    const liff = (await import('@line/liff')).default;
                    if (liff.isInClient()) {
                        const now = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                        await liff.sendMessages([{
                            type: 'flex',
                            altText: `คืนอุปกรณ์: ${usage.equipmentName}`,
                            contents: {
                                type: 'bubble',
                                size: 'kilo',
                                body: {
                                    type: 'box',
                                    layout: 'vertical',
                                    contents: [
                                        { type: 'text', text: 'คืนอุปกรณ์สำเร็จ', weight: 'bold', size: 'md', color: '#333333' },
                                        { type: 'separator', margin: 'lg' },
                                        {
                                            type: 'box',
                                            layout: 'horizontal',
                                            contents: [
                                                { type: 'text', text: usage.equipmentName, size: 'sm', color: '#333333', flex: 3 },
                                                { type: 'text', text: `${usage.quantity} ${usage.unit || 'ชิ้น'}`, size: 'sm', color: '#888888', align: 'end', flex: 1 }
                                            ],
                                            margin: 'lg'
                                        },
                                        { type: 'separator', margin: 'lg' },
                                        { type: 'text', text: now, size: 'xs', color: '#AAAAAA', margin: 'lg', align: 'end' }
                                    ],
                                    paddingAll: '16px'
                                }
                            }
                        } as any]);
                    }
                } catch (lineError) {
                    console.log('LINE message not sent:', lineError);
                }
            }

        } catch (err: any) {
            if (err.message === "รายการนี้ถูกคืนไปแล้ว") {
                // Item already returned (race condition/double click). 
                // Treat as success/ignore since it will disappear from UI via snapshot.
            } else {
                console.error(err);
                showAlert('เกิดข้อผิดพลาดในการคืนอุปกรณ์', 'error');
            }
        }
        setReturningId(null);
    };

    const handleReturnAll = async () => {
        if (activeUsages.length === 0 || returningAll) return;
        const confirmed = await showConfirm(`ต้องการคืนอุปกรณ์ทั้งหมด ${activeUsages.length} รายการ?`, { confirmText: 'คืนทั้งหมด', cancelText: 'ยกเลิก' });
        if (!confirmed) return;

        setReturningAll(true);
        let success = 0, fail = 0;
        const returnedItems: { name: string, qty: number, unit: string }[] = [];

        // Import Firestore functions dynamically
        const { doc, runTransaction, Timestamp } = await import("firebase/firestore");

        for (const usage of activeUsages) {
            try {
                await runTransaction(db as any, async (transaction) => {
                    // 1. READ Operations first
                    const usageRef = doc(db as any, "equipment-usage", usage.id);
                    const usageDoc = await transaction.get(usageRef);

                    const equipmentRef = doc(db as any, "equipment", usage.equipmentId);
                    const equipmentDoc = await transaction.get(equipmentRef);

                    if (!usageDoc.exists()) throw new Error("ไม่พบรายการยืม");
                    const currentUsage = usageDoc.data();
                    if (currentUsage.status !== 'active') throw new Error("รายการนี้ถูกคืนไปแล้ว");

                    // 2. Prepare Data
                    const newQty = equipmentDoc.exists()
                        ? (equipmentDoc.data().availableQuantity || 0) + usage.quantity
                        : usage.quantity;

                    const equipmentUpdateData: any = {
                        availableQuantity: newQty,
                        updatedAt: Timestamp.now()
                    };
                    if (newQty > 0) equipmentUpdateData.status = 'available';

                    // 3. WRITE Operations last
                    transaction.update(usageRef, {
                        status: 'returned',
                        returnTime: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });

                    if (equipmentDoc.exists()) {
                        transaction.update(equipmentRef, equipmentUpdateData);
                    }
                });
                success++;
                returnedItems.push({ name: usage.equipmentName, qty: usage.quantity, unit: usage.unit || 'ชิ้น' });
            } catch { fail++; }
        }

        // Send LINE Flex Message for all returned items
        if (success > 0 && userChatMessageEnabled) {
            try {
                const liff = (await import('@line/liff')).default;
                if (liff.isInClient()) {
                    const now = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                    const itemContents = returnedItems.map(item => ({
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            { type: 'text', text: item.name, size: 'sm', color: '#333333', flex: 3 },
                            { type: 'text', text: `${item.qty} ${item.unit}`, size: 'sm', color: '#888888', align: 'end', flex: 1 }
                        ]
                    }));

                    await liff.sendMessages([{
                        type: 'flex',
                        altText: `คืนอุปกรณ์ ${success} รายการ`,
                        contents: {
                            type: 'bubble',
                            size: 'kilo',
                            body: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    { type: 'text', text: 'คืนอุปกรณ์ทั้งหมดสำเร็จ', weight: 'bold', size: 'md', color: '#333333' },
                                    { type: 'text', text: `${success} รายการ`, size: 'sm', color: '#888888', margin: 'xs' },
                                    { type: 'separator', margin: 'lg' },
                                    { type: 'box', layout: 'vertical', contents: itemContents, margin: 'lg', spacing: 'sm' },
                                    { type: 'separator', margin: 'lg' },
                                    { type: 'text', text: now, size: 'xs', color: '#AAAAAA', margin: 'lg', align: 'end' }
                                ],
                                paddingAll: '16px'
                            }
                        }
                    } as any]);
                }
            } catch (lineError) {
                console.log('LINE message not sent:', lineError);
            }
        }

        setReturningAll(false);
        if (fail === 0) {
            showAlert(`คืนสำเร็จ ${success} รายการ`, 'success');
        } else {
            showAlert(`สำเร็จ ${success} รายการ, ล้มเหลว ${fail} รายการ`, fail > 0 ? 'warning' : 'success');
        }
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <MainHeader userProfile={userProfile} activeTab="my-equipment" setActiveTab={() => { }} />
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <MainHeader userProfile={userProfile} activeTab="my-equipment" setActiveTab={() => { }} />

            <div className="px-4 -mt-16">
                {/* Summary Card */}
                <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">กำลังยืม</h2>
                            <p className="text-sm text-gray-500">{activeUsages.length} รายการ</p>
                        </div>
                        <div className="flex gap-2">
                            {activeUsages.length > 1 && (
                                <button
                                    onClick={handleReturnAll}
                                    disabled={returningAll}
                                    className="px-3 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50"
                                >
                                    {returningAll ? '...' : 'คืนทั้งหมด'}
                                </button>
                            )}
                            <button
                                onClick={() => router.push('/equipment-selection')}
                                className="px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                            >
                                + ยืมเพิ่ม
                            </button>
                        </div>
                    </div>
                </div>

                {/* Empty State */}
                {activeUsages.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <p className="text-gray-500 mb-4">ยังไม่มีอุปกรณ์ที่กำลังยืม</p>
                        <button
                            onClick={() => router.push('/equipment-selection')}
                            className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700"
                        >
                            ยืมอุปกรณ์
                        </button>
                    </div>
                ) : (
                    /* Equipment List - Compact */
                    <div className="space-y-2">
                        {activeUsages.map(usage => (
                            <div key={usage.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                                {/* Image */}
                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                                    {usage.equipmentImageUrl ? (
                                        <Image src={usage.equipmentImageUrl} alt="" width={48} height={48} className="object-cover w-full h-full" unoptimized />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-gray-800 text-sm truncate">{usage.equipmentName}</h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>{usage.quantity} {usage.unit}</span>
                                        <span>•</span>
                                        <span>{formatDate(usage.borrowTime)}</span>
                                    </div>
                                </div>

                                {/* Return Button */}
                                <button
                                    onClick={() => handleReturn(usage)}
                                    disabled={returningId === usage.id}
                                    className="px-6 py-2 text-sm border border-green-600 font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                                >
                                    {returningId === usage.id ? (
                                        <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                    ) : 'คืน'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
