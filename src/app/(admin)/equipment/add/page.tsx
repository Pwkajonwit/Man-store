"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, addDoc, collection, Timestamp } from "firebase/firestore";
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

export default function AddEquipmentPage() {
    const router = useRouter();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [imagePreview, setImagePreview] = useState("");

    const [formData, setFormData] = useState<any>({
        name: "",
        code: "",
        category: "ทั่วไป",
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
    const [categories, setCategories] = useState<string[]>(['ทั่วไป']);
    const [locations, setLocations] = useState<string[]>([]);

    // Load settings
    useEffect(() => {
        async function loadSettings() {
            try {
                if (!db) return;
                const docRef = doc(db, "settings", "equipment");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.categories?.length) setCategories(data.categories);
                    if (data.locations?.length) setLocations(data.locations);
                }
            } catch (error) {
                console.error("Error loading settings:", error);
            }
        }
        loadSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
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
        setIsSubmitting(true);
        setMessage("");

        try {
            const quantity = Number(formData.quantity);

            const equipmentData = {
                name: formData.name,
                code: formData.code,
                category: formData.category,
                type: formData.type,
                status: formData.status,
                quantity: quantity,
                availableQuantity: quantity, // For new equipment, available = total
                unit: formData.unit,
                minStock: Number(formData.minStock),
                imageUrl: formData.imageUrl || `https://placehold.co/600x400?text=${encodeURIComponent(formData.name)}`,
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

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                    <Icons.ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">เพิ่มอุปกรณ์ใหม่</h1>
                    <p className="text-gray-500 text-sm">กรอกข้อมูลอุปกรณ์ที่ต้องการเพิ่ม</p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                {/* Image Upload */}
                <div className="flex flex-col items-center gap-3">
                    <div className="relative group">
                        <label className={`cursor-pointer block ${imagePreview || formData.imageUrl ? '' : 'w-32 h-32'}`}>
                            <div className="h-32 w-32 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden hover:border-teal-500 transition-colors">
                                {imagePreview || formData.imageUrl ? (
                                    <Image src={imagePreview || formData.imageUrl} alt="Preview" width={128} height={128} className="object-cover w-full h-full" unoptimized />
                                ) : (
                                    <div className="text-center">
                                        <Icons.Photo className="w-10 h-10 text-gray-300 mx-auto" />
                                        <span className="text-xs text-gray-400 mt-1">คลิกเพื่ออัปโหลดรูป</span>
                                    </div>
                                )}
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </label>
                        {(imagePreview || formData.imageUrl) && (
                            <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors z-10"
                                title="ลบรูปภาพ"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {isUploading && (
                        <div className="flex items-center gap-2 text-sm text-teal-600">
                            <div className="animate-spin h-4 w-4 border-2 border-teal-600 border-t-transparent rounded-full"></div>
                            กำลังอัพโหลด...
                        </div>
                    )}
                </div>

                {/* Name & Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ชื่ออุปกรณ์ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="เช่น สว่านไฟฟ้า"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">รหัสอุปกรณ์</label>
                        <input
                            type="text"
                            name="code"
                            value={formData.code}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="เช่น EQ-001"
                        />
                    </div>
                </div>

                {/* Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ประเภท</label>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setFormData((prev: any) => ({ ...prev, type: 'borrowable' }))}
                            className={`p-4 rounded-xl border-2 transition-all ${formData.type === 'borrowable'
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${formData.type === 'borrowable' ? 'bg-blue-100' : 'bg-gray-100'
                                    }`}>
                                    <svg className={`w-6 h-6 ${formData.type === 'borrowable' ? 'text-blue-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <div className={`font-medium ${formData.type === 'borrowable' ? 'text-blue-700' : 'text-gray-700'}`}>ยืม-คืน</div>
                                    <div className="text-xs text-gray-500">อุปกรณ์ที่ต้องส่งคืน</div>
                                </div>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData((prev: any) => ({ ...prev, type: 'consumable' }))}
                            className={`p-4 rounded-xl border-2 transition-all ${formData.type === 'consumable'
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${formData.type === 'consumable' ? 'bg-purple-100' : 'bg-gray-100'
                                    }`}>
                                    <svg className={`w-6 h-6 ${formData.type === 'consumable' ? 'text-purple-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <div className={`font-medium ${formData.type === 'consumable' ? 'text-purple-700' : 'text-gray-700'}`}>เบิก</div>
                                    <div className="text-xs text-gray-500">วัสดุสิ้นเปลือง</div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Category */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                    <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {/* Status */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะอุปกรณ์</label>
                    <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        <option value="available">พร้อมใช้งาน</option>
                        <option value="damaged">ชำรุด</option>
                        <option value="lost">หาย</option>
                        <option value="retired">ยกเลิกใช้งาน</option>
                    </select>
                </div>

                {/* Quantity, Unit, Min Stock */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนทั้งหมด</label>
                        <input
                            type="number"
                            name="quantity"
                            value={formData.quantity}
                            onChange={handleChange}
                            min="0"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">หน่วย</label>
                        <input
                            type="text"
                            name="unit"
                            value={formData.unit}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                </div>

                {/* Location */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ตำแหน่งจัดเก็บ</label>
                    {locations.length > 0 ? (
                        <select
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="เช่น ห้องเก็บของ A"
                        />
                    )}
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        placeholder="รายละเอียดเพิ่มเติม, Serial Number, หรือหมายเหตุ..."
                    />
                </div>

                {/* Message */}
                {message && (
                    <div className={`p-3 rounded-lg text-sm text-center ${message.includes('สำเร็จ') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Submit Button */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-all disabled:bg-gray-400"
                    >
                        {isSubmitting ? 'กำลังบันทึก...' : 'เพิ่มอุปกรณ์'}
                    </button>
                </div>
            </form>
        </div>
    );
}
