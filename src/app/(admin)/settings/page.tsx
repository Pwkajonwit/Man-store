"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { checkAllIndexes, IndexCheckResult } from "@/lib/indexChecker";

// รายการ Index ที่จำเป็นสำหรับระบบ
// (kept here for reference/UI usage if needed, though checkAllIndexes imports the real list)
const REQUIRED_INDEXES = [
    {
        id: 1,
        collection: "equipment-usage",
        fields: ["userId", "status", "type"],
        description: "สำหรับดูอุปกรณ์ที่กำลังยืมของผู้ใช้",
        page: "my-equipment"
    },
    {
        id: 2,
        collection: "equipment-usage",
        fields: ["status", "type"],
        description: "สำหรับดูรายการกำลังยืมทั้งหมด",
        page: "equipment-analysis"
    },
    {
        id: 3,
        collection: "equipment-usage",
        fields: ["borrowTime (desc)"],
        description: "สำหรับประวัติการยืม-เบิกเรียงตามวันที่",
        page: "equipment-history"
    },
    {
        id: 4,
        collection: "repairs",
        fields: ["createdAt (desc)"],
        description: "สำหรับรายการซ่อมเรียงตามวันที่",
        page: "repairs"
    },
    {
        id: 5,
        collection: "repair-reports",
        fields: ["reportedBy", "createdAt (desc)"],
        description: "สำหรับดูรายการแจ้งซ่อมของผู้ใช้",
        page: "report-repair"
    },
    {
        id: 6,
        collection: "equipment-usage",
        fields: ["equipmentId", "borrowTime (desc)"],
        description: "สำหรับดูประวัติการยืมเบิกของอุปกรณ์เฉพาะตัว",
        page: "equipment/[id]/history"
    },
    {
        id: 7,
        collection: "users",
        fields: ["name (asc)"],
        description: "สำหรับรายชื่อพนักงานเรียงตามชื่อ",
        page: "users"
    },
];

// สร้าง firestore.indexes.json content
const generateIndexesJSON = () => {
    const indexes = [
        {
            collectionGroup: "equipment-usage",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "userId", order: "ASCENDING" },
                { fieldPath: "status", order: "ASCENDING" },
                { fieldPath: "type", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "equipment-usage",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "status", order: "ASCENDING" },
                { fieldPath: "type", order: "ASCENDING" }
            ]
        },
        {
            collectionGroup: "equipment-usage",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "borrowTime", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "repairs",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "createdAt", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "repair-reports",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "reportedBy", order: "ASCENDING" },
                { fieldPath: "createdAt", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "equipment-usage",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "equipmentId", order: "ASCENDING" },
                { fieldPath: "borrowTime", order: "DESCENDING" }
            ]
        },
        {
            collectionGroup: "users",
            queryScope: "COLLECTION",
            fields: [
                { fieldPath: "name", order: "ASCENDING" }
            ]
        },
    ];

    return JSON.stringify({ indexes, fieldOverrides: [] }, null, 2);
};

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [testingNotification, setTestingNotification] = useState(false);
    // const [showIndexes, setShowIndexes] = useState(false); // Unused
    // const [firebaseProjectId, setFirebaseProjectId] = useState(""); // Unused

    // Index Checker State
    const [checkingIndexes, setCheckingIndexes] = useState(false);
    const [indexResults, setIndexResults] = useState<IndexCheckResult[]>([]);
    const [showIndexModal, setShowIndexModal] = useState(false);

    const [categories, setCategories] = useState<string[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [newCategory, setNewCategory] = useState("");
    const [newLocation, setNewLocation] = useState("");

    // LINE settings (Group ID only, Token from .env)
    const [lineConfig, setLineConfig] = useState({
        enabled: false,
        groupId: "",
        dailyReportTime: "08:00",
        notifyOverdue: true,
        notifyLowStock: true,
        notifyDamaged: true,
        userChatMessage: true,
        notifyRepairReport: true,
        notifyRepairCompleted: true,
    });

    // Load settings
    useEffect(() => {
        async function loadSettings() {
            try {
                if (!db) return;
                const equipDocRef = doc(db, "settings", "equipment");
                const equipDocSnap = await getDoc(equipDocRef);
                if (equipDocSnap.exists()) {
                    const data = equipDocSnap.data();
                    setCategories(data.categories || []);
                    setLocations(data.locations || []);
                } else {
                    setCategories(['เครื่องมือไฟฟ้า', 'เครื่องมือช่าง', 'อุปกรณ์วัด', 'อุปกรณ์ความปลอดภัย', 'วัสดุสิ้นเปลือง', 'อะไหล่', 'ทั่วไป']);
                    setLocations(['ชั้น A-1', 'ชั้น A-2', 'ชั้น B-1', 'ห้องเก็บของ', 'โกดัง']);
                }

                const notifyDocRef = doc(db, "settings", "notifications");
                const notifyDocSnap = await getDoc(notifyDocRef);
                if (notifyDocSnap.exists()) {
                    const data = notifyDocSnap.data();
                    setLineConfig({
                        enabled: data.line?.enabled || false,
                        groupId: data.line?.groupId || "",
                        dailyReportTime: data.line?.dailyReportTime || "08:00",
                        notifyOverdue: data.line?.notifyOverdue ?? true,
                        notifyLowStock: data.line?.notifyLowStock ?? true,
                        notifyDamaged: data.line?.notifyDamaged ?? true,
                        userChatMessage: data.line?.userChatMessage ?? true,
                        notifyRepairReport: data.line?.notifyRepairReport ?? true,
                        notifyRepairCompleted: data.line?.notifyRepairCompleted ?? true,
                    });
                }
            } catch (error) {
                console.error("Error loading settings:", error);
            }
            setLoading(false);
        }
        loadSettings();
    }, []);

    const handleSave = async () => {
        if (!db) return;
        setSaving(true);
        setMessage("");
        try {
            const equipDocRef = doc(db, "settings", "equipment");
            await setDoc(equipDocRef, { categories, locations, updatedAt: new Date() }, { merge: true });

            const notifyDocRef = doc(db, "settings", "notifications");
            await setDoc(notifyDocRef, { line: lineConfig, updatedAt: new Date() }, { merge: true });

            setMessage("บันทึกสำเร็จ!");
        } catch (error) {
            console.error("Error saving:", error);
            setMessage("เกิดข้อผิดพลาด");
        }
        setSaving(false);
    };

    const testLineMessage = async () => {
        if (!lineConfig.groupId) {
            setMessage("กรุณาใส่ Group ID");
            return;
        }
        setTestingNotification(true);
        try {
            const res = await fetch("/api/notifications/test-line", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupId: lineConfig.groupId }),
            });
            const result = await res.json();
            if (result.success) {
                setMessage("ส่งข้อความทดสอบสำเร็จ! ตรวจสอบ LINE Group");
            } else {
                setMessage("ส่งไม่สำเร็จ: " + (result.error || "ข้อมูลไม่ถูกต้อง"));
            }
        } catch (error) {
            setMessage("เกิดข้อผิดพลาดในการทดสอบ");
        }
        setTestingNotification(false);
    };

    const addCategory = () => {
        if (newCategory.trim() && !categories.includes(newCategory.trim())) {
            setCategories([...categories, newCategory.trim()]);
            setNewCategory("");
        }
    };

    const removeCategory = (cat: string) => setCategories(categories.filter(c => c !== cat));

    const addLocation = () => {
        if (newLocation.trim() && !locations.includes(newLocation.trim())) {
            setLocations([...locations, newLocation.trim()]);
            setNewLocation("");
        }
    };

    const removeLocation = (loc: string) => setLocations(locations.filter(l => l !== loc));

    // Download indexes JSON file
    const downloadIndexesFile = () => {
        const content = generateIndexesJSON();
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'firestore.indexes.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Copy indexes JSON to clipboard
    const copyIndexesToClipboard = () => {
        const content = generateIndexesJSON();
        navigator.clipboard.writeText(content);
        setMessage("คัดลอก JSON สำเร็จ!");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin h-8 w-8 border-3 border-teal-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าระบบ</h1>
                    <p className="text-sm text-gray-500">กำหนดหมวดหมู่ ตำแหน่งจัดเก็บ และการแจ้งเตือน</p>
                </div>
                <div className="flex items-center gap-4">
                    {message && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${message.includes('สำเร็จ') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {message}
                        </div>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400 shadow-sm transition-colors"
                    >
                        {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                    </button>
                </div>
            </div>

            {/* 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                    {/* LINE Messaging API */}
                    <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-green-500">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="font-semibold text-gray-800">LINE Messaging API</h2>
                                <p className="text-xs text-gray-500">แจ้งเตือนไปยัง LINE Group</p>
                            </div>
                            <button
                                onClick={() => setLineConfig({ ...lineConfig, enabled: !lineConfig.enabled })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${lineConfig.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${lineConfig.enabled ? 'translate-x-6' : ''}`}></span>
                            </button>
                        </div>

                        {lineConfig.enabled && (
                            <div className="space-y-4 pt-2 border-t border-gray-100">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Group ID</label>
                                    <input
                                        type="text"
                                        value={lineConfig.groupId}
                                        onChange={(e) => setLineConfig({ ...lineConfig, groupId: e.target.value })}
                                        placeholder="C1234567890abcdef..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">เชิญ Bot เข้า Group แล้วจะได้ Group ID</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">เวลาส่งรายงานประจำวัน</label>
                                    <input
                                        type="time"
                                        value={lineConfig.dailyReportTime}
                                        onChange={(e) => setLineConfig({ ...lineConfig, dailyReportTime: e.target.value })}
                                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-1">
                                    <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input type="checkbox" checked={lineConfig.notifyOverdue} onChange={(e) => setLineConfig({ ...lineConfig, notifyOverdue: e.target.checked })} className="w-4 h-4 text-green-500 rounded" />
                                        <span className="text-sm text-gray-600">⏰ อุปกรณ์เกินกำหนดคืน</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input type="checkbox" checked={lineConfig.notifyLowStock} onChange={(e) => setLineConfig({ ...lineConfig, notifyLowStock: e.target.checked })} className="w-4 h-4 text-green-500 rounded" />
                                        <span className="text-sm text-gray-600">📦 อุปกรณ์ใกล้หมดสต็อก</span>
                                    </label>
                                    <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input type="checkbox" checked={lineConfig.notifyDamaged} onChange={(e) => setLineConfig({ ...lineConfig, notifyDamaged: e.target.checked })} className="w-4 h-4 text-green-500 rounded" />
                                        <span className="text-sm text-gray-600">🔧 อุปกรณ์ชำรุด</span>
                                    </label>
                                </div>

                                <button
                                    onClick={testLineMessage}
                                    disabled={testingNotification || !lineConfig.groupId}
                                    className="w-full py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50"
                                >
                                    {testingNotification ? 'กำลังส่ง...' : '🧪 ทดสอบส่งข้อความ (Admin Group)'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* User Chat Message */}
                    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <span className="text-xl">💬</span>
                                </div>
                                <div>
                                    <h2 className="font-semibold text-gray-800">ส่งข้อความในแชทผู้ใช้</h2>
                                    <p className="text-xs text-gray-500">ยืนยันการยืม/คืน ทาง LINE ส่วนตัว</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={lineConfig.userChatMessage}
                                    onChange={(e) => setLineConfig({ ...lineConfig, userChatMessage: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                        </div>

                        <div className={`p-4 rounded-lg ${lineConfig.userChatMessage ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
                            <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${lineConfig.userChatMessage ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                                    {lineConfig.userChatMessage ? '✓' : '○'}
                                </div>
                                <div>
                                    <p className={`text-sm font-medium ${lineConfig.userChatMessage ? 'text-blue-700' : 'text-gray-600'}`}>
                                        {lineConfig.userChatMessage ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {lineConfig.userChatMessage
                                            ? 'เมื่อพนักงานยืม/คืนอุปกรณ์ ระบบจะส่งข้อความยืนยันไปยังแชท LINE ของพนักงานโดยอัตโนมัติ'
                                            : 'ระบบจะไม่ส่งข้อความยืนยันไปยังแชท LINE ของพนักงาน'}
                                    </p>
                                    <p className="text-xs text-green-600 mt-2 font-medium">✨ ฟรี! ไม่เสียโควต้า LINE Messaging API</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Repair Notifications */}
                    <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-500">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <span className="text-xl">🔧</span>
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-800">แจ้งเตือนการซ่อม</h2>
                                <p className="text-xs text-gray-500">ส่งข้อความแจ้งเตือนเมื่อแจ้งซ่อม/ซ่อมเสร็จ</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* Notify when repair is reported */}
                            <label className="flex items-center justify-between p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 border border-green-100">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">📢</span>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">แจ้งเตือนเมื่อแจ้งซ่อม</p>
                                        <p className="text-xs text-green-600">✨ ฟรี! ส่งข้อความยืนยันไปยังแชทผู้แจ้ง</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setLineConfig({ ...lineConfig, notifyRepairReport: !lineConfig.notifyRepairReport })}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${lineConfig.notifyRepairReport ? 'bg-amber-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${lineConfig.notifyRepairReport ? 'translate-x-5' : ''}`}></span>
                                </button>
                            </label>

                            {/* Notify when repair is completed */}
                            <label className="flex items-center justify-between p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 border border-orange-100">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">✅</span>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">แจ้งเตือนเมื่อซ่อมเสร็จ</p>
                                        <p className="text-xs text-orange-600">⚠️ เสียโควต้า Push Message (ส่งหลังจากซ่อมเสร็จ)</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setLineConfig({ ...lineConfig, notifyRepairCompleted: !lineConfig.notifyRepairCompleted })}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${lineConfig.notifyRepairCompleted ? 'bg-amber-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${lineConfig.notifyRepairCompleted ? 'translate-x-5' : ''}`}></span>
                                </button>
                            </label>

                            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                                <p><span className="text-green-600 font-medium">Reply Message</span> = ตอบทันที (ฟรี)</p>
                                <p><span className="text-orange-600 font-medium">Push Message</span> = ส่งข้อความใหม่ (เสียโควต้า)</p>
                            </div>
                        </div>
                    </div>


                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Categories */}
                    <div className="bg-white rounded-xl shadow-sm p-5">
                        <h2 className="font-semibold text-gray-800 mb-3">📦 หมวดหมู่อุปกรณ์</h2>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                                placeholder="เพิ่มหมวดหมู่ใหม่..."
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            <button onClick={addCategory} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                                เพิ่ม
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                            {categories.map((cat, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                                    {cat}
                                    <button onClick={() => removeCategory(cat)} className="text-gray-400 hover:text-red-500">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Locations */}
                    <div className="bg-white rounded-xl shadow-sm p-5">
                        <h2 className="font-semibold text-gray-800 mb-3">📍 ตำแหน่งจัดเก็บ</h2>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newLocation}
                                onChange={(e) => setNewLocation(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addLocation()}
                                placeholder="เพิ่มตำแหน่งจัดเก็บใหม่..."
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            <button onClick={addLocation} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                                เพิ่ม
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                            {locations.map((loc, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                    {loc}
                                    <button onClick={() => removeLocation(loc)} className="text-blue-400 hover:text-red-500">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                    {/* Firestore Indexes */}
                    <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-orange-500">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="font-semibold text-gray-800">Firestore Indexes</h2>
                                <p className="text-xs text-gray-500">ตรวจสอบและสร้าง Composite Indexes ที่จำเป็น</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={async () => {
                                    setCheckingIndexes(true);
                                    try {
                                        const results = await checkAllIndexes();
                                        setIndexResults(results);
                                        setShowIndexModal(true);
                                    } catch (error) {
                                        console.error("Error checking indexes:", error);
                                        setMessage("เกิดข้อผิดพลาดในการตรวจสอบ Indexes");
                                    } finally {
                                        setCheckingIndexes(false);
                                    }
                                }}
                                disabled={checkingIndexes}
                                className="w-full py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {checkingIndexes ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        กำลังตรวจสอบ...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                        </svg>
                                        ตรวจสอบ Firestore Indexes
                                    </>
                                )}
                            </button>

                        </div>
                    </div>
                </div>
            </div>



            {/* Index Check Results Modal */}
            {showIndexModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-800">ผลการตรวจสอบ Firestore Indexes</h3>
                                <button
                                    onClick={() => setShowIndexModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {indexResults.filter(r => r.status === "missing").length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-800">Indexes พร้อมใช้งานแล้ว!</h4>
                                    <p className="text-gray-500 mt-2">ไม่พบ Index ที่ต้องสร้างเพิ่ม</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                        <p className="text-sm text-yellow-800 font-medium">
                                            ⚠️ พบ {indexResults.filter(r => r.status === "missing").length} Indexes ที่ต้องสร้าง
                                        </p>
                                        <p className="text-xs text-yellow-700 mt-1">
                                            กดลิงก์แต่ละรายการเพื่อเปิด Firebase Console และสร้าง Index
                                        </p>
                                    </div>

                                    {indexResults.filter(r => r.status === "missing").map((result, index) => (
                                        <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-medium text-gray-800">{result.queryName}</p>
                                                    <p className="text-sm text-gray-500">Collection: {result.collection}</p>
                                                    <p className="text-xs text-gray-400 mt-1">{result.description}</p>
                                                </div>
                                                {result.indexUrl ? (
                                                    <a
                                                        href={result.indexUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm whitespace-nowrap"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                        สร้าง Index
                                                    </a>
                                                ) : (
                                                    <span className="px-3 py-1 bg-gray-200 text-gray-600 rounded-lg text-sm">
                                                        ไม่พบ URL
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                        <p className="text-sm text-gray-700 font-medium">📋 วิธีใช้งาน:</p>
                                        <ol className="text-sm text-gray-600 mt-2 space-y-1 list-decimal list-inside">
                                            <li>กดปุ่ม &quot;สร้าง Index&quot; ของแต่ละรายการ</li>
                                            <li>จะเปิดหน้า Firebase Console</li>
                                            <li>กดปุ่ม &quot;Create Index&quot; ใน Firebase Console</li>
                                            <li>รอ 1-2 นาทีจนสร้างเสร็จ</li>
                                            <li>ทำซ้ำจนครบทุกรายการ</li>
                                        </ol>
                                    </div>
                                </div>
                            )}

                            {/* Show all results */}
                            <div className="mt-6">
                                <h4 className="font-medium text-gray-700 mb-3">รายการทั้งหมด:</h4>
                                <div className="space-y-2">
                                    {indexResults.map((result, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <span className="text-sm text-gray-700">{result.queryName}</span>
                                                <span className="text-xs text-gray-400 ml-2">({result.collection})</span>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${result.status === "ok"
                                                ? "bg-green-100 text-green-700"
                                                : result.status === "missing"
                                                    ? "bg-red-100 text-red-700"
                                                    : "bg-gray-100 text-gray-700"
                                                }`}>
                                                {result.status === "ok" ? "✓ พร้อม" : result.status === "missing" ? "✕ ต้องสร้าง" : "? ไม่ทราบ"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setShowIndexModal(false)}
                                className="w-full py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                            >
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
