"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, Timestamp, where, writeBatch } from "firebase/firestore";
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

const BACKUP_COLLECTIONS = [
    "settings",
    "equipment",
    "equipment-usage",
    "stock-history",
    "repairs",
    "repair-reports",
    "users",
    "appConfig",
    "scheduled-notification-logs",
    "bookings",
    "expenses",
    "vehicles",
    "vehicle-usage",
];

const BACKUP_CSV_HEADERS = ["collection", "id", "data"];

type CategoryItem = {
    code: string;
    name: string;
    phase: string;
    sortOrder: number;
    active: boolean;
};

type SettingsTab = "notifications" | "masterData" | "backup" | "system";

const DEFAULT_CATEGORY_ITEMS: CategoryItem[] = [
    { sortOrder: 1, code: "ST", name: "งานโครงสร้าง", phase: "โครงสร้างพื้นฐาน", active: true },
    { sortOrder: 2, code: "RE", name: "เหล็กเสริม", phase: "โครงสร้างพื้นฐาน", active: true },
    { sortOrder: 3, code: "FW", name: "แบบหล่อ/นั่งร้าน", phase: "โครงสร้างพื้นฐาน", active: true },
    { sortOrder: 4, code: "RF", name: "งานหลังคา", phase: "งานสถาปัตยกรรม", active: true },
    { sortOrder: 5, code: "AR", name: "งานสถาปัตย์", phase: "งานสถาปัตยกรรม", active: true },
    { sortOrder: 6, code: "PL", name: "ประปา", phase: "งานระบบ (MEP)", active: true },
    { sortOrder: 7, code: "EL", name: "ไฟฟ้า", phase: "งานระบบ (MEP)", active: true },
    { sortOrder: 8, code: "MS", name: "เหล็ก/เชื่อม", phase: "วัสดุสิ้นเปลือง", active: true },
    { sortOrder: 9, code: "NL", name: "ตะปู", phase: "วัสดุสิ้นเปลือง", active: true },
    { sortOrder: 10, code: "SC", name: "สกรู/พุก", phase: "วัสดุสิ้นเปลือง", active: true },
    { sortOrder: 11, code: "CH", name: "เคมีภัณฑ์", phase: "วัสดุสิ้นเปลือง", active: true },
    { sortOrder: 12, code: "MC", name: "เครื่องจักร", phase: "เครื่องจักรและเครื่องมือ", active: true },
    { sortOrder: 13, code: "TL", name: "เครื่องมือ", phase: "เครื่องจักรและเครื่องมือ", active: true },
    { sortOrder: 14, code: "SF", name: "เซฟตี้", phase: "เครื่องจักรและเครื่องมือ", active: true },
    { sortOrder: 15, code: "OF", name: "สำนักงานไซต์", phase: "บริหารจัดการไซต์งาน", active: true },
];

function normalizeCategoryItems(categoryItems: any, fallbackCategories: any): CategoryItem[] {
    if (Array.isArray(categoryItems) && categoryItems.length > 0) {
        return categoryItems
            .map((item, index) => ({
                code: String(item.code || "").trim().toUpperCase(),
                name: String(item.name || "").trim(),
                phase: String(item.phase || "").trim(),
                sortOrder: Number(item.sortOrder) || index + 1,
                active: item.active !== false,
            }))
            .filter((item) => item.code && item.name)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    }

    if (Array.isArray(fallbackCategories) && fallbackCategories.length > 0) {
        return fallbackCategories.map((name, index) => ({
            code: `C${String(index + 1).padStart(2, "0")}`,
            name: String(name),
            phase: "ทั่วไป",
            sortOrder: index + 1,
            active: true,
        }));
    }

    return DEFAULT_CATEGORY_ITEMS;
}

function csvEscape(value: unknown): string {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function parseBackupCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else if (char !== "\r") {
            field += char;
        }
    }

    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((items) => items.some((item) => item.trim() !== ""));
}

function serializeBackupValue(value: any): any {
    if (Array.isArray(value)) {
        return value.map(serializeBackupValue);
    }

    if (value && typeof value === "object") {
        if (
            typeof value.seconds === "number" &&
            typeof value.nanoseconds === "number" &&
            typeof value.toDate === "function"
        ) {
            return { _seconds: value.seconds, _nanoseconds: value.nanoseconds };
        }

        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, serializeBackupValue(item)])
        );
    }

    return value;
}

function restoreBackupValue(value: any): any {
    if (Array.isArray(value)) {
        return value.map(restoreBackupValue);
    }

    if (value && typeof value === "object") {
        const seconds = value._seconds ?? value.seconds;
        const nanoseconds = value._nanoseconds ?? value.nanoseconds;
        const keys = Object.keys(value);

        if (
            typeof seconds === "number" &&
            typeof nanoseconds === "number" &&
            keys.every((key) => ["_seconds", "_nanoseconds", "seconds", "nanoseconds"].includes(key))
        ) {
            return new Timestamp(seconds, nanoseconds);
        }

        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, restoreBackupValue(item)])
        );
    }

    return value;
}

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

function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatThaiDateTime(value: any): string {
    const date = toDate(value);
    if (!date) return "-";

    return date.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function getBangkokDateKey(value: Date) {
    return value.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function isTodayBangkok(value: any) {
    const date = toDate(value);
    if (!date) return false;

    return getBangkokDateKey(date) === getBangkokDateKey(new Date());
}

function isOverdue(expectedReturnDate: any) {
    const date = toDate(expectedReturnDate);
    if (!date) return false;

    return date.getTime() < Date.now();
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;

    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function serializeSummaryUsage(usage: any) {
    const serializeDate = (value: any) => {
        const date = toDate(value);
        return date ? date.toISOString() : null;
    };

    return {
        equipmentName: usage.equipmentName || '',
        quantity: usage.quantity || 1,
        returnQuantity: usage.returnQuantity || null,
        unit: usage.unit || 'ชิ้น',
        userName: usage.userName || '',
        borrowTime: serializeDate(usage.borrowTime),
        expectedReturnDate: serializeDate(usage.expectedReturnDate),
        returnTime: serializeDate(usage.returnTime),
        returnNote: usage.returnNote || '',
    };
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exportingBackup, setExportingBackup] = useState(false);
    const [importingBackup, setImportingBackup] = useState(false);
    const [message, setMessage] = useState("");
    const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("notifications");
    const [testingNotification, setTestingNotification] = useState(false);
    const [testingSummary, setTestingSummary] = useState<"borrow" | "return" | null>(null);
    // const [showIndexes, setShowIndexes] = useState(false); // Unused
    // const [firebaseProjectId, setFirebaseProjectId] = useState(""); // Unused

    // Index Checker State
    const [checkingIndexes, setCheckingIndexes] = useState(false);
    const [indexResults, setIndexResults] = useState<IndexCheckResult[]>([]);
    const [showIndexModal, setShowIndexModal] = useState(false);

    const [categories, setCategories] = useState<string[]>([]);
    const [categoryItems, setCategoryItems] = useState<CategoryItem[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [newCategoryCode, setNewCategoryCode] = useState("");
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryPhase, setNewCategoryPhase] = useState("");
    const [newLocation, setNewLocation] = useState("");
    const [adminUsers, setAdminUsers] = useState<Array<{ id: string; name: string; lineId: string }>>([]);
    const backupFileInputRef = useRef<HTMLInputElement>(null);

    const settingsTabs: Array<{ id: SettingsTab; label: string; description: string }> = [
        { id: "notifications", label: "แจ้งเตือน", description: "LINE และข้อความผู้ใช้" },
        { id: "masterData", label: "ข้อมูลหลัก", description: "หมวดหมู่และตำแหน่ง" },
        { id: "backup", label: "Backup", description: "Import / Export CSV" },
        { id: "system", label: "ระบบ", description: "Indexes และเครื่องมือ" },
    ];

    // LINE settings (Group ID only, Token from .env)
    const [lineConfig, setLineConfig] = useState({
        enabled: false,
        groupId: "",
        notifyBorrowSummary: true,
        notifyReturnSummary: true,
        notifyAdminUserIds: [] as string[],
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
                    const normalizedCategories = normalizeCategoryItems(data.categoryItems, data.categories);
                    setCategoryItems(normalizedCategories);
                    setCategories(normalizedCategories.filter((item) => item.active).map((item) => item.name));
                    setLocations(data.locations || []);
                } else {
                    setCategoryItems(DEFAULT_CATEGORY_ITEMS);
                    setCategories(DEFAULT_CATEGORY_ITEMS.map((item) => item.name));
                    setLocations(['ชั้น A-1', 'ชั้น A-2', 'ชั้น B-1', 'ห้องเก็บของ', 'โกดัง']);
                }

                const notifyDocRef = doc(db, "settings", "notifications");
                const notifyDocSnap = await getDoc(notifyDocRef);
                if (notifyDocSnap.exists()) {
                    const data = notifyDocSnap.data();
                    setLineConfig({
                        enabled: data.line?.enabled || false,
                        groupId: data.line?.groupId || "",
                        notifyBorrowSummary: data.line?.notifyBorrowSummary ?? true,
                        notifyReturnSummary: data.line?.notifyReturnSummary ?? true,
                        notifyAdminUserIds: Array.isArray(data.line?.notifyAdminUserIds) ? data.line.notifyAdminUserIds : [],
                        userChatMessage: data.line?.userChatMessage ?? true,
                        notifyRepairReport: data.line?.notifyRepairReport ?? true,
                        notifyRepairCompleted: data.line?.notifyRepairCompleted ?? true,
                    });
                }

                const adminSnapshot = await getDocs(query(
                    collection(db as any, "users"),
                    where("role", "==", "admin")
                ));
                setAdminUsers(adminSnapshot.docs
                    .map((doc) => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            name: data.name || data.displayName || data.email || doc.id,
                            lineId: data.lineId || '',
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, 'th')));
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
            const seenCodes = new Set<string>();
            const sortedCategoryItems = categoryItems
                .map((item, index) => ({
                    ...item,
                    code: item.code.trim().toUpperCase(),
                    name: item.name.trim(),
                    phase: item.phase.trim() || "ทั่วไป",
                    sortOrder: Number(item.sortOrder) || index + 1
                }))
                .filter((item) => item.code && item.name)
                .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

            for (const item of sortedCategoryItems) {
                if (seenCodes.has(item.code)) {
                    setMessage(`รหัสหมวดหมู่ซ้ำ: ${item.code}`);
                    setSaving(false);
                    return;
                }
                seenCodes.add(item.code);
            }

            const activeCategoryNames = sortedCategoryItems.filter((item) => item.active).map((item) => item.name);
            await setDoc(equipDocRef, {
                categoryItems: sortedCategoryItems,
                categories: activeCategoryNames,
                locations,
                updatedAt: new Date()
            }, { merge: true });
            setCategories(activeCategoryNames);

            const notifyDocRef = doc(db, "settings", "notifications");
            await setDoc(notifyDocRef, { line: lineConfig, updatedAt: new Date() }, { merge: true });

            setMessage("บันทึกสำเร็จ!");
        } catch (error) {
            console.error("Error saving:", error);
            setMessage("เกิดข้อผิดพลาด");
        }
        setSaving(false);
    };

    const toggleNotifyAdmin = (adminId: string) => {
        const selected = lineConfig.notifyAdminUserIds || [];
        const nextSelected = selected.includes(adminId)
            ? selected.filter((id) => id !== adminId)
            : [...selected, adminId];

        setLineConfig({ ...lineConfig, notifyAdminUserIds: nextSelected });
    };

    const getSelectedAdminLineIds = () => {
        const selected = new Set(lineConfig.notifyAdminUserIds || []);
        return adminUsers
            .filter((admin) => selected.has(admin.id) && admin.lineId)
            .map((admin) => admin.lineId);
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

    const testEquipmentUsageSummary = async (type: "borrow" | "return") => {
        const recipients = getSelectedAdminLineIds();
        if (!lineConfig.groupId && recipients.length === 0) {
            setMessage("กรุณาใส่ Group ID หรือเลือกแอดมินอย่างน้อย 1 คน");
            return;
        }

        if (!db) {
            setMessage("ไม่สามารถเชื่อมต่อ Firebase ได้");
            return;
        }

        setTestingSummary(type);
        setMessage("");

        try {
            const usageQuery = query(
                collection(db as any, "equipment-usage"),
                where("status", "==", type === "borrow" ? "active" : "returned"),
                where("type", "==", "borrow"),
                limit(50)
            );
            const snapshot = await withTimeout(getDocs(usageQuery), 15000, "โหลดรายการจาก Firebase นานเกินไป");
            const usages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const filteredUsages = type === "borrow"
                ? usages.sort((a: any, b: any) => {
                    const aExpected = toDate(a.expectedReturnDate)?.getTime() || Number.MAX_SAFE_INTEGER;
                    const bExpected = toDate(b.expectedReturnDate)?.getTime() || Number.MAX_SAFE_INTEGER;
                    return aExpected - bExpected;
                })
                : usages
                    .filter((usage: any) => isTodayBangkok(usage.returnTime))
                    .sort((a: any, b: any) => {
                        const aReturnTime = toDate(a.returnTime)?.getTime() || 0;
                        const bReturnTime = toDate(b.returnTime)?.getTime() || 0;
                        return bReturnTime - aReturnTime;
                    });
            const items = filteredUsages.map(serializeSummaryUsage);
            let pendingItems: any[] = [];

            if (type === "return") {
                const pendingQuery = query(
                    collection(db as any, "equipment-usage"),
                    where("status", "==", "active"),
                    where("type", "==", "borrow"),
                    limit(50)
                );
                const pendingSnapshot = await withTimeout(getDocs(pendingQuery), 15000, "โหลดรายการที่ยังไม่คืนจาก Firebase นานเกินไป");
                pendingItems = pendingSnapshot.docs
                    .map((doc) => ({ id: doc.id, ...doc.data() }))
                    .sort((a: any, b: any) => {
                        const aExpected = toDate(a.expectedReturnDate)?.getTime() || Number.MAX_SAFE_INTEGER;
                        const bExpected = toDate(b.expectedReturnDate)?.getTime() || Number.MAX_SAFE_INTEGER;
                        return aExpected - bExpected;
                    })
                    .map(serializeSummaryUsage);
            }

            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort(), 15000);
            const res = await fetch("/api/equipment-usage/notifications/test-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupId: lineConfig.groupId, recipients, type, items, pendingItems }),
                signal: controller.signal,
            });
            window.clearTimeout(timer);
            const result = await withTimeout(res.json(), 5000, "อ่านผลลัพธ์จาก API นานเกินไป");

            if (result.success) {
                const label = type === "borrow" ? "สรุปรายการยืม" : "สรุปการคืน";
                setMessage(`ส่ง${label}สำเร็จ (${filteredUsages.length} รายการ)`);
            } else {
                setMessage("ส่งไม่สำเร็จ: " + (result.error || "ข้อมูลไม่ถูกต้อง"));
            }
        } catch (error: any) {
            const errorMessage = error?.name === "AbortError"
                ? "ส่งข้อความไป LINE นานเกินไป กรุณาลองใหม่"
                : error?.message || "เกิดข้อผิดพลาดในการทดสอบส่งสรุป";
            setMessage(errorMessage);
        } finally {
            setTestingSummary(null);
        }
    };

    const addCategory = () => {
        const code = newCategoryCode.trim().toUpperCase();
        const name = newCategoryName.trim();
        const phase = newCategoryPhase.trim() || "ทั่วไป";

        if (code && name && !categoryItems.some((item) => item.code === code)) {
            const nextOrder = categoryItems.length > 0
                ? Math.max(...categoryItems.map((item) => Number(item.sortOrder) || 0)) + 1
                : 1;
            setCategoryItems([...categoryItems, { code, name, phase, sortOrder: nextOrder, active: true }]);
            setCategories([...categories, name]);
            setNewCategoryCode("");
            setNewCategoryName("");
            setNewCategoryPhase("");
        }
    };

    const updateCategoryItem = (index: number, patch: Partial<CategoryItem>) => {
        setCategoryItems((items) => items.map((item, itemIndex) => (
            itemIndex === index ? { ...item, ...patch } : item
        )));
    };

    const removeCategory = (index: number) => {
        const nextItems = categoryItems.filter((_, itemIndex) => itemIndex !== index);
        setCategoryItems(nextItems);
        setCategories(nextItems.filter((item) => item.active).map((item) => item.name));
    };

    const addLocation = () => {
        if (newLocation.trim() && !locations.includes(newLocation.trim())) {
            setLocations([...locations, newLocation.trim()]);
            setNewLocation("");
        }
    };

    const removeLocation = (loc: string) => setLocations(locations.filter(l => l !== loc));

    const exportBackupCsv = async () => {
        if (!db) {
            setMessage("ไม่สามารถเชื่อมต่อ Firebase ได้");
            return;
        }

        setExportingBackup(true);
        setMessage("");

        try {
            const rows = [BACKUP_CSV_HEADERS.map(csvEscape).join(",")];

            for (const collectionName of BACKUP_COLLECTIONS) {
                const snapshot = await getDocs(collection(db as any, collectionName));
                snapshot.docs.forEach((docSnap) => {
                    rows.push([
                        csvEscape(collectionName),
                        csvEscape(docSnap.id),
                        csvEscape(JSON.stringify(serializeBackupValue(docSnap.data()))),
                    ].join(","));
                });
            }

            const blob = new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const dateKey = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `store-backup-${dateKey}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setMessage("Export backup CSV สำเร็จ");
        } catch (error: any) {
            console.error("Error exporting backup:", error);
            setMessage(error?.message || "Export backup CSV ไม่สำเร็จ");
        } finally {
            setExportingBackup(false);
        }
    };

    const importBackupCsv = async (file?: File) => {
        if (!db) {
            setMessage("ไม่สามารถเชื่อมต่อ Firebase ได้");
            return;
        }

        if (!file) return;

        const confirmed = window.confirm(
            "Import backup CSV จะเขียนข้อมูลกลับเข้า Firestore แบบ merge ตาม collection/id เดิม ต้องการดำเนินการต่อหรือไม่?"
        );

        if (!confirmed) {
            if (backupFileInputRef.current) backupFileInputRef.current.value = "";
            return;
        }

        setImportingBackup(true);
        setMessage("");

        try {
            const text = await file.text();
            const rows = parseBackupCsv(text.replace(/^\uFEFF/, ""));
            const [headers, ...items] = rows;

            if (!headers || headers.join(",") !== BACKUP_CSV_HEADERS.join(",")) {
                throw new Error(`Invalid CSV headers. Expected: ${BACKUP_CSV_HEADERS.join(",")}`);
            }

            let batch = writeBatch(db);
            let pending = 0;
            let imported = 0;

            for (const row of items) {
                const [collectionName, id, dataJson] = row;

                if (!BACKUP_COLLECTIONS.includes(collectionName) || !id || !dataJson) {
                    continue;
                }

                const data = restoreBackupValue(JSON.parse(dataJson));
                batch.set(doc(db as any, collectionName, id), data, { merge: true });
                pending++;
                imported++;

                if (pending >= 450) {
                    await batch.commit();
                    batch = writeBatch(db);
                    pending = 0;
                }
            }

            if (pending > 0) {
                await batch.commit();
            }

            setMessage(`Import backup CSV สำเร็จ (${imported} รายการ)`);
        } catch (error: any) {
            console.error("Error importing backup:", error);
            setMessage(error?.message || "Import backup CSV ไม่สำเร็จ");
        } finally {
            setImportingBackup(false);
            if (backupFileInputRef.current) backupFileInputRef.current.value = "";
        }
    };

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

            <div className="mb-6 overflow-x-auto">
                <div className="inline-flex min-w-full rounded-xl bg-white p-1 shadow-sm border border-gray-100">
                    {settingsTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveSettingsTab(tab.id)}
                            className={`flex-1 min-w-[140px] px-4 py-3 rounded-lg text-left transition-colors ${activeSettingsTab === tab.id
                                ? "bg-teal-600 text-white shadow-sm"
                                : "text-gray-600 hover:bg-gray-50"
                                }`}
                        >
                            <span className="block text-sm font-semibold">{tab.label}</span>
                            <span className={`block text-xs mt-0.5 ${activeSettingsTab === tab.id ? "text-teal-50" : "text-gray-400"}`}>
                                {tab.description}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="grid grid-cols-1 gap-6">
                {/* Left Column */}
                <div className={activeSettingsTab === "notifications" ? "space-y-6" : "hidden"}>
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

                                <div className="grid grid-cols-1 gap-3">
                                    <label className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg cursor-pointer">
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">แจ้งเตือนสรุปรายการยืม</p>
                                            <p className="text-xs text-gray-500">ใช้กับทริกเกอร์ช่วง 09:00</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={lineConfig.notifyBorrowSummary}
                                            onChange={(e) => setLineConfig({ ...lineConfig, notifyBorrowSummary: e.target.checked })}
                                            className="w-4 h-4 text-green-500 rounded"
                                        />
                                    </label>
                                    <label className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg cursor-pointer">
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">แจ้งเตือนสรุปการคืน</p>
                                            <p className="text-xs text-gray-500">ใช้กับทริกเกอร์ช่วง 17:00</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={lineConfig.notifyReturnSummary}
                                            onChange={(e) => setLineConfig({ ...lineConfig, notifyReturnSummary: e.target.checked })}
                                            className="w-4 h-4 text-green-500 rounded"
                                        />
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">ส่งหาแอดมินรายคน</p>
                                        <p className="text-xs text-gray-500">เลือกได้หลายคน ระบบจะส่งทั้ง Group ID และแอดมินที่เลือก</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                                        {adminUsers.length === 0 ? (
                                            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
                                                ไม่พบผู้ใช้ role admin
                                            </div>
                                        ) : adminUsers.map((admin) => {
                                            const selected = lineConfig.notifyAdminUserIds.includes(admin.id);
                                            return (
                                                <label
                                                    key={admin.id}
                                                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border cursor-pointer min-h-[42px] ${admin.lineId ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-gray-50 border-gray-100 cursor-not-allowed'}`}
                                                >
                                                    <div className="min-w-0 leading-tight">
                                                        <p className="text-xs font-medium text-gray-700 truncate">{admin.name}</p>
                                                        <p className={`text-[10px] ${admin.lineId ? 'text-gray-500' : 'text-red-500'}`}>
                                                            {admin.lineId ? 'ผูก LINE แล้ว' : 'ยังไม่มี LINE ID'}
                                                        </p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected}
                                                        disabled={!admin.lineId}
                                                        onChange={() => toggleNotifyAdmin(admin.id)}
                                                        className="w-3.5 h-3.5 text-green-500 rounded"
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button
                                    onClick={testLineMessage}
                                    disabled={testingNotification || !lineConfig.groupId}
                                    className="w-full py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50"
                                >
                                    {testingNotification ? 'กำลังส่ง...' : '🧪 ทดสอบส่งข้อความ (Admin Group)'}
                                </button>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => testEquipmentUsageSummary("borrow")}
                                        disabled={!!testingSummary || (!lineConfig.groupId && getSelectedAdminLineIds().length === 0)}
                                        className="py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 disabled:opacity-50"
                                    >
                                        {testingSummary === "borrow" ? "กำลังส่ง..." : "ทดสอบส่งสรุปรายการยืม"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => testEquipmentUsageSummary("return")}
                                        disabled={!!testingSummary || (!lineConfig.groupId && getSelectedAdminLineIds().length === 0)}
                                        className="py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 disabled:opacity-50"
                                    >
                                        {testingSummary === "return" ? "กำลังส่ง..." : "ทดสอบส่งสรุปการคืน"}
                                    </button>
                                </div>
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
                <div className={activeSettingsTab === "notifications" ? "hidden" : "flex flex-col gap-6"}>
                    {/* Backup */}
                    <div className={activeSettingsTab === "backup" ? "bg-white rounded-xl shadow-sm p-5 border-l-4 border-sky-500" : "hidden"}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4m0 0l4-4m-4 4V4" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h2 className="font-semibold text-gray-800">Backup CSV</h2>
                                <p className="text-xs text-gray-500">Export และ Import ข้อมูลหลักของระบบด้วยไฟล์ CSV</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={exportBackupCsv}
                                disabled={exportingBackup || importingBackup}
                                className="py-3 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                                </svg>
                                {exportingBackup ? "กำลัง Export..." : "Export CSV"}
                            </button>

                            <button
                                type="button"
                                onClick={() => backupFileInputRef.current?.click()}
                                disabled={exportingBackup || importingBackup}
                                className="py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V8m0 0l-4 4m4-4l4 4M4 4h16" />
                                </svg>
                                {importingBackup ? "กำลัง Import..." : "Import CSV"}
                            </button>
                        </div>

                        <input
                            ref={backupFileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(event) => importBackupCsv(event.target.files?.[0])}
                        />
                        <p className="mt-3 text-xs text-gray-500">
                            ไฟล์ backup ใช้รูปแบบ collection,id,data และตอน import จะ merge ทับเอกสารเดิมตาม id
                        </p>
                    </div>

                    {/* Categories */}
                    <div className={activeSettingsTab === "masterData" ? "bg-white rounded-xl shadow-sm p-5" : "hidden"}>
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h2 className="font-semibold text-gray-800">หมวดหมู่อุปกรณ์</h2>
                                <p className="text-xs text-gray-500 mt-1">จัดการรหัสหมวดหมู่ ชื่อหมวดหมู่ และกลุ่มงาน</p>
                            </div>
                            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                                {categoryItems.length} ย่อย / {[...new Set(categoryItems.map((item) => item.phase).filter(Boolean))].length} หลัก
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
                            <input
                                type="text"
                                value={newCategoryCode}
                                onChange={(e) => setNewCategoryCode(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                                placeholder="รหัส เช่น ST"
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                                placeholder="ชื่อหมวดหมู่"
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            <input
                                type="text"
                                value={newCategoryPhase}
                                onChange={(e) => setNewCategoryPhase(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                                placeholder="กลุ่มงาน"
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                            <button onClick={addCategory} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                                เพิ่ม
                            </button>
                        </div>

                        <div className="overflow-x-auto border border-gray-100 rounded-lg">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium w-16">ลำดับ</th>
                                        <th className="px-3 py-2 text-left font-medium w-24">รหัส</th>
                                        <th className="px-3 py-2 text-left font-medium">หมวดหมู่</th>
                                        <th className="px-3 py-2 text-left font-medium">กลุ่มงาน</th>
                                        <th className="px-3 py-2 text-left font-medium w-20">ใช้งาน</th>
                                        <th className="px-3 py-2 text-right font-medium w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {categoryItems.map((item, index) => (
                                        <tr key={`${item.code}-${index}`} className={item.active ? "bg-white" : "bg-gray-50 text-gray-400"}>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    value={item.sortOrder}
                                                    onChange={(e) => updateCategoryItem(index, { sortOrder: Number(e.target.value) || index + 1 })}
                                                    className="w-14 px-2 py-1 border border-gray-200 rounded text-sm"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.code}
                                                    onChange={(e) => updateCategoryItem(index, { code: e.target.value.toUpperCase() })}
                                                    className="w-20 px-2 py-1 border border-gray-200 rounded text-sm font-semibold text-gray-700 uppercase"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateCategoryItem(index, { name: e.target.value })}
                                                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.phase}
                                                    onChange={(e) => updateCategoryItem(index, { phase: e.target.value })}
                                                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={item.active}
                                                    onChange={(e) => updateCategoryItem(index, { active: e.target.checked })}
                                                    className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <button onClick={() => removeCategory(index)} className="text-gray-400 hover:text-red-500">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Locations */}
                    <div className={activeSettingsTab === "masterData" ? "bg-white rounded-xl shadow-sm p-5" : "hidden"}>
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
                    <div className={activeSettingsTab === "system" ? "bg-white rounded-xl shadow-sm p-5 border-l-4 border-orange-500" : "hidden"}>
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
