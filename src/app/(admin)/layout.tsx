"use client";

import { useAuth } from "@/context/AuthContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ModalProvider } from "@/components/ui/Modal";

// Layout หลักสำหรับหน้าจัดการทั้งหมด
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { loading, userProfile, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (!loading && !userProfile) {
            console.log("AdminLayout: Redirecting to / because not logged in or no profile", { loading, userProfile });
            // not logged in / no profile -> send to main
            router.replace("/");
            return;
        }
        // Note: Role redirection removed to prevent loop. We handle unauthorized access by rendering a specific UI below.
    }, [loading, userProfile, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                Loading Admin Panel...
            </div>
        );
    }

    if (!userProfile) {
        return null;
    }

    // Role enforcement: allow only 'admin' to access admin area
    if (userProfile.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100">
                <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md w-full border border-slate-200">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                    <p className="text-gray-500 mb-1 text-sm">
                        บัญชีของคุณ (<span className="font-medium text-gray-700">{userProfile.displayName || userProfile.email}</span>)
                    </p>
                    <p className="text-gray-500 mb-6 text-sm">
                        ไม่มีสิทธิ์เข้าใช้งานระบบจัดการ กรุณาติดต่อผู้ดูแลระบบ
                    </p>
                    <p className="text-xs text-gray-400 mb-6">
                        สิทธิ์ปัจจุบัน: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{userProfile.role || 'ไม่ระบุ'}</span>
                    </p>
                    <button
                        onClick={async () => {
                            await logout();
                            router.replace('/admin/login');
                        }}
                        className="w-full px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium"
                    >
                        ออกจากระบบ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <ModalProvider>
            <div className="flex">
                <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="flex-1 min-h-screen flex flex-col bg-gray-100">
                    <div className="px-4 py-2 md:p-6 md:py-2 bg-white shadow-sm">
                        <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
                    </div>
                    <div className="p-4 md:p-6 flex-1 overflow-y-auto">
                        {children}
                    </div>
                </main>
            </div>
        </ModalProvider>
    );
}
