"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Note: Add 'storage' to lib/firebase.ts first if not present

export default function AdminEquipmentAddPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'equipment',
        status: 'available',
        description: '',
        licensePlate: '',
        brand: '',
    });
    const [imageUrl, setImageUrl] = useState(''); // Placeholder for now until Storage is fully config

    // TODO: Implement Storage Upload logic in next step if user requests

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!db) {
                alert('ระบบฐานข้อมูลไม่พร้อมใช้งาน');
                setLoading(false);
                return;
            }

            // Prepare Data
            const itemData: any = {
                ...formData,
                imageUrl: imageUrl || `https://placehold.co/600x400?text=${encodeURIComponent(formData.name)}`, // Placeholder
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                tags: [formData.type] // Basic tag
            };

            // Clean up empty fields
            if (!itemData.licensePlate) delete itemData.licensePlate;
            if (!itemData.brand) delete itemData.brand;

            await addDoc(collection(db, 'equipment'), itemData);

            alert('เพิ่มรายการเรียบร้อยแล้ว');
            router.push('/equipment');
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* ... (UI Code remains mostly the same, just keeping it consistent) ... */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/equipment" className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">เพิ่มรายการอุปกรณ์ใหม่</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">

                    {/* Image URL Input (Basic Version) */}
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">ลิงก์รูปภาพ (Optional)</label>
                        <input
                            type="text"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                            placeholder="https://example.com/image.jpg"
                        />
                        <p className="text-xs text-gray-400 mt-1">* ระบบอัปโหลดรูปภาพกำลังอยู่ระหว่างการพัฒนา ใส่ URL รูปภาพไปก่อน</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อรายการ <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                                placeholder="เช่น สว่านไฟฟ้า Bosch, รถกระบะ Toyota"
                            />
                        </div>

                        {/* Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท <span className="text-red-500">*</span></label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all cursor-pointer"
                            >
                                <option value="equipment">🛠️ เครื่องมือ (Equipment)</option>
                                <option value="vehicle">🚗 ยานพาหนะ (Vehicle)</option>
                                <option value="consumable">📦 วัสดุสิ้นเปลือง (Consumable)</option>
                            </select>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะเริ่มต้น</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all cursor-pointer"
                            >
                                <option value="available">พร้อมใช้งาน</option>
                                <option value="maintenance">ซ่อมบำรุง</option>
                                <option value="borrowed">ถูกยืม</option>
                            </select>
                        </div>

                        {/* Vehicle Fields */}
                        {formData.type === 'vehicle' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ทะเบียนรถ</label>
                                    <input
                                        type="text"
                                        name="licensePlate"
                                        value={formData.licensePlate}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                                        placeholder="กข 1234"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ยี่ห้อ/รุ่น</label>
                                    <input
                                        type="text"
                                        name="brand"
                                        value={formData.brand}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                                        placeholder="Toyota Revo"
                                    />
                                </div>
                            </>
                        )}

                        {/* Description */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดเพิ่มเติม</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all resize-none"
                                placeholder="ระบุรายละเอียด, Serial Number, หรือหมายเหตุ..."
                            ></textarea>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-shadow shadow-md disabled:opacity-70 flex items-center gap-2"
                        >
                            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            บันทึกข้อมูล
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
