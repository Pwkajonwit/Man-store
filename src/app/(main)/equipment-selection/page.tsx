"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from "@/context/AuthContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import MainHeader from '@/components/main/MainHeader';

interface Equipment {
    id: string;
    name: string;
    type?: string;
    category?: string;
    code?: string;
    availableQuantity: number;
    unit?: string;
    imageUrl?: string;
    status?: string;
    [key: string]: any;
}

interface CartItem {
    id: string;
    name: string;
    quantity: number;
    unit?: string;
    maxQty: number;
    imageUrl?: string;
}

export default function EquipmentSelectionPage() {
    const { user, userProfile } = useAuth();
    const { lineSettings } = useAppSettings();
    const router = useRouter();
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loadingEquipment, setLoadingEquipment] = useState(true);
    const [activeTab, setActiveTab] = useState('borrowable');
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [purpose, setPurpose] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0 });
    const [message, setMessage] = useState("");

    // Get LINE settings from context (loaded once in layout)
    const userChatMessageEnabled = lineSettings.userChatMessage;

    // ดึงรายการอุปกรณ์
    useEffect(() => {
        if (!db) return;
        const q = query(
            collection(db as any, "equipment"),
            where("type", "==", activeTab)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const availableEquipment = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Equipment))
                .filter(e => e.availableQuantity > 0 && e.status === 'available');
            setEquipment(availableEquipment);
            setLoadingEquipment(false);
        });

        return () => unsubscribe();
    }, [activeTab]);

    // Reset cart when tab changes
    useEffect(() => {
        setCart([]);
        setSearchQuery("");
        setSelectedCategory('all');
    }, [activeTab]);

    // หมวดหมู่ทั้งหมด
    const categories = useMemo(() => {
        const cats = Array.from(new Set(equipment.map(e => e.category || 'ทั่วไป')));
        return cats.sort();
    }, [equipment]);

    // กรองรายการ
    const filteredEquipment = useMemo(() => {
        let result = equipment;

        if (selectedCategory !== 'all') {
            result = result.filter(eq => (eq.category || 'ทั่วไป') === selectedCategory);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(eq =>
                eq.name?.toLowerCase().includes(q) ||
                (eq.code && eq.code.toLowerCase().includes(q)) ||
                (eq.category && eq.category.toLowerCase().includes(q))
            );
        }

        return result;
    }, [equipment, searchQuery, selectedCategory]);

    // เพิ่ม/ลด item ในตะกร้า
    const updateCart = (eq: Equipment, delta: number) => {
        setCart(prevCart => {
            const existing = prevCart.find(item => item.id === eq.id);
            if (existing) {
                const newQty = existing.quantity + delta;
                if (newQty <= 0) {
                    return prevCart.filter(item => item.id !== eq.id);
                }
                if (newQty > eq.availableQuantity) {
                    return prevCart;
                }
                return prevCart.map(item =>
                    item.id === eq.id ? { ...item, quantity: newQty } : item
                );
            } else if (delta > 0) {
                return [...prevCart, {
                    id: eq.id,
                    name: eq.name,
                    quantity: 1,
                    unit: eq.unit,
                    maxQty: eq.availableQuantity,
                    imageUrl: eq.imageUrl || '',
                }];
            }
            return prevCart;
        });
    };

    const getCartQuantity = (id: string) => {
        const item = cart.find(c => c.id === id);
        return item ? item.quantity : 0;
    };

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    // ส่งคำขอยืม/เบิก (Client-side Implementation for Dev)
    const handleSubmit = async () => {
        if (cart.length === 0) return;
        if (!db) return;

        setIsSubmitting(true);
        setSubmitProgress({ current: 0, total: cart.length });

        let successCount = 0;
        let failCount = 0;
        const type = activeTab === 'borrowable' ? 'borrow' : 'withdraw';

        // Import Firestore functions dynamically or ensure they are imported at top
        const { addDoc, collection, doc, updateDoc, getDoc, Timestamp, runTransaction } = await import("firebase/firestore");

        for (let i = 0; i < cart.length; i++) {
            const item = cart[i];
            setSubmitProgress({ current: i + 1, total: cart.length });

            try {
                await runTransaction(db as any, async (transaction) => {
                    // 1. READ Operations first
                    const equipmentRef = doc(db as any, "equipment", item.id);
                    const equipmentDoc = await transaction.get(equipmentRef);

                    if (!equipmentDoc.exists()) {
                        throw new Error("ไม่พบอุปกรณ์");
                    }

                    const equipmentData = equipmentDoc.data() as Equipment;
                    const available = equipmentData.availableQuantity || 0;

                    if (available < item.quantity) {
                        throw new Error(`อุปกรณ์ไม่พอ (เหลือ ${available})`);
                    }

                    // 2. Prepare Data (No Writes yet)
                    const usageRef = doc(collection(db as any, "equipment-usage"));
                    const usageData = {
                        equipmentId: item.id,
                        equipmentName: item.name,
                        equipmentCode: equipmentData.code || '',
                        equipmentImageUrl: item.imageUrl || '',
                        equipmentCategory: equipmentData.category || '',
                        equipmentLocation: equipmentData.location || '',
                        userId: userProfile?.lineId || user?.uid,
                        userName: userProfile?.name || userProfile?.displayName || user?.displayName || 'ไม่ระบุชื่อ',
                        type: type,
                        quantity: item.quantity,
                        unit: item.unit || 'ชิ้น',
                        borrowTime: Timestamp.now(),
                        returnTime: null,
                        purpose: purpose || '',
                        status: 'active', // active | returned
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                    };

                    const newQty = available - item.quantity;
                    const updateData: any = {
                        availableQuantity: newQty,
                        updatedAt: Timestamp.now()
                    };
                    if (newQty <= 0) {
                        updateData.status = 'out_of_stock';
                    }

                    // 3. WRITE Operations last
                    transaction.set(usageRef, usageData);
                    transaction.update(equipmentRef, updateData);
                });

                successCount++;
            } catch (error) {
                console.error("Error processing item:", item.name, error);
                failCount++;
            }
        }

        setIsSubmitting(false);
        setShowConfirmModal(false);

        if (failCount === 0) {
            setMessage(`${activeTab === 'borrowable' ? 'ยืม' : 'เบิก'}สำเร็จ ${successCount} รายการ`);

            // Send LINE Flex Message (optional - keeping existing logic)
            if (userChatMessageEnabled) {
                // ... (LINE logic remains same if client-side or separate api call, skipping strictly strictly for now but keeping placeholder structure if needed)
                try {
                    const liff = (await import('@line/liff')).default;
                    if (liff.isInClient()) {
                        // ... existing LIFF send message logic ...
                        const actionText = activeTab === 'borrowable' ? 'ยืม' : 'เบิก';
                        const now = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

                        const itemContents = cart.map(c => ({
                            type: 'box',
                            layout: 'horizontal',
                            contents: [
                                { type: 'text', text: c.name, size: 'sm', color: '#333333', flex: 3 },
                                { type: 'text', text: `${c.quantity} ${c.unit || ''}`, size: 'sm', color: '#888888', align: 'end', flex: 1 }
                            ]
                        }));

                        await liff.sendMessages([{
                            type: 'flex',
                            altText: `${actionText}อุปกรณ์ ${successCount} รายการ`,
                            contents: {
                                type: 'bubble',
                                size: 'kilo',
                                body: {
                                    type: 'box',
                                    layout: 'vertical',
                                    contents: [
                                        { type: 'text', text: `${actionText}อุปกรณ์สำเร็จ`, weight: 'bold', size: 'md', color: '#333333' },
                                        { type: 'text', text: `${successCount} รายการ`, size: 'sm', color: '#888888', margin: 'xs' },
                                        { type: 'separator', margin: 'lg' },
                                        { type: 'box', layout: 'vertical', contents: itemContents, margin: 'lg', spacing: 'sm' },
                                        ...(purpose ? [
                                            { type: 'separator', margin: 'lg' },
                                            { type: 'text', text: purpose, size: 'xs', color: '#888888', margin: 'lg', wrap: true }
                                        ] : []),
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

            setCart([]);
            setPurpose("");
            if (activeTab === 'borrowable') {
                setTimeout(() => router.push('/my-equipment'), 1500);
            }
        } else {
            setMessage(`สำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ`);
        }

        setTimeout(() => setMessage(""), 3000);
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <MainHeader userProfile={userProfile} activeTab="borrow" setActiveTab={() => { }} />

            <div className="px-4 -mt-16">
                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('borrowable')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'borrowable'
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            ยืม-คืน
                        </button>
                        <button
                            onClick={() => setActiveTab('consumable')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'consumable'
                                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            เบิก
                        </button>
                    </div>

                    {/* Search & Filter */}
                    <div className="p-4 border-b border-gray-100 space-y-3">
                        {/* Search */}
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="ค้นหาชื่อ, รหัส..."
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Category Filter */}
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategory === 'all'
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                ทั้งหมด ({equipment.length})
                            </button>
                            {categories.map(cat => {
                                const count = equipment.filter(e => (e.category || 'ทั่วไป') === cat).length;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategory === cat
                                            ? 'bg-teal-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {cat} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Equipment List */}
                    <div className="max-h-[calc(100vh-380px)] overflow-auto">
                        {loadingEquipment ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
                            </div>
                        ) : filteredEquipment.length === 0 ? (
                            <div className="text-center py-12">
                                <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                                </svg>
                                <p className="text-gray-500 text-sm">
                                    {searchQuery ? `ไม่พบ "${searchQuery}"` : 'ไม่มีอุปกรณ์'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredEquipment.map(eq => {
                                    const inCart = getCartQuantity(eq.id);
                                    return (
                                        <div key={eq.id} className={`p-3 flex gap-3 transition-colors ${inCart > 0 ? 'bg-teal-50' : ''}`}>
                                            {/* Image */}
                                            <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                                                {eq.imageUrl ? (
                                                    <Image src={eq.imageUrl} alt="" width={56} height={56} className="object-cover w-full h-full" unoptimized />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-gray-800 text-sm truncate">{eq.name}</h3>
                                                <p className="text-xs text-gray-500">{eq.category || 'ทั่วไป'}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${eq.availableQuantity <= 3
                                                        ? 'bg-orange-100 text-orange-700'
                                                        : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        คงเหลือ {eq.availableQuantity} {eq.unit || 'ชิ้น'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Quantity Controls */}
                                            <div className="flex items-center gap-1">
                                                {inCart > 0 ? (
                                                    <>
                                                        <button
                                                            onClick={() => updateCart(eq, -1)}
                                                            className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                            </svg>
                                                        </button>
                                                        <span className="w-8 text-center font-semibold text-sm">{inCart}</span>
                                                        <button
                                                            onClick={() => updateCart(eq, 1)}
                                                            disabled={inCart >= eq.availableQuantity}
                                                            className="w-8 h-8 flex items-center justify-center bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-300"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => updateCart(eq, 1)}
                                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'borrowable'
                                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                            : 'bg-purple-600 text-white hover:bg-purple-700'
                                                            }`}
                                                    >
                                                        เลือก
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mt-4 p-3 rounded-lg text-sm text-center ${message.includes('ล้มเหลว') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {message}
                    </div>
                )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800">
                                เลือกแล้ว {cart.length} รายการ ({totalItems} ชิ้น)
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                                {cart.map(c => c.name).join(', ')}
                            </div>
                        </div>
                        <button
                            onClick={() => setShowConfirmModal(true)}
                            className={`px-6 py-3 rounded-xl font-semibold text-white transition-colors ${activeTab === 'borrowable'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-purple-600 hover:bg-purple-700'
                                }`}
                        >
                            {activeTab === 'borrowable' ? 'ยืม' : 'เบิก'}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800">
                                ยืนยันการ{activeTab === 'borrowable' ? 'ยืม' : 'เบิก'}
                            </h3>
                        </div>

                        <div className="p-4 max-h-[40vh] overflow-auto">
                            <div className="space-y-2">
                                {cart.map(item => (
                                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                        <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                                            {item.imageUrl ? (
                                                <Image src={item.imageUrl} alt="" width={40} height={40} className="object-cover w-full h-full" unoptimized />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                                        </div>
                                        <div className="text-sm font-semibold text-teal-600">
                                            {item.quantity} {item.unit}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Purpose */}
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    วัตถุประสงค์ (ไม่บังคับ)
                                </label>
                                <textarea
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    placeholder="ระบุวัตถุประสงค์..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                                />
                            </div>
                        </div>

                        {/* Progress */}
                        {isSubmitting && (
                            <div className="px-4 pb-2">
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>กำลังดำเนินการ...</span>
                                    <span>{submitProgress.current}/{submitProgress.total}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-teal-600 h-2 rounded-full transition-all"
                                        style={{ width: `${(submitProgress.current / submitProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="p-4 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isSubmitting}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`flex-1 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${activeTab === 'borrowable'
                                    ? 'bg-blue-600 hover:bg-blue-700'
                                    : 'bg-purple-600 hover:bg-purple-700'
                                    }`}
                            >
                                {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
