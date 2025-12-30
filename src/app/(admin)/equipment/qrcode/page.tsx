"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useReactToPrint } from "react-to-print";

// Types
interface Equipment {
    id: string;
    name: string;
    code?: string;
    status: string;
    category?: string;
}

const Icons = {
    ArrowLeft: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
    ),
    Printer: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 001.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008h-.008V10.5zm-3 0h.008v.008h-.008V10.5z" />
        </svg>
    ),
    Check: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
    )
};

export default function QRCodeGeneratorPage() {
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Print ref
    const printRef = useRef<HTMLDivElement>(null);

    // Using simple window.print() or react-to-print. 
    // Since we have a sidebar overlay issue, react-to-print is better.
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'Equipment-QR-Codes',
    });

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

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredEquipment.length && filteredEquipment.length > 0) {
            setSelectedIds(new Set());
        } else {
            const newSelected = new Set(filteredEquipment.map(e => e.id));
            setSelectedIds(newSelected);
        }
    };

    // Filter logic
    const categories = [...new Set(equipment.map(item => item.category).filter((c): c is string => !!c))];
    const filteredEquipment = equipment.filter(item => {
        const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
        const matchSearch = !searchQuery ||
            item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCategory && matchSearch;
    });

    const selectedEquipment = equipment.filter(item => selectedIds.has(item.id));

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Control Panel */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Link href="/equipment" className="text-gray-500 hover:text-gray-700">
                                <Icons.ArrowLeft className="w-6 h-6" />
                            </Link>
                            <h1 className="text-2xl font-bold text-gray-900">สร้าง QR Code</h1>
                        </div>
                        <div className="flex gap-2">
                            <div className="text-sm text-gray-500 flex items-center mr-4">
                                เลือกแล้ว {selectedIds.size} รายการ
                            </div>
                            <button
                                onClick={() => handlePrint && handlePrint()}
                                disabled={selectedIds.size === 0}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                            >
                                <Icons.Printer className="w-5 h-5 mr-2" />
                                สั่งพิมพ์
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ หรือรหัส..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value="all">ทุกหมวดหมู่</option>
                            {categories.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 max-w-7xl mx-auto w-full p-4">

                {/* Checkbox List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center">
                        <input
                            type="checkbox"
                            checked={filteredEquipment.length > 0 && selectedIds.size === filteredEquipment.length}
                            onChange={toggleAll}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5 mr-4"
                        />
                        <span className="font-medium text-gray-700">เลือกทั้งหมด ({filteredEquipment.length})</span>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
                    ) : filteredEquipment.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">ไม่พบรายการ</div>
                    ) : (
                        <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                            {filteredEquipment.map(item => (
                                <div
                                    key={item.id}
                                    className={`flex items-center p-4 hover:bg-gray-50 transition-colors cursor-pointer ${selectedIds.has(item.id) ? 'bg-blue-50' : ''}`}
                                    onClick={() => toggleSelection(item.id)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(item.id)}
                                        onChange={() => { }} // Handle click on parent
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5 mr-4"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">{item.name}</div>
                                        <div className="text-sm text-gray-500 flex gap-2">
                                            {item.code && <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">#{item.code}</span>}
                                            {item.category && <span>• {item.category}</span>}
                                        </div>
                                    </div>
                                    {selectedIds.has(item.id) && (
                                        <Icons.Check className="w-5 h-5 text-blue-600" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Print Preview Area */}
                <div id="print-area">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-900">ตัวอย่างก่อนพิมพ์ ({selectedEquipment.length} รายการ)</h2>
                        <p className="text-sm text-gray-500">เลือกรายการด้านบนเพื่อแสดง QR Code จะปรากฏที่นี่</p>
                    </div>

                    <div className="p-4 bg-white border border-gray-200 rounded-lg min-h-[200px]">
                        {/* THE CONTENT TO PRINT IS WRAPPED HERE */}
                        <div ref={printRef} className="p-4 bg-white">
                            {selectedEquipment.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 print:grid-cols-4 print:gap-4">
                                    {selectedEquipment.map(item => (
                                        <div key={item.id} className="border border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center text-center bg-white print:break-inside-avoid print:border-gray-800">
                                            <div className="mb-2">
                                                <QRCodeSVG
                                                    value={JSON.stringify({ id: item.id, code: item.code })}
                                                    size={100}
                                                    level={"M"}
                                                />
                                            </div>
                                            <div className="text-sm font-bold text-gray-900 line-clamp-1 w-full">{item.name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{item.code || item.id.substring(0, 8)}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center w-full h-40 text-gray-400 border-2 border-dashed border-gray-100 rounded">
                                    ยังไม่ได้เลือกรายการ
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
