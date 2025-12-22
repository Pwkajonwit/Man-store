"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import Image from 'next/image';
import { useModal } from '@/components/ui/Modal';

// Types
interface Equipment {
    id: string;
    name: string;
    code?: string;
    type?: 'borrowable' | 'consumable';
    status: string;
    category?: string;
    location?: string;
    imageUrl?: string;
    availableQuantity: number;
    quantity: number;
    unit: string;
}

interface RepairReport {
    id: string;
    equipmentId: string;
    status: string;
    problemNote: string;
    reporterName: string;
}

// --- Icons ---
const Icons = {
    Tool: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
    ),
    Plus: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    PencilSquare: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
    ),
    Trash: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
    ),
    Box: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
    ),
    Repeat: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
        </svg>
    ),
    Eye: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
};

// --- Helper Functions ---
const getStatusConfig = (status: string) => {
    switch (status) {
        case "available":
        case "active":
            return { label: "พร้อมใช้งาน", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" };
        case "in_use":
            return { label: "ถูกยืม", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" };
        case "low_stock":
            return { label: "ใกล้หมด", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
        case "out_of_stock":
            return { label: "หมด", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
        case "damaged":
            return { label: "ชำรุด", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
        case "repairing":
            return { label: "กำลังซ่อม", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
        case "lost":
            return { label: "หาย", bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-300" };
        case "retired":
            return { label: "ยกเลิกใช้งาน", bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-300" };
        default:
            return { label: status || "ไม่ระบุ", bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
    }
};

const getTypeConfig = (type?: string) => {
    switch (type) {
        case "borrowable":
            return { label: "ยืม-คืน", icon: Icons.Repeat, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
        case "consumable":
            return { label: "เบิก", icon: Icons.Box, bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" };
        default:
            return { label: type || "ไม่ระบุ", icon: Icons.Tool, bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
    }
};

// --- Components ---
interface ActionButtonProps {
    href?: string;
    onClick?: () => void;
    icon: any;
    colorClass: string;
    label: string;
}

function ActionButton({ href, onClick, icon: Icon, colorClass, label }: ActionButtonProps) {
    if (href) {
        return (
            <Link href={href} className={`p-2 rounded-lg transition-colors ${colorClass} group relative`} title={label}>
                <Icon className="w-4 h-4" />
                <span className="sr-only">{label}</span>
            </Link>
        );
    }
    return (
        <button onClick={onClick} className={`p-2 rounded-lg transition-colors ${colorClass} group relative`} title={label}>
            <Icon className="w-4 h-4" />
            <span className="sr-only">{label}</span>
        </button>
    );
}

interface EquipmentTableProps {
    equipment: Equipment[];
    onDelete: (id: string) => void;
    repairReports: RepairReport[];
}

function EquipmentTable({ equipment, onDelete, repairReports }: EquipmentTableProps) {
    return (
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">อุปกรณ์</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภท</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวน</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมวดหมู่</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {equipment.map((item) => {
                        const status = getStatusConfig(item.status);
                        const typeConfig = getTypeConfig(item.type);
                        const report = repairReports.find(r => r.equipmentId === item.id && r.status === 'pending');
                        return (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="h-12 w-12 flex-shrink-0 relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                                            {item.imageUrl ? (
                                                <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized />
                                            ) : (
                                                <div className="flex items-center justify-center h-full w-full text-gray-400">
                                                    <Icons.Tool className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                            {item.code && (
                                                <div className="text-xs text-gray-500">รหัส: {item.code}</div>
                                            )}
                                            {report && (item.status === 'damaged' || item.status === 'repairing') && (
                                                <div className="mt-1 flex items-start gap-1">
                                                    <svg className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    <div className="text-xs text-red-600 line-clamp-2">{report.problemNote}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}>
                                        <typeConfig.icon className="w-3 h-3" />
                                        {typeConfig.label}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm">
                                        <span className="font-medium text-gray-900">{item.availableQuantity || 0}</span>
                                        <span className="text-gray-500">/{item.quantity || 0} {item.unit}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.bg} ${status.text} ${status.border}`}>
                                            {status.label}
                                        </span>
                                        {report && (item.status === 'damaged' || item.status === 'repairing') && (
                                            <div className="mt-1 text-xs text-gray-500">แจ้งโดย: {report.reporterName}</div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {item.category || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-2">
                                        <ActionButton href={`/equipment/${item.id}`} icon={Icons.PencilSquare} colorClass="bg-teal-50 text-teal-600 hover:bg-teal-100" label="แก้ไข" />
                                        <ActionButton href={`/equipment/${item.id}/history`} icon={Icons.Eye} colorClass="bg-blue-50 text-blue-600 hover:bg-blue-100" label="ประวัติ" />
                                        <ActionButton onClick={() => onDelete(item.id)} icon={Icons.Trash} colorClass="bg-red-50 text-red-600 hover:bg-red-100" label="ลบ" />
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function EquipmentCards({ equipment, onDelete, repairReports }: EquipmentTableProps) {
    return (
        <div className="md:hidden grid grid-cols-1 gap-4">
            {equipment.map((item) => {
                const status = getStatusConfig(item.status);
                const typeConfig = getTypeConfig(item.type);
                const report = repairReports.find(r => r.equipmentId === item.id && r.status === 'pending');
                return (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex gap-4">
                            <div className="h-16 w-16 flex-shrink-0 relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                                {item.imageUrl ? (
                                    <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized />
                                ) : (
                                    <div className="flex items-center justify-center h-full w-full text-gray-400">
                                        <Icons.Tool className="w-8 h-8" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-900 truncate">{item.name}</h3>
                                        {item.code && (
                                            <div className="text-xs text-gray-500">รหัส: {item.code}</div>
                                        )}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${status.bg} ${status.text} ${status.border}`}>
                                        {status.label}
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}>
                                        <typeConfig.icon className="w-3 h-3" />
                                        {typeConfig.label}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                        {item.availableQuantity || 0}/{item.quantity || 0} {item.unit}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* แสดงอาการที่แจ้งซ่อม */}
                        {report && (item.status === 'damaged' || item.status === 'repairing') && (
                            <div className="mt-3 p-2.5 bg-red-50 border border-red-100 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex-1">
                                        <div className="text-xs font-medium text-red-700">อาการที่แจ้ง:</div>
                                        <div className="text-xs text-red-600 mt-0.5">{report.problemNote}</div>
                                        <div className="text-[10px] text-red-400 mt-1">แจ้งโดย: {report.reporterName}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-3 gap-2">
                            <Link href={`/equipment/${item.id}`} className="flex flex-col items-center justify-center p-2 rounded bg-gray-50 text-gray-600 hover:bg-gray-100">
                                <Icons.PencilSquare className="w-4 h-4" />
                                <span className="text-[10px] mt-1">แก้ไข</span>
                            </Link>
                            <Link href={`/equipment/${item.id}/history`} className="flex flex-col items-center justify-center p-2 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">
                                <Icons.Eye className="w-4 h-4" />
                                <span className="text-[10px] mt-1">ประวัติ</span>
                            </Link>
                            <button onClick={() => onDelete(item.id)} className="flex flex-col items-center justify-center p-2 rounded bg-red-50 text-red-600 hover:bg-red-100">
                                <Icons.Trash className="w-4 h-4" />
                                <span className="text-[10px] mt-1">ลบ</span>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function EquipmentPage() {
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [repairReports, setRepairReports] = useState<RepairReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState('all');
    const { showAlert, showConfirm } = useModal();

    // CSV Import States
    const [showCsvModal, setShowCsvModal] = useState(false);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvPreview, setCsvPreview] = useState<any[]>([]);
    const [csvImporting, setCsvImporting] = useState(false);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db as any, "equipment"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const equipmentData: Equipment[] = [];
            querySnapshot.forEach((doc) => {
                equipmentData.push({ id: doc.id, ...doc.data() } as Equipment);
            });
            equipmentData.sort((a, b) => a.name.localeCompare(b.name));
            setEquipment(equipmentData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // โหลดรายการแจ้งซ่อม
    useEffect(() => {
        if (!db) return;
        const unsubscribe = onSnapshot(collection(db as any, 'repair-reports'), (snapshot) => {
            const reports = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as RepairReport));
            setRepairReports(reports);
        });

        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string) => {
        if (!db) return;
        const confirmed = await showConfirm('ยืนยันการลบอุปกรณ์นี้?', { confirmText: 'ลบ', cancelText: 'ยกเลิก' });
        if (!confirmed) return;
        try {
            await deleteDoc(doc(db as any, "equipment", id));
            showAlert('ลบสำเร็จ', 'success');
        } catch (err) {
            console.error('Delete error:', err);
            showAlert('เกิดข้อผิดพลาดในการลบ', 'error');
        }
    };

    // --- CSV Import Functions ---
    const downloadSampleCsv = () => {
        const sampleData = [
            ['name', 'code', 'type', 'category', 'location', 'quantity', 'unit', 'description'],
            ['สว่านไฟฟ้า', 'DRILL-001', 'borrowable', 'เครื่องมือไฟฟ้า', 'ห้องเก็บของ A', '5', 'ตัว', 'สว่านไฟฟ้า Bosch 500W'],
            ['ประแจ 10 นิ้ว', 'WRENCH-001', 'borrowable', 'เครื่องมือช่าง', 'ห้องเก็บของ A', '10', 'อัน', 'ประแจปากตาย'],
            ['น็อตสกรู M8', 'SCREW-M8', 'consumable', 'วัสดุสิ้นเปลือง', 'ห้องเก็บของ B', '500', 'ตัว', 'น็อตสกรู M8 x 30mm'],
            ['เทปพันสายไฟ', 'TAPE-001', 'consumable', 'วัสดุสิ้นเปลือง', 'ห้องเก็บของ B', '50', 'ม้วน', 'เทปพันสายไฟสีดำ'],
        ];
        const csvContent = sampleData.map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Thai support
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'equipment_template.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCsvFile(file);

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                showAlert('ไฟล์ CSV ไม่มีข้อมูล', 'error');
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const requiredHeaders = ['name', 'type', 'quantity', 'unit'];
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
                showAlert(`ไม่พบคอลัมน์ที่จำเป็น: ${missingHeaders.join(', ')}`, 'error');
                setCsvFile(null);
                return;
            }

            const data = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim());
                const obj: any = {};
                headers.forEach((h, i) => {
                    obj[h] = values[i] || '';
                });
                return obj;
            }).filter(item => item.name); // Filter out empty rows

            setCsvPreview(data);
        };
        reader.readAsText(file);
    };

    const handleCsvImport = async () => {
        if (csvPreview.length === 0) return;
        if (!db) return;

        setCsvImporting(true);
        let success = 0, fail = 0;

        const { addDoc, collection: firestoreCollection, Timestamp } = await import('firebase/firestore');

        for (const item of csvPreview) {
            try {
                const qty = parseInt(item.quantity) || 0;
                await addDoc(firestoreCollection(db, 'equipment'), {
                    name: item.name,
                    code: item.code || '',
                    type: item.type === 'consumable' ? 'consumable' : 'borrowable',
                    category: item.category || '',
                    location: item.location || '',
                    quantity: qty,
                    availableQuantity: qty,
                    unit: item.unit || 'ชิ้น',
                    description: item.description || '',
                    status: 'available',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
                success++;
            } catch (err) {
                console.error('Import error:', err);
                fail++;
            }
        }

        setCsvImporting(false);
        setShowCsvModal(false);
        setCsvFile(null);
        setCsvPreview([]);

        if (fail === 0) {
            showAlert(`นำเข้าสำเร็จ ${success} รายการ`, 'success');
        } else {
            showAlert(`สำเร็จ ${success} รายการ, ล้มเหลว ${fail} รายการ`, 'warning');
        }
    };

    // Get unique categories and locations
    const categories: string[] = [...new Set(equipment.map(item => item.category).filter((c): c is string => !!c))];
    const locations: string[] = [...new Set(equipment.map(item => item.location).filter((l): l is string => !!l))];

    // Filter equipment
    const filteredEquipment = equipment.filter(item => {
        const matchType = activeTab === 'all' || item.type === activeTab;
        const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
        const matchLocation = locationFilter === 'all' || item.location === locationFilter;
        const matchSearch = !searchQuery ||
            item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchType && matchCategory && matchLocation && matchSearch;
    });

    // Count by type
    const borrowableCount = equipment.filter(item => item.type === 'borrowable').length;
    const consumableCount = equipment.filter(item => item.type === 'consumable').length;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">อุปกรณ์ช่าง</h1>
                    <p className="text-gray-500 text-sm mt-1">จัดการอุปกรณ์และวัสดุสำหรับยืม-คืน และเบิก</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCsvModal(true)}
                        className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                    >
                        <svg className="w-5 h-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        นำเข้า CSV
                    </button>
                    <Link
                        href="/equipment/add"
                        className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                    >
                        <Icons.Plus className="w-5 h-5 mr-1.5" />
                        เพิ่มอุปกรณ์ใหม่
                    </Link>
                </div>
            </div>

            {/* CSV Import Modal */}
            {showCsvModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => { setShowCsvModal(false); setCsvFile(null); setCsvPreview([]); }} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">นำเข้าอุปกรณ์จาก CSV</h3>
                            <p className="text-sm text-gray-500 mt-1">อัพโหลดไฟล์ CSV เพื่อเพิ่มอุปกรณ์หลายรายการพร้อมกัน</p>
                        </div>

                        <div className="p-5 overflow-y-auto max-h-[calc(90vh-200px)]">
                            {/* Download Sample */}
                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="flex-1">
                                        <p className="text-sm text-blue-800 font-medium">ต้องการตัวอย่างไฟล์?</p>
                                        <p className="text-xs text-blue-600 mt-1">ดาวน์โหลดไฟล์ตัวอย่างเพื่อดูรูปแบบที่ถูกต้อง</p>
                                        <button
                                            onClick={downloadSampleCsv}
                                            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            ดาวน์โหลด CSV ตัวอย่าง
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* File Input */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">เลือกไฟล์ CSV</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleCsvFileChange}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                                />
                            </div>

                            {/* Preview */}
                            {csvPreview.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium text-gray-700">ตัวอย่างข้อมูล ({csvPreview.length} รายการ)</h4>
                                    </div>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500">ชื่อ</th>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500">รหัส</th>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500">ประเภท</th>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500">จำนวน</th>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500">หน่วย</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-100">
                                                {csvPreview.slice(0, 10).map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-3 py-2 text-gray-900">{item.name}</td>
                                                        <td className="px-3 py-2 text-gray-500">{item.code || '-'}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.type === 'consumable' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                                                                {item.type === 'consumable' ? 'เบิก' : 'ยืม-คืน'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-900">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {csvPreview.length > 10 && (
                                            <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center">
                                                ... และอีก {csvPreview.length - 10} รายการ
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-5 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => { setShowCsvModal(false); setCsvFile(null); setCsvPreview([]); }}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleCsvImport}
                                disabled={csvPreview.length === 0 || csvImporting}
                                className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                            >
                                {csvImporting ? 'กำลังนำเข้า...' : `นำเข้า ${csvPreview.length} รายการ`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all'
                        ? 'border-teal-600 text-teal-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    ทั้งหมด ({equipment.length})
                </button>
                <button
                    onClick={() => setActiveTab('borrowable')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'borrowable'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <span className="inline-flex items-center gap-1">
                        <Icons.Repeat className="w-4 h-4" />
                        ยืม-คืน ({borrowableCount})
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('consumable')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'consumable'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <span className="inline-flex items-center gap-1">
                        <Icons.Box className="w-4 h-4" />
                        เบิก ({consumableCount})
                    </span>
                </button>
            </div>

            {/* Search & Category Filter */}
            <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาชื่อ, รหัสอุปกรณ์..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="all">ทุกหมวดหมู่</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="all">ทุกสถานที่เก็บ</option>
                    {locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                    ))}
                </select>
                {(searchQuery || categoryFilter !== 'all' || locationFilter !== 'all') && (
                    <button
                        onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setLocationFilter('all'); }}
                        className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                        ล้าง
                    </button>
                )}
            </div>

            {/* Results Count */}
            {(searchQuery || categoryFilter !== 'all' || locationFilter !== 'all') && (
                <p className="text-sm text-gray-500 mb-3">พบ {filteredEquipment.length} รายการ</p>
            )}

            {loading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredEquipment.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icons.Tool className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">ยังไม่มีอุปกรณ์ในระบบ</h3>
                    <p className="text-gray-500 mt-1">เริ่มต้นด้วยการเพิ่มอุปกรณ์แรกของคุณ</p>
                </div>
            ) : (
                <>
                    <EquipmentTable equipment={filteredEquipment} onDelete={handleDelete} repairReports={repairReports} />
                    <EquipmentCards equipment={filteredEquipment} onDelete={handleDelete} repairReports={repairReports} />
                </>
            )}
        </div>
    );
}
