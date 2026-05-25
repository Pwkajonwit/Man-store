"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import { buildUsageNotificationFlex, sanitizeFlexMessage } from "@/lib/lineFlex";
import { query, collection, where, onSnapshot } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
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
    userId?: string;
    userName?: string;
    requestedByUserId?: string;
    requestedByUserName?: string;
    borrowFor?: boolean;
    borrowerName?: string;
    [key: string]: any;
}

interface UsageGroup {
    key: string;
    title: string;
    subtitle: string;
    items: EquipmentUsage[];
    isBorrowFor: boolean;
}

export default function MyEquipmentPage() {
    const { user, userProfile } = useAuth();
    const { lineSettings } = useAppSettings();
    const router = useRouter();
    const [activeUsages, setActiveUsages] = useState<EquipmentUsage[]>([]);
    const [loading, setLoading] = useState(true);
    const [returningId, setReturningId] = useState<string | null>(null);
    const [returningAll, setReturningAll] = useState(false);
    const [returnItem, setReturnItem] = useState<EquipmentUsage | null>(null);
    const [returnGroup, setReturnGroup] = useState<UsageGroup | null>(null);
    const [returnReason, setReturnReason] = useState("");
    const [returnImageFile, setReturnImageFile] = useState<File | null>(null);
    const [returnImagePreview, setReturnImagePreview] = useState("");
    const returnImageInputRef = useRef<HTMLInputElement | null>(null);
    const { showAlert, showConfirm } = useModal();

    // Get LINE settings from context (loaded once in layout)
    const userChatMessageEnabled = lineSettings.userChatMessage;
    const viewerLineUserId = userProfile?.lineId || '';
    const viewerUserId = viewerLineUserId || user?.uid || '';
    const sendUserFlexMessage = async (
        flexMessage: { altText: string; contents: any },
        options: { forcePush?: boolean; fallbackText?: string } = {}
    ) => {
        if (!viewerUserId) return false;
        const safeFlexMessage = sanitizeFlexMessage(flexMessage);
        let sentWithLiff = false;

        try {
            const liff = (await import('@line/liff')).default;
            if (liff.isInClient()) {
                try {
                    await liff.sendMessages([{ type: 'flex', ...safeFlexMessage } as any]);
                    sentWithLiff = true;
                } catch (flexError) {
                    console.log('LIFF flex message not sent:', flexError);
                    if (options.fallbackText) {
                        await liff.sendMessages([{ type: 'text', text: options.fallbackText }]);
                        sentWithLiff = true;
                    }
                }
            }
        } catch (lineError) {
            console.log('LIFF message not sent, falling back to push:', lineError);
        }

        if (sentWithLiff && !options.forcePush) return true;
        if (!viewerLineUserId) {
            if (options.forcePush) {
                console.log('LINE push fallback skipped: current user has no LINE userId');
            }
            return sentWithLiff;
        }

        const response = await fetch('/api/send-line-flex', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: viewerLineUserId, flexMessage: safeFlexMessage }),
        });

        if (!response.ok) {
            const result = await response.json().catch(() => null);
            console.log('LINE push fallback failed:', result);
            if (options.fallbackText) {
                const textResponse = await fetch('/api/send-line-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: viewerLineUserId, message: options.fallbackText }),
                });
                return textResponse.ok || sentWithLiff;
            }
            return sentWithLiff;
        }

        return true;
    };

    const isBorrowForUsage = (usage: EquipmentUsage) => {
        if (usage.borrowFor === true) return true;
        if (!usage.requestedByUserId || !viewerUserId) return false;
        if (usage.requestedByUserId !== viewerUserId) return false;

        const borrowerName = (usage.borrowerName || '').trim();
        return Boolean(borrowerName) && borrowerName !== (usage.requestedByUserName || '').trim();
    };

    useEffect(() => {
        if (!user && !userProfile) return;
        if (!db) return;

        const userId = userProfile?.lineId || user?.uid;
        if (!userId) return;

        const usageQuery = query(
            collection(db as any, 'equipment-usage'),
            where('status', 'in', ['active', 'pending_return']),
            where('type', '==', 'borrow')
        );

        const unsubscribe = onSnapshot(usageQuery, (snapshot) => {
            const usagesData = snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        borrowTime: data.borrowTime?.toDate?.() || data.borrowTime,
                    } as EquipmentUsage;
                })
                .filter(usage => usage.userId === userId || usage.requestedByUserId === userId)
                .sort((a, b) => {
                    const aTime = a.borrowTime ? new Date(a.borrowTime).getTime() : 0;
                    const bTime = b.borrowTime ? new Date(b.borrowTime).getTime() : 0;
                    return bTime - aTime;
                });
            setActiveUsages(usagesData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userProfile]);

    useEffect(() => {
        return () => {
            if (returnImagePreview) {
                URL.revokeObjectURL(returnImagePreview);
            }
        };
    }, [returnImagePreview]);

    const clearReturnImage = () => {
        if (returnImagePreview) {
            URL.revokeObjectURL(returnImagePreview);
        }
        setReturnImageFile(null);
        setReturnImagePreview("");
        if (returnImageInputRef.current) {
            returnImageInputRef.current.value = "";
        }
    };

    const closeReturnGroupModal = () => {
        if (returningAll) return;
        setReturnGroup(null);
        setReturnReason("");
        clearReturnImage();
    };

    const openReturnItemModal = (usage: EquipmentUsage) => {
        setReturnItem(usage);
        setReturnReason("");
        clearReturnImage();
    };

    const closeReturnItemModal = () => {
        if (returningId) return;
        setReturnItem(null);
        setReturnReason("");
        clearReturnImage();
    };

    const handleReturnImageChange = (file?: File | null) => {
        if (returnImagePreview) {
            URL.revokeObjectURL(returnImagePreview);
        }

        if (!file) {
            setReturnImageFile(null);
            setReturnImagePreview("");
            return;
        }

        setReturnImageFile(file);
        setReturnImagePreview(URL.createObjectURL(file));
    };

    const handleReturn = async (usage: EquipmentUsage) => {
        if (returningId) return;
        setReturningId(usage.id);

        try {
            const uploaded = await uploadReturnImage();
            const { doc, runTransaction, Timestamp } = await import("firebase/firestore");

            await runTransaction(db as any, async (transaction) => {
                const settingRef = doc(db as any, "settings", "equipment");
                const usageRef = doc(db as any, "equipment-usage", usage.id);

                const settingDoc = await transaction.get(settingRef);
                const approvalEnabled = settingDoc.exists()
                    ? settingDoc.data().returnApprovalEnabled ?? true
                    : true;

                const usageDoc = await transaction.get(usageRef);
                if (!usageDoc.exists()) throw new Error("ไม่พบรายการยืม");

                const currentUsage = usageDoc.data();
                if (currentUsage.status !== "active") {
                    throw new Error("รายการนี้ถูกคืนไปแล้ว");
                }

                const returnPayload: any = {
                    returnRequestTime: Timestamp.now(),
                    returnNote: returnReason.trim(),
                    returnAttachmentImageUrl: uploaded.url,
                    returnAttachmentFileName: uploaded.fileName,
                    updatedAt: Timestamp.now(),
                };

                if (approvalEnabled) {
                    transaction.update(usageRef, {
                        ...returnPayload,
                        status: 'pending_return',
                    });
                    return;
                }

                const equipmentRef = doc(db as any, "equipment", currentUsage.equipmentId);
                const equipmentDoc = await transaction.get(equipmentRef);
                const qtyToReturn = currentUsage.quantity || 0;

                transaction.update(usageRef, {
                    ...returnPayload,
                    status: "returned",
                    returnTime: Timestamp.now(),
                    returnQuantity: qtyToReturn,
                    approverId: "auto",
                });

                if (equipmentDoc.exists()) {
                    const equipmentData = equipmentDoc.data();
                    const newAvailableQuantity = (equipmentData.availableQuantity || 0) + qtyToReturn;
                    const updateData: any = {
                        availableQuantity: newAvailableQuantity,
                        updatedAt: Timestamp.now(),
                    };

                    if (equipmentData.status === "out_of_stock" && newAvailableQuantity > 0) {
                        updateData.status = "available";
                    }

                    transaction.update(equipmentRef, updateData);
                }
            });

            showAlert('แจ้งคืนสำเร็จ', 'success');
            setReturnItem(null);
            setReturnReason("");
            clearReturnImage();

            // Send LINE Flex Message (optional - keeping existing logic)
            if (userChatMessageEnabled) {
                try {
                    const now = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                    const fallbackText = [
                        `แจ้งคืนอุปกรณ์สำเร็จ: ${usage.equipmentName}`,
                        ...(isBorrowForUsage(usage) ? [
                            `ผู้ยืม: ${usage.borrowerName || usage.userName || '-'}`,
                            `ทำแทนโดย: ${usage.requestedByUserName || '-'}`,
                        ] : []),
                        `${usage.quantity} ${usage.unit || 'ชิ้น'}`,
                    ].join('\n');
                    const flexMessage = buildUsageNotificationFlex({
                        title: 'แจ้งคืนสำเร็จ (รอตรวจสอบ)',
                        subtitle: '1 รายการ',
                        metaLines: isBorrowForUsage(usage)
                            ? [`ผู้ยืม: ${usage.borrowerName || usage.userName || '-'}`, `ทำแทนโดย: ${usage.requestedByUserName || '-'}`]
                            : [],
                        rows: [{
                            name: usage.equipmentName,
                            quantity: usage.quantity,
                            unit: usage.unit || 'ชิ้น',
                        }],
                        footer: now,
                    });

                    const lineSent = await sendUserFlexMessage(flexMessage, { fallbackText });
                    if (isBorrowForUsage(usage) && !lineSent) {
                        console.log('Borrow-for return LIFF message was not sent. Check LIFF chat scope and Flex payload.');
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

    const handleCancelReturn = async (usage: EquipmentUsage) => {
        if (returningId) return;
        setReturningId(usage.id);

        try {
            const { doc, updateDoc, deleteField } = await import("firebase/firestore");
            const usageRef = doc(db as any, "equipment-usage", usage.id);

            await updateDoc(usageRef, {
                status: 'active',
                returnRequestTime: deleteField(),
                returnNote: deleteField(),
                returnAttachmentImageUrl: deleteField(),
                returnAttachmentFileName: deleteField()
            });

        } catch (error) {
            console.error(error);
            showAlert('ไม่สามารถยกเลิกได้', 'error');
        }
        setReturningId(null);
    };

    const uploadReturnImage = async () => {
        if (!returnImageFile) return { url: "", fileName: "" };

        const extension = returnImageFile.name.split('.').pop() || 'jpg';
        const fileRef = ref(storage, `equipment-return-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
        await uploadBytes(fileRef, returnImageFile);
        const url = await getDownloadURL(fileRef);
        return { url, fileName: returnImageFile.name };
    };

    const handleReturnGroupSubmit = async () => {
        if (!returnGroup || returningAll) return;
        const returnableUsages = returnGroup.items.filter(usage => usage.status === 'active');
        if (returnableUsages.length === 0) return;

        setReturningAll(true);
        let success = 0;
        let fail = 0;
        const returnedItems: { name: string; qty: number; unit: string; borrowFor: boolean; borrowerName?: string; requestedByUserName?: string }[] = [];

        try {
            const uploaded = await uploadReturnImage();
            const { doc, runTransaction, Timestamp } = await import("firebase/firestore");

            for (const usage of returnableUsages) {
                try {
                    await runTransaction(db as any, async (transaction) => {
                        const settingRef = doc(db as any, "settings", "equipment");
                        const usageRef = doc(db as any, "equipment-usage", usage.id);
                        const settingDoc = await transaction.get(settingRef);
                        const approvalEnabled = settingDoc.exists()
                            ? settingDoc.data().returnApprovalEnabled ?? true
                            : true;
                        const usageDoc = await transaction.get(usageRef);

                        if (!usageDoc.exists()) throw new Error("ไม่พบรายการยืม");
                        const currentUsage = usageDoc.data();
                        if (currentUsage.status !== 'active') throw new Error("สถานะรายการไม่ถูกต้อง");

                        const returnPayload: any = {
                            returnRequestTime: Timestamp.now(),
                            returnNote: returnReason.trim(),
                            returnAttachmentImageUrl: uploaded.url,
                            returnAttachmentFileName: uploaded.fileName,
                            updatedAt: Timestamp.now(),
                        };

                        if (approvalEnabled) {
                            transaction.update(usageRef, {
                                ...returnPayload,
                                status: 'pending_return',
                            });
                            return;
                        }

                        const equipmentRef = doc(db as any, "equipment", currentUsage.equipmentId);
                        const equipmentDoc = await transaction.get(equipmentRef);
                        const qtyToReturn = currentUsage.quantity || 0;

                        transaction.update(usageRef, {
                            ...returnPayload,
                            status: "returned",
                            returnTime: Timestamp.now(),
                            returnQuantity: qtyToReturn,
                            approverId: "auto",
                        });

                        if (equipmentDoc.exists()) {
                            const equipmentData = equipmentDoc.data();
                            const newAvailableQuantity = (equipmentData.availableQuantity || 0) + qtyToReturn;
                            const updateData: any = {
                                availableQuantity: newAvailableQuantity,
                                updatedAt: Timestamp.now(),
                            };

                            if (equipmentData.status === "out_of_stock" && newAvailableQuantity > 0) {
                                updateData.status = "available";
                            }

                            transaction.update(equipmentRef, updateData);
                        }
                    });
                    success++;
                    returnedItems.push({
                        name: usage.equipmentName,
                        qty: usage.quantity,
                        unit: usage.unit || 'ชิ้น',
                        borrowFor: isBorrowForUsage(usage),
                        borrowerName: usage.borrowerName || usage.userName,
                        requestedByUserName: usage.requestedByUserName,
                    });
                } catch (error) {
                    console.error("Return group item failed:", usage.id, error);
                    fail++;
                }
            }
        } catch (error) {
            console.error(error);
            fail = returnableUsages.length;
        }

        if (success > 0 && userChatMessageEnabled) {
            try {
                const now = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                const hasBorrowForReturn = returnedItems.some(item => item.borrowFor);
                const fallbackText = [
                    `${hasBorrowForReturn ? 'คืนแทนอุปกรณ์' : 'คืนอุปกรณ์'}สำเร็จ ${success} รายการ`,
                    ...(returnReason.trim() ? [`เหตุผล: ${returnReason.trim()}`] : []),
                    ...returnedItems.map(item => {
                        const borrowForText = item.borrowFor ? ` (ยืมแทน: ${item.borrowerName || '-'} โดย ${item.requestedByUserName || '-'})` : '';
                        return `- ${item.name} ${item.qty} ${item.unit}${borrowForText}`;
                    }),
                ].join('\n');
                const flexMessage = buildUsageNotificationFlex({
                    title: `${hasBorrowForReturn ? 'คืนแทนอุปกรณ์' : 'คืนอุปกรณ์'}สำเร็จ (รอตรวจสอบ)`,
                    subtitle: `${success} รายการ`,
                    metaLines: returnReason.trim() ? [`เหตุผล: ${returnReason.trim()}`] : [],
                    rows: returnedItems.map(item => ({
                        name: item.name,
                        quantity: item.qty,
                        unit: item.unit,
                        detail: item.borrowFor ? `ยืมแทน: ${item.borrowerName || '-'} โดย ${item.requestedByUserName || '-'}` : '',
                    })),
                    footer: now,
                });

                const lineSent = await sendUserFlexMessage(flexMessage, { fallbackText });
                if (hasBorrowForReturn && !lineSent) {
                    console.log('Borrow-for group return LIFF message was not sent. Check LIFF chat scope and Flex payload.');
                }
            } catch (lineError) {
                console.log('LINE message not sent:', lineError);
            }
        }

        setReturningAll(false);
        if (fail === 0) {
            showAlert(`แจ้งคืนสำเร็จ ${success} รายการ (รออนุมัติ)`, 'success');
            closeReturnGroupModal();
        } else {
            showAlert(`สำเร็จ ${success} รายการ, ล้มเหลว ${fail} รายการ`, 'warning');
        }
    };

    const handleReturnAll = async () => {
        const returnableUsages = activeUsages.filter(usage => usage.status === 'active');
        if (returnableUsages.length === 0 || returningAll) return;
        const confirmed = await showConfirm(`ต้องการคืนอุปกรณ์ทั้งหมด ${returnableUsages.length} รายการ?`, { confirmText: 'คืนทั้งหมด', cancelText: 'ยกเลิก' });
        if (!confirmed) return;

        setReturningAll(true);
        let success = 0, fail = 0;
        const returnedItems: { name: string, qty: number, unit: string, borrowFor?: boolean, borrowerName?: string, requestedByUserName?: string }[] = [];

        // Import Firestore functions dynamically
        const { doc, runTransaction, Timestamp } = await import("firebase/firestore");

        for (const usage of returnableUsages) {
            try {
                await runTransaction(db as any, async (transaction) => {
                    // 1. READ Operations first
                    const settingRef = doc(db as any, "settings", "equipment");
                    const usageRef = doc(db as any, "equipment-usage", usage.id);
                    const settingDoc = await transaction.get(settingRef);
                    const approvalEnabled = settingDoc.exists()
                        ? settingDoc.data().returnApprovalEnabled ?? true
                        : true;
                    const usageDoc = await transaction.get(usageRef);

                    if (!usageDoc.exists()) throw new Error("ไม่พบรายการยืม");
                    const currentUsage = usageDoc.data();
                    if (currentUsage.status !== 'active') throw new Error("สถานะรายการไม่ถูกต้อง");

                    if (approvalEnabled) {
                        transaction.update(usageRef, {
                            status: 'pending_return',
                            returnRequestTime: Timestamp.now(),
                            updatedAt: Timestamp.now()
                        });
                        return;
                    }

                    const equipmentRef = doc(db as any, "equipment", currentUsage.equipmentId);
                    const equipmentDoc = await transaction.get(equipmentRef);
                    const qtyToReturn = currentUsage.quantity || 0;

                    transaction.update(usageRef, {
                        status: "returned",
                        returnTime: Timestamp.now(),
                        returnRequestTime: Timestamp.now(),
                        returnQuantity: qtyToReturn,
                        returnNote: "",
                        approverId: "auto",
                        updatedAt: Timestamp.now()
                    });

                    if (equipmentDoc.exists()) {
                        const equipmentData = equipmentDoc.data();
                        const newAvailableQuantity = (equipmentData.availableQuantity || 0) + qtyToReturn;
                        const updateData: any = {
                            availableQuantity: newAvailableQuantity,
                            updatedAt: Timestamp.now(),
                        };

                        if (equipmentData.status === "out_of_stock" && newAvailableQuantity > 0) {
                            updateData.status = "available";
                        }

                        transaction.update(equipmentRef, updateData);
                    }
                });
                success++;
                returnedItems.push({
                    name: usage.equipmentName,
                    qty: usage.quantity,
                    unit: usage.unit || 'ชิ้น',
                    borrowFor: isBorrowForUsage(usage),
                    borrowerName: usage.borrowerName || usage.userName,
                    requestedByUserName: usage.requestedByUserName,
                });
            } catch { fail++; }
        }

        // Send LINE Flex Message for all returned items
        if (success > 0 && userChatMessageEnabled) {
            try {
                const now = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                const hasBorrowForReturn = returnedItems.some(item => item.borrowFor);
                const fallbackText = [
                    `คืนอุปกรณ์สำเร็จ ${success} รายการ`,
                    ...returnedItems.map(item => {
                        const borrowForText = item.borrowFor ? ` (ยืมแทน: ${item.borrowerName || '-'} โดย ${item.requestedByUserName || '-'})` : '';
                        return `- ${item.name} ${item.qty} ${item.unit}${borrowForText}`;
                    }),
                ].join('\n');
                const flexMessage = buildUsageNotificationFlex({
                    title: 'คืนอุปกรณ์ทั้งหมดสำเร็จ',
                    subtitle: `${success} รายการ`,
                    rows: returnedItems.map(item => ({
                        name: item.name,
                        quantity: item.qty,
                        unit: item.unit,
                        detail: item.borrowFor ? `ยืมแทน: ${item.borrowerName || '-'} โดย ${item.requestedByUserName || '-'}` : '',
                    })),
                    footer: now,
                });

                const lineSent = await sendUserFlexMessage(flexMessage, { fallbackText });
                if (hasBorrowForReturn && !lineSent) {
                    console.log('Borrow-for return-all LIFF message was not sent. Check LIFF chat scope and Flex payload.');
                }
            } catch (lineError) {
                console.log('LINE message not sent:', lineError);
            }
        }

        setReturningAll(false);
        if (fail === 0) {
            showAlert(`แจ้งคืนสำเร็จ ${success} รายการ (รออนุมัติ)`, 'success');
        } else {
            showAlert(`สำเร็จ ${success} รายการ, ล้มเหลว ${fail} รายการ`, fail > 0 ? 'warning' : 'success');
        }
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
    };

    const usageGroups = useMemo<UsageGroup[]>(() => {
        const groups = new Map<string, UsageGroup>();

        for (const usage of activeUsages) {
            const borrower = (usage.borrowerName || usage.userName || '').trim();
            const isBorrowFor = isBorrowForUsage(usage);
            const key = isBorrowFor ? `borrow-for:${borrower || usage.userId || 'unknown'}` : 'mine';

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    title: isBorrowFor ? `ยืมแทน: ${borrower || 'ไม่ระบุชื่อ'}` : 'ยืมของฉัน',
                    subtitle: isBorrowFor ? 'รายการที่คุณทำแทนพนักงานคนนี้' : 'รายการที่ผูกกับบัญชีของคุณ',
                    items: [],
                    isBorrowFor,
                });
            }

            groups.get(key)?.items.push(usage);
        }

        return Array.from(groups.values()).sort((a, b) => {
            if (a.key === 'mine') return -1;
            if (b.key === 'mine') return 1;
            return a.title.localeCompare(b.title, 'th');
        });
    }, [activeUsages, viewerUserId]);
    const ownReturnGroup = usageGroups.find(group => group.key === 'mine');
    const ownReturnableCount = ownReturnGroup?.items.filter(item => item.status === 'active').length || 0;

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
                            {ownReturnGroup && ownReturnableCount > 0 && (
                                <button
                                    onClick={() => setReturnGroup(ownReturnGroup)}
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
                    <div className="space-y-4">
                        {usageGroups.map(group => (
                            <section key={group.key} className="space-y-2">
                                {group.isBorrowFor && (
                                    <div className="rounded-xl px-4 py-3 border shadow-sm bg-amber-50 border-amber-100">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className="font-semibold truncate text-amber-900">
                                                    {group.title}
                                                </h3>
                                                <p className="text-xs truncate text-amber-700">
                                                    {group.subtitle}
                                                </p>
                                            </div>
                                            <div className="shrink-0 flex items-center gap-2">
                                                {group.items.some(item => item.status === 'active') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setReturnGroup(group)}
                                                        disabled={returningAll}
                                                        className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50 bg-amber-600 hover:bg-amber-700"
                                                    >
                                                        คืนทั้งหมด
                                                    </button>
                                                )}
                                                <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800">
                                                    {group.items.length} รายการ
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {group.items.map(usage => (
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
                                    {isBorrowForUsage(usage) && (
                                        <p className="text-xs text-amber-700 truncate">
                                            ยืมแทน: {usage.borrowerName || usage.userName || '-'}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>{usage.quantity} {usage.unit}</span>
                                        <span>•</span>
                                        <span>{formatDate(usage.borrowTime)}</span>
                                    </div>
                                </div>

                                {/* Return Button */}
                                {usage.status === 'pending_return' ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
                                            รอตรวจสอบ
                                        </span>
                                        <button
                                            onClick={() => handleCancelReturn(usage)}
                                            disabled={returningId === usage.id}
                                            className="px-3 py-1 text-xs border border-gray-300 font-medium text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            {returningId === usage.id ? '...' : 'ยกเลิก'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => openReturnItemModal(usage)}
                                        disabled={returningId === usage.id}
                                        className="px-6 py-2 text-sm border border-green-600 font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                                    >
                                        {returningId === usage.id ? (
                                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                        ) : 'คืน'}
                                    </button>
                                )}
                            </div>
                                ))}
                            </section>
                        ))}
                    </div>
                )}
            </div>
            {returnItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800">คืนอุปกรณ์</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {returnItem.equipmentName} • {returnItem.quantity} {returnItem.unit || 'ชิ้น'}
                            </p>
                            {isBorrowForUsage(returnItem) && (
                                <p className="text-xs text-amber-700 mt-1">
                                    ยืมแทน: {returnItem.borrowerName || returnItem.userName || '-'}
                                </p>
                            )}
                        </div>

                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    เหตุผล (ไม่บังคับ)
                                </label>
                                <textarea
                                    value={returnReason}
                                    onChange={(e) => setReturnReason(e.target.value)}
                                    rows={3}
                                    placeholder="ระบุเหตุผลหรือรายละเอียดการคืน..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                                />
                            </div>

                            <div>
                                <input
                                    ref={returnImageInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => handleReturnImageChange(e.target.files?.[0])}
                                />
                                <button
                                    type="button"
                                    onClick={() => returnImageInputRef.current?.click()}
                                    className="w-full py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    ถ่ายรูป / แนบรูป
                                </button>
                                {returnImagePreview && (
                                    <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                                        <Image
                                            src={returnImagePreview}
                                            alt="return attachment preview"
                                            width={320}
                                            height={180}
                                            className="w-full max-h-48 object-cover"
                                            unoptimized
                                        />
                                        <button
                                            type="button"
                                            onClick={clearReturnImage}
                                            className="w-full py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            ลบรูปแนบ
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-200 flex gap-3">
                            <button
                                type="button"
                                onClick={closeReturnItemModal}
                                disabled={!!returningId}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReturn(returnItem)}
                                disabled={!!returningId}
                                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                {returningId ? 'กำลังคืน...' : 'ยืนยันคืน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {returnGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800">คืนทั้งหมด</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {returnGroup.title} • {returnGroup.items.filter(item => item.status === 'active').length} รายการ
                            </p>
                        </div>

                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    เหตุผล (ไม่บังคับ)
                                </label>
                                <textarea
                                    value={returnReason}
                                    onChange={(e) => setReturnReason(e.target.value)}
                                    rows={3}
                                    placeholder="ระบุเหตุผลหรือรายละเอียดการคืน..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                                />
                            </div>

                            <div>
                                <input
                                    ref={returnImageInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => handleReturnImageChange(e.target.files?.[0])}
                                />
                                <button
                                    type="button"
                                    onClick={() => returnImageInputRef.current?.click()}
                                    className="w-full py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    ถ่ายรูป / แนบรูป
                                </button>
                                {returnImagePreview && (
                                    <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                                        <Image
                                            src={returnImagePreview}
                                            alt="return attachment preview"
                                            width={320}
                                            height={180}
                                            className="w-full max-h-48 object-cover"
                                            unoptimized
                                        />
                                        <button
                                            type="button"
                                            onClick={clearReturnImage}
                                            className="w-full py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            ลบรูปแนบ
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-200 flex gap-3">
                            <button
                                type="button"
                                onClick={closeReturnGroupModal}
                                disabled={returningAll}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleReturnGroupSubmit}
                                disabled={returningAll}
                                className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                            >
                                {returningAll ? 'กำลังคืน...' : 'ยืนยันคืนทั้งหมด'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
