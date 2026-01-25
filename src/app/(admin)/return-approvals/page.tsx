"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, runTransaction, Timestamp } from "firebase/firestore";
import Image from 'next/image';
import { useModal } from "@/components/ui/Modal";

interface ReturnRequest {
    id: string;
    equipmentId: string;
    equipmentName: string;
    equipmentImageUrl?: string;
    equipmentCode?: string;
    userName: string;
    userId: string;
    quantity: number;
    unit?: string;
    returnRequestTime?: any;
    borrowTime?: any;
    status: string;
    [key: string]: any;
}

export default function ReturnApprovalsPage() {
    const [requests, setRequests] = useState<ReturnRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [processing, setProcessing] = useState(false);
    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        if (!db) return;

        const q = query(
            collection(db as any, "equipment-usage"),
            where("status", "==", "pending_return")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                returnRequestTime: doc.data().returnRequestTime?.toDate?.() || doc.data().returnRequestTime || new Date(),
                borrowTime: doc.data().borrowTime?.toDate?.() || doc.data().borrowTime,
            })) as ReturnRequest[];

            // Sort by request time desc
            data.sort((a, b) => b.returnRequestTime - a.returnRequestTime);

            setRequests(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Selection handlers
    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === requests.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(requests.map(r => r.id)));
        }
    };

    const toggleSelectUser = (userId: string) => {
        const userRequestIds = requests.filter(r => r.userId === userId).map(r => r.id);
        const allSelected = userRequestIds.every(id => selectedIds.has(id));

        const newSelected = new Set(selectedIds);
        if (allSelected) {
            userRequestIds.forEach(id => newSelected.delete(id));
        } else {
            userRequestIds.forEach(id => newSelected.add(id));
        }
        setSelectedIds(newSelected);
    };

    // Approve Logic
    const handleApprove = async (idsToApprove: string[]) => {
        if (idsToApprove.length === 0) return;

        const confirmed = await showConfirm(
            `ยืนยันการอนุมัติคืน ${idsToApprove.length} รายการ?`,
            { confirmText: 'อนุมัติ', cancelText: 'ยกเลิก' }
        );

        if (!confirmed) return;

        setProcessing(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const id of idsToApprove) {
                try {
                    await runTransaction(db as any, async (transaction) => {
                        const usageRef = doc(db as any, "equipment-usage", id);
                        const usageDoc = await transaction.get(usageRef);

                        if (!usageDoc.exists()) throw new Error("Request not found");
                        const usageData = usageDoc.data();

                        if (usageData.status !== 'pending_return') {
                            console.warn(`Item ${id} status is ${usageData.status}, skipping.`);
                            throw new Error("รายการนี้ถูกยกเลิกหรือดำเนินการไปแล้ว");
                        }

                        const equipmentRef = doc(db as any, "equipment", usageData.equipmentId);
                        const equipmentDoc = await transaction.get(equipmentRef);

                        // Calculate new stock
                        const qtyToReturn = usageData.quantity || 0;
                        let newQty = qtyToReturn;

                        // If equipment exists, add to existing stock
                        if (equipmentDoc.exists()) {
                            const currentStock = equipmentDoc.data().availableQuantity || 0;
                            newQty = currentStock + qtyToReturn;
                        }

                        const equipmentUpdate: any = {
                            availableQuantity: newQty,
                            updatedAt: Timestamp.now()
                        };

                        if (equipmentDoc.exists() && equipmentDoc.data().status === 'out_of_stock' && newQty > 0) {
                            equipmentUpdate.status = 'available';
                        }

                        // Update Usage
                        transaction.update(usageRef, {
                            status: 'returned',
                            returnTime: Timestamp.now(),     // Final confirmed return time
                            approverId: 'admin',
                            updatedAt: Timestamp.now()
                        });

                        // Update Equipment
                        if (equipmentDoc.exists()) {
                            transaction.update(equipmentRef, equipmentUpdate);
                        }
                    });
                    successCount++;
                } catch (e) {
                    console.error(`Failed to approve ${id}:`, e);
                    failCount++;
                }
            }

            if (failCount === 0) {
                showAlert(`อนุมัติสำเร็จ ${successCount} รายการ`, 'success');
                setSelectedIds(new Set()); // Clear selection
            } else {
                showAlert(`สำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ`, 'warning');
            }

        } catch (error) {
            console.error(error);
            showAlert("เกิดข้อผิดพลาดในการประมวลผล", 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Grouping
    const groupedRequests = requests.reduce((acc, req) => {
        if (!acc[req.userId]) {
            acc[req.userId] = {
                user: { name: req.userName, id: req.userId },
                items: []
            };
        }
        acc[req.userId].items.push(req);
        return acc;
    }, {} as Record<string, { user: { name: string, id: string }, items: ReturnRequest[] }>);


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-lg font-bold text-gray-800">อนุมัติการคืน</h1>
                        <p className="text-xs text-gray-500">รอตรวจสอบ {requests.length} รายการ</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                            <span className="text-sm font-medium text-gray-600 hidden md:inline">
                                เลือก <span className="text-teal-600 font-bold">{selectedIds.size}</span> รายการ
                            </span>

                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                ยกเลิก
                            </button>

                            <button
                                onClick={() => handleApprove(Array.from(selectedIds))}
                                disabled={processing}
                                className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
                            >
                                {processing ? '...' : `อนุมัติ (${selectedIds.size})`}
                            </button>
                        </div>
                    )}

                    {requests.length > 0 && selectedIds.size === 0 && (
                        <button
                            onClick={toggleSelectAll}
                            className="text-sm font-medium text-teal-600 hover:text-teal-700 px-3 py-1.5 rounded-md hover:bg-teal-50 transition-colors"
                        >
                            เลือกทั้งหมด
                        </button>
                    )}
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center border border-dashed border-gray-200">
                    <p className="text-sm text-gray-500">ไม่พบรายการรอการตรวจสอบ</p>
                    <p className="text-xs text-gray-400 mt-1">รายการที่แจ้งคืนจะปรากฏที่นี่</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                    {Object.values(groupedRequests).map((group) => {
                        const isAllUserSelected = group.items.every(item => selectedIds.has(item.id));

                        return (
                            <div key={group.user.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                                {/* Group Header */}
                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold shrink-0">
                                            {group.user.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 truncate">{group.user.name}</span>
                                        <span className="text-xs text-gray-400 shrink-0">({group.items.length})</span>
                                    </div>
                                    <button
                                        onClick={() => toggleSelectUser(group.user.id)}
                                        className="text-[10px] text-gray-500 hover:text-teal-600 transition-colors shrink-0"
                                    >
                                        {isAllUserSelected ? 'ยกเลิก' : 'ทั้งหมด'}
                                    </button>
                                </div>

                                {/* Items List */}
                                <div className="divide-y divide-gray-50 flex-1 overflow-y-auto max-h-[400px]">
                                    {group.items.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleSelect(item.id)}
                                            className={`group flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(item.id) ? 'bg-teal-50/40' : ''
                                                }`}
                                        >
                                            {/* Checkbox */}
                                            <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${selectedIds.has(item.id)
                                                ? 'bg-teal-600 border-teal-600'
                                                : 'border-gray-300 bg-white group-hover:border-gray-400'
                                                }`}>
                                                {selectedIds.has(item.id) && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>

                                            {/* Info (No Image) */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="text-sm font-medium text-gray-900 leading-tight">
                                                        {item.equipmentName}
                                                        <span className="text-xs text-gray-400 font-normal ml-1">
                                                            {item.equipmentCode && `(${item.equipmentCode})`}
                                                        </span>
                                                    </div>
                                                    <div className="font-semibold text-teal-700 text-xs bg-teal-50 px-1.5 py-0.5 rounded ml-auto shrink-0">
                                                        {item.quantity} {item.unit || 'ชิ้น'}
                                                    </div>
                                                </div>

                                                <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                                                    <span>ยืม: {new Date(item.borrowTime).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                                                    <span className="text-gray-300">|</span>
                                                    <span>แจ้ง: {new Date(item.returnRequestTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}


        </div>
    );
}
