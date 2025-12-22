"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useModal } from '@/components/ui/Modal';

export default function AddUserPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showAlert } = useModal();

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        password: '',
        lineId: '',
        role: 'employee',
        position: '',
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                showAlert('รูปภาพต้องมีขนาดไม่เกิน 5MB', 'error');
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');

        try {
            const payload: any = { ...formData };

            // Validate phone
            if (payload.phone) {
                const digits = payload.phone.replace(/\D/g, '');
                if (digits.length !== 10) {
                    throw new Error('เบอร์โทรต้องเป็นตัวเลข 10 หลัก');
                }
                payload.phone = digits;
            }

            // Validate password
            if (payload.password && payload.password.length < 6) {
                throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
            }

            // Upload image if selected
            if (imageFile) {
                const fileName = `${Date.now()}_${imageFile.name}`;
                const storageRef = ref(storage as any, `users/temp/${fileName}`);
                await uploadBytes(storageRef, imageFile);
                payload.imageUrl = await getDownloadURL(storageRef);
            }

            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'เกิดข้อผิดพลาด');
            }

            setMessage('เพิ่มผู้ใช้สำเร็จ!');
            setTimeout(() => router.push('/users'), 1000);

        } catch (error: any) {
            setMessage(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/users"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </Link>
                <h1 className="text-xl font-bold text-gray-900">เพิ่มผู้ใช้ใหม่</h1>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Profile Image */}
                    <div className="flex flex-col items-center mb-6">
                        <div
                            className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 cursor-pointer hover:border-teal-400 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {imagePreview ? (
                                <Image
                                    src={imagePreview}
                                    alt="Profile"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                        />
                        <p className="text-xs text-gray-500 mt-2">คลิกเพื่อเพิ่มรูปโปรไฟล์ (ไม่บังคับ)</p>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ชื่อ-นามสกุล <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            placeholder="สมชาย ใจดี"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            เบอร์โทร <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                            placeholder="0812345678"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            อีเมล
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="somchai@example.com"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            รหัสผ่าน
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="อย่างน้อย 6 ตัวอักษร"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>

                    {/* LINE ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            LINE ID
                        </label>
                        <input
                            type="text"
                            name="lineId"
                            value={formData.lineId}
                            onChange={handleChange}
                            placeholder="Uxxxxxxxxxx (ผูกผ่านแอปอัตโนมัติ)"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">จะถูกผูกอัตโนมัติเมื่อผู้ใช้เข้าสู่ระบบผ่าน LINE</p>
                    </div>

                    {/* Role */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            บทบาท <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-3">
                            <label
                                className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${formData.role === 'employee'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="role"
                                    value="employee"
                                    checked={formData.role === 'employee'}
                                    onChange={handleChange}
                                    className="sr-only"
                                />
                                <div className={`font-semibold ${formData.role === 'employee' ? 'text-blue-700' : 'text-gray-700'}`}>
                                    พนักงาน
                                </div>
                                <div className="text-xs text-gray-500 mt-1">ยืม-เบิกอุปกรณ์</div>
                            </label>
                            <label
                                className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${formData.role === 'admin'
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="role"
                                    value="admin"
                                    checked={formData.role === 'admin'}
                                    onChange={handleChange}
                                    className="sr-only"
                                />
                                <div className={`font-semibold ${formData.role === 'admin' ? 'text-red-700' : 'text-gray-700'}`}>
                                    ผู้ดูแล
                                </div>
                                <div className="text-xs text-gray-500 mt-1">จัดการระบบทั้งหมด</div>
                            </label>
                        </div>
                    </div>

                    {/* Position */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            ตำแหน่งงาน
                        </label>
                        <input
                            type="text"
                            name="position"
                            value={formData.position}
                            onChange={handleChange}
                            placeholder="ช่างเทคนิค"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>

                    {/* Message */}
                    {message && (
                        <div className={`p-3 rounded-lg text-sm ${message.includes('สำเร็จ')
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                            }`}>
                            {message}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400 transition-colors"
                        >
                            {isLoading ? 'กำลังบันทึก...' : 'เพิ่มผู้ใช้'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
