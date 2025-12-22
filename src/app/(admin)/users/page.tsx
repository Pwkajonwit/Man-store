"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, orderBy, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { useModal } from '@/components/ui/Modal';
import { UserProfile } from "@/types/user";

export default function ManageUsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'admin' | 'employee'
    const [searchQuery, setSearchQuery] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { showAlert, showConfirm } = useModal();

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db as any, "users"), orderBy("name", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
            setUsers(usersData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (userId: string, userName: string) => {
        const confirmed = await showConfirm(`ต้องการลบ "${userName}" หรือไม่?`, { confirmText: 'ลบ', cancelText: 'ยกเลิก' });
        if (!confirmed) return;
        setDeletingId(userId);
        try {
            await deleteDoc(doc(db as any, "users", userId));
            showAlert('ลบสำเร็จ', 'success');
        } catch (err) {
            showAlert("เกิดข้อผิดพลาด", 'error');
        }
        setDeletingId(null);
    };

    const handleToggleRole = async (userId: string, currentRole: string) => {
        const newRole = currentRole === 'admin' ? 'employee' : 'admin';
        const confirmed = await showConfirm(`เปลี่ยนเป็น ${newRole === 'admin' ? 'ผู้ดูแล' : 'พนักงาน'}?`, { confirmText: 'เปลี่ยน', cancelText: 'ยกเลิก' });
        if (!confirmed) return;
        try {
            await updateDoc(doc(db as any, "users", userId), { role: newRole });
            showAlert('เปลี่ยนสำเร็จ', 'success');
        } catch (err) {
            showAlert("เกิดข้อผิดพลาด", 'error');
        }
    };

    // Filter users
    const filteredUsers = users.filter(user => {
        const matchTab = activeTab === 'all' ||
            (activeTab === 'admin' && user.role === 'admin') ||
            (activeTab === 'employee' && user.role !== 'admin');
        const matchSearch = !searchQuery ||
            user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.phone || user.phoneNumber || '').includes(searchQuery);
        return matchTab && matchSearch;
    });

    const adminCount = users.filter(u => u.role === 'admin').length;
    const employeeCount = users.filter(u => u.role !== 'admin').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin h-10 w-10 border-3 border-teal-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้งาน</h1>
                    <p className="text-sm text-gray-500 mt-1">ทั้งหมด {users.length} คน</p>
                </div>
                <Link
                    href="/users/add"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    เพิ่มผู้ใช้
                </Link>
            </div>

            {/* Tabs & Search */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all'
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            ทั้งหมด ({users.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'admin'
                                ? 'bg-red-600 text-white'
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                                }`}
                        >
                            ผู้ดูแล ({adminCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('employee')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'employee'
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                }`}
                        >
                            พนักงาน ({employeeCount})
                        </button>
                    </div>

                    {/* Search */}
                    <div className="flex-1 relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ค้นหาชื่อ, เบอร์โทร..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                </div>
            </div>

            {/* User List */}
            {filteredUsers.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-500">{searchQuery ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีผู้ใช้'}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredUsers.map(user => {
                        const avatarUrl = user.linePictureUrl || user.imageUrl || user.pictureUrl || user.photoURL;
                        return (
                            <div
                                key={user.id}
                                className={`bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 transition-all ${deletingId === user.id ? 'opacity-50' : ''
                                    }`}
                            >
                                {/* Avatar */}
                                <div className="flex-shrink-0">
                                    {avatarUrl ? (
                                        <Image
                                            src={avatarUrl}
                                            alt={user.name || 'User'}
                                            width={48}
                                            height={48}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-100"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${user.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'
                                            }`}>
                                            {(user.name || 'U')[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-gray-900 truncate">{user.name || 'ไม่ระบุชื่อ'}</h3>
                                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${user.role === 'admin'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {user.role === 'admin' ? 'ผู้ดูแล' : 'พนักงาน'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                                        {(user.phone || user.phoneNumber) && <span>{user.phone || user.phoneNumber}</span>}
                                        {user.email && <span className="truncate">{user.email}</span>}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggleRole(user.id, user.role)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${user.role === 'admin'
                                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                                            }`}
                                        title={user.role === 'admin' ? 'เปลี่ยนเป็นพนักงาน' : 'เปลี่ยนเป็นผู้ดูแล'}
                                    >
                                        {user.role === 'admin' ? 'ลดสิทธิ์' : 'เพิ่มสิทธิ์'}
                                    </button>
                                    <Link
                                        href={`/users/${user.id}/edit`}
                                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(user.id, user.name || 'User')}
                                        disabled={deletingId === user.id}
                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
