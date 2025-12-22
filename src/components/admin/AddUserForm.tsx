"use client";

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function AddUserForm() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        lineId: '',
        phone: '',
        password: '',
        role: 'employee', // ค่าเริ่มต้น
        position: '',
        note: '',
        imageUrl: ''
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files && e.target.files[0];
        if (f) {
            setImageFile(f);
            setFormData(prev => ({ ...prev, imageUrl: URL.createObjectURL(f) }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        setIsSuccess(false);

        try {
            const payload: any = { ...formData };
            if (payload.phone) {
                const digits = payload.phone.replace(/\D/g, '');
                if (digits.length !== 10) throw new Error('หมายเลขโทรศัพท์ต้องเป็นตัวเลข 10 หลัก');
                payload.phone = digits;
            }

            // Remove temporary object URL before sending
            if (payload.imageUrl && payload.imageUrl.startsWith('blob:')) delete payload.imageUrl;

            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                // ถ้า server ตอบกลับมาว่าไม่สำเร็จ
                throw new Error(data.error || 'Something went wrong');
            }

            setMessage(`สร้างผู้ใช้ ${formData.name} สำเร็จ!`);
            setIsSuccess(true);
            // Reset ฟอร์มหลังสร้างสำเร็จ
            setFormData({ name: '', email: '', password: '', role: 'employee', lineId: '', phone: '', position: '', note: '', imageUrl: '' });
            setImageFile(null);

            // Redirect to users list after a short delay
            setTimeout(() => router.push('/admin/users'), 800);

        } catch (error: any) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
            setIsSuccess(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-8 bg-white rounded-lg shadow-md">
            <h2 className="mb-6 text-2xl font-bold text-gray-800">เพิ่มผู้ใช้งานใหม่</h2>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: avatar + file input */}
                <div className="flex flex-col items-center">
                    <label className="block mb-1 text-sm font-medium">รูปโปรไฟล์</label>
                    {formData.imageUrl ? (
                        <Image src={formData.imageUrl} alt="Avatar" width={128} height={128} className="w-32 h-32 object-cover rounded-full border" unoptimized />
                    ) : (
                        <div className="w-32 h-32 bg-gray-200 flex items-center justify-center rounded-full border text-gray-400 text-xs">ไม่มีรูป</div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="w-full mt-4" />
                </div>

                {/* Right: fields */}
                <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1 text-sm font-medium">ชื่อ-สกุล</label>
                            <input type="text" name="name" placeholder="John Doe" value={formData.name} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">อีเมล</label>
                            <input type="email" name="email" placeholder="john.doe@example.com" value={formData.email} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md" />
                        </div>

                        <div>
                            <label className="block mb-1 text-sm font-medium">Line ID (ไม่บังคับ)</label>
                            <input type="text" name="lineId" placeholder="Uxxxx..." value={formData.lineId} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
                        </div>

                        <div>
                            <label className="block mb-1 text-sm font-medium">เบอร์โทร (10 หลัก)</label>
                            <input type="text" name="phone" placeholder="0812345678" value={formData.phone} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
                        </div>

                        <div>
                            <label className="block mb-1 text-sm font-medium">รหัสผ่าน</label>
                            <input type="password" name="password" placeholder="อย่างน้อย 6 ตัวอักษร" value={formData.password} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md" />
                        </div>

                        <div>
                            <label className="block mb-1 text-sm font-medium">บทบาท (Role)</label>
                            <select name="role" value={formData.role} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md">
                                <option value="employee">พนักงาน (Employee)</option>
                                <option value="driver">คนขับรถ (Driver)</option>
                                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block mb-1 text-sm font-medium">ตำแหน่ง</label>
                            <input name="position" value={formData.position} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block mb-1 text-sm font-medium">หมายเหตุ</label>
                            <textarea name="note" value={formData.note} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" rows={3} />
                        </div>
                    </div>

                    {message && (
                        <p className={`text-left text-sm mt-4 ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
                    )}

                    <div className="flex gap-4 justify-end mt-6">
                        <button type="button" onClick={() => router.back()} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ยกเลิก</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400">
                            {isLoading ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
