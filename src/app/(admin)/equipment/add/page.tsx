"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, addDoc, collection, Timestamp, getDocs, query, where } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Image from "next/image";

// --- Icons ---
const Icons = {
    Tool: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
    ),
    ArrowLeft: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
    ),
    Photo: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
    ),
};

type CategoryItem = {
    code: string;
    name: string;
    phase: string;
    sortOrder: number;
    active: boolean;
};

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

    return [{ code: "GEN", name: "ทั่วไป", phase: "ทั่วไป", sortOrder: 1, active: true }];
}

export default function AddEquipmentPage() {
    const router = useRouter();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [imagePreview, setImagePreview] = useState("");

    const [formData, setFormData] = useState<any>({
        name: "",
        code: "",
        category: "",
        categoryCode: "",
        categoryName: "",
        categoryPhase: "",
        type: "borrowable",
        status: "available",
        quantity: 1,
        availableQuantity: 1,
        unit: "ชิ้น",
        minStock: 0,
        imageUrl: "",
        description: "",
        location: "",
    });
    const [categories, setCategories] = useState<CategoryItem[]>([{ code: "GEN", name: "ทั่วไป", phase: "ทั่วไป", sortOrder: 1, active: true }]);
    const [selectedPhase, setSelectedPhase] = useState("");
    const [locations, setLocations] = useState<string[]>([]);

    // สร้างรหัสอุปกรณ์อัตโนมัติ โดยไม่ซ้ำ
    const generateEquipmentCode = async (): Promise<string> => {
        if (!db) return 'EQ-001';

        try {
            // ดึงอุปกรณ์ทั้งหมดเพื่อหารหัสล่าสุด
            const equipmentSnap = await getDocs(collection(db, 'equipment'));

            // หารหัสที่มีรูปแบบ EQ-XXX ทั้งหมด
            const existingCodes: number[] = [];
            equipmentSnap.docs.forEach(doc => {
                const code = doc.data().code || '';
                const match = code.match(/^EQ-(\d+)$/i);
                if (match) {
                    existingCodes.push(parseInt(match[1], 10));
                }
            });

            // หาเลขถัดไปที่ไม่ซ้ำ
            let nextNumber = 1;
            if (existingCodes.length > 0) {
                nextNumber = Math.max(...existingCodes) + 1;
            }

            // สร้างรหัส format EQ-001
            return `EQ-${String(nextNumber).padStart(3, '0')}`;
        } catch (error) {
            console.error('Error generating code:', error);
            return `EQ-${Date.now().toString().slice(-6)}`;
        }
    };

    // Load settings and auto-generate code
    useEffect(() => {
        async function loadSettings() {
            try {
                if (!db) return;

                // Load categories and locations
                const docRef = doc(db, "settings", "equipment");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const normalizedCategories = normalizeCategoryItems(data.categoryItems, data.categories).filter((item) => item.active);
                    if (normalizedCategories.length) {
                        setCategories(normalizedCategories);
                    }
                    if (data.locations?.length) setLocations(data.locations);
                }

                // Auto-generate equipment code
                const autoCode = await generateEquipmentCode();
                setFormData((prev: any) => ({ ...prev, code: autoCode }));
            } catch (error) {
                console.error("Error loading settings:", error);
            }
        }
        loadSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === "categoryPhaseSelector") {
            setSelectedPhase(value);
            setFormData((prev: any) => ({
                ...prev,
                categoryCode: "",
                categoryName: "",
                categoryPhase: value,
                category: "",
            }));
            return;
        }

        if (name === "categoryCode") {
            const selected = categories.find((item) => item.code === value);
            setFormData((prev: any) => ({
                ...prev,
                categoryCode: selected?.code || "",
                categoryName: selected?.name || "",
                categoryPhase: selected?.phase || "",
                category: selected?.name || "",
            }));
            return;
        }

        setFormData((prev: any) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !storage) return;

        setImagePreview(URL.createObjectURL(file));
        setIsUploading(true);

        try {
            const timestamp = Date.now();
            const fileName = `equipment/${timestamp}_${file.name}`;
            const storageRef = ref(storage as any, fileName);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            setFormData((prev: any) => ({ ...prev, imageUrl: downloadURL }));
            setMessage("อัพโหลดรูปสำเร็จ!");
        } catch (error) {
            console.error("Upload error:", error);
            setMessage("อัพโหลดรูปไม่สำเร็จ");
        }
        setIsUploading(false);
    };

    const handleRemoveImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setImagePreview("");
        setFormData((prev: any) => ({ ...prev, imageUrl: "" }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db) return;
        if (!formData.categoryCode) {
            setMessage("กรุณาเลือกกลุ่มงานและหมวดหมู่");
            return;
        }
        setIsSubmitting(true);
        setMessage("");

        try {
            const quantity = Number(formData.quantity);

            const equipmentData = {
                name: formData.name,
                code: formData.code,
                category: formData.category,
                categoryCode: formData.categoryCode || '',
                categoryName: formData.categoryName || formData.category,
                categoryPhase: formData.categoryPhase || '',
                type: formData.type,
                status: formData.status,
                quantity: quantity,
                availableQuantity: quantity, // For new equipment, available = total
                unit: formData.unit,
                minStock: Number(formData.minStock),
                imageUrl: formData.imageUrl || null,
                description: formData.description,
                location: formData.location,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            await addDoc(collection(db, "equipment"), equipmentData);

            setMessage("เพิ่มอุปกรณ์สำเร็จ!");
            setTimeout(() => {
                router.push('/equipment');
            }, 1000);
        } catch (error) {
            console.error('Error adding equipment:', error);
            setMessage("เกิดข้อผิดพลาดในการบันทึก");
            setIsSubmitting(false);
        }
    };

    const selectedCategory = categories.find((cat) => cat.code === formData.categoryCode) || undefined;
    const categoryPhases = Array.from(new Set(categories.map((cat) => cat.phase).filter(Boolean)));
    const filteredCategories = selectedPhase
        ? categories.filter((cat) => cat.phase === selectedPhase)
        : [];
    const isBusy = isSubmitting || isUploading;

    return (
        <div className="max-w-6xl mx-auto pb-24">
            <div className="flex items-start gap-3 mb-5">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="mt-1 p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    aria-label="กลับ"
                >
                    <Icons.ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">เพิ่มอุปกรณ์ใหม่</h1>
                    <p className="text-sm text-gray-500 mt-1">กรอกข้อมูลหลัก เลือกกลุ่มงาน และกำหนดจำนวนเริ่มต้น</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {message && (
                    <div className={`rounded-lg px-4 py-3 text-sm font-medium ${message.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {message}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
                    <aside className="space-y-4">
                        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-semibold text-gray-900">รูปอุปกรณ์</h2>
                                {(imagePreview || formData.imageUrl) && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                                    >
                                        ลบรูป
                                    </button>
                                )}
                            </div>
                            <label className="block cursor-pointer">
                                <div className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center hover:border-teal-500 transition-colors">
                                    {imagePreview || formData.imageUrl ? (
                                        <Image
                                            src={imagePreview || formData.imageUrl}
                                            alt="Preview"
                                            width={320}
                                            height={320}
                                            className="object-cover w-full h-full"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="text-center px-6">
                                            <Icons.Photo className="w-10 h-10 text-gray-300 mx-auto" />
                                            <span className="block text-xs text-gray-500 mt-2">คลิกเพื่อเพิ่มรูป</span>
                                        </div>
                                    )}
                                </div>
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </label>
                            {isUploading && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-teal-600">
                                    <div className="animate-spin h-4 w-4 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                                    กำลังอัพโหลด...
                                </div>
                            )}
                        </section>

                        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <h2 className="text-sm font-semibold text-gray-900 mb-3">สรุปสต็อก</h2>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">ทั้งหมด</p>
                                    <p className="mt-1 text-lg font-bold text-gray-900">{formData.quantity || 0}</p>
                                    <p className="text-xs text-gray-500">{formData.unit}</p>
                                </div>
                                <div className="rounded-lg bg-emerald-50 p-3">
                                    <p className="text-xs text-emerald-700">พร้อมใช้</p>
                                    <p className="mt-1 text-lg font-bold text-emerald-700">{formData.quantity || 0}</p>
                                    <p className="text-xs text-emerald-700">{formData.unit}</p>
                                </div>
                                <div className="rounded-lg bg-amber-50 p-3 col-span-2">
                                    <p className="text-xs text-amber-700">แจ้งเตือนเมื่อเหลือ</p>
                                    <p className="mt-1 text-lg font-bold text-amber-700">{formData.minStock || 0} {formData.unit}</p>
                                </div>
                            </div>
                        </section>

                        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <h2 className="text-sm font-semibold text-gray-900 mb-2">หมวดที่เลือก</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-gray-500">รหัส</span>
                                    <span className="font-semibold text-gray-900">{selectedCategory?.code || "-"}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-gray-500">หมวด</span>
                                    <span className="font-semibold text-gray-900 text-right">{selectedCategory?.name || "-"}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-gray-500">กลุ่มงาน</span>
                                    <span className="font-semibold text-gray-900 text-right">{selectedPhase || "-"}</span>
                                </div>
                            </div>
                        </section>
                    </aside>

                    <main className="space-y-4">
                        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Icons.Tool className="w-5 h-5 text-teal-600" />
                                <h2 className="font-semibold text-gray-900">ข้อมูลหลัก</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ชื่ออุปกรณ์ <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        placeholder="เช่น สว่านไฟฟ้า"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        รหัสอุปกรณ์ <span className="text-xs text-gray-400">(สร้างอัตโนมัติ)</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            name="code"
                                            value={formData.code}
                                            onChange={handleChange}
                                            className="min-w-0 flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                            placeholder="EQ-001"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const newCode = await generateEquipmentCode();
                                                setFormData((prev: any) => ({ ...prev, code: newCode }));
                                            }}
                                            className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                            title="สร้างรหัสใหม่"
                                        >
                                            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="available">พร้อมใช้งาน</option>
                                        <option value="damaged">ชำรุด</option>
                                        <option value="lost">หาย</option>
                                        <option value="retired">ยกเลิกใช้งาน</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        กลุ่มงาน <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="categoryPhaseSelector"
                                        value={selectedPhase}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="">เลือกกลุ่มงาน...</option>
                                        {categoryPhases.map((phase) => (
                                            <option key={phase} value={phase}>{phase}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        หมวดหมู่ <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="categoryCode"
                                        value={formData.categoryCode}
                                        onChange={handleChange}
                                        disabled={!selectedPhase}
                                        required
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                    >
                                        <option value="">{selectedPhase ? "เลือกหมวดหมู่..." : "เลือกกลุ่มงานก่อน"}</option>
                                        {filteredCategories.map(cat => (
                                            <option key={cat.code} value={cat.code}>
                                                {cat.code} - {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ตำแหน่งจัดเก็บ</label>
                                    {locations.length > 0 ? (
                                        <select
                                            name="location"
                                            value={formData.location}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        >
                                            <option value="">เลือกตำแหน่ง...</option>
                                            {locations.map(loc => (
                                                <option key={loc} value={loc}>{loc}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            name="location"
                                            value={formData.location}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                            placeholder="เช่น ห้องเก็บของ A"
                                        />
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                            <h2 className="font-semibold text-gray-900 mb-4">ประเภทและสต็อก</h2>
                            <div className="grid grid-cols-2 gap-2 mb-4 rounded-lg bg-gray-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => setFormData((prev: any) => ({ ...prev, type: 'borrowable' }))}
                                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${formData.type === 'borrowable'
                                        ? 'bg-white text-blue-700 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    ยืม-คืน
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData((prev: any) => ({ ...prev, type: 'consumable' }))}
                                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${formData.type === 'consumable'
                                        ? 'bg-white text-purple-700 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    เบิก
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนทั้งหมด</label>
                                    <input
                                        type="number"
                                        name="quantity"
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
                                    <input
                                        type="text"
                                        name="unit"
                                        value={formData.unit}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        placeholder="ชิ้น"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">แจ้งเตือนเมื่อเหลือ</label>
                                    <input
                                        type="number"
                                        name="minStock"
                                        value={formData.minStock}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={4}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                                placeholder="รายละเอียดเพิ่มเติม, Serial Number, หรือหมายเหตุ..."
                            />
                        </section>
                    </main>
                </div>

                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                    <div className="max-w-6xl mx-auto px-4 py-3 flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isBusy}
                            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-all disabled:bg-gray-400"
                        >
                            {isSubmitting ? 'กำลังบันทึก...' : 'เพิ่มอุปกรณ์'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
