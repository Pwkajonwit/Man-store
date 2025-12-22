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

    // Role enforcement: allow only admin and employee to access admin area
    // If not allowed, show Access Denied screen instead of redirecting
    if (userProfile.role !== 'admin' && userProfile.role !== 'employee') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-600 mb-6">
                        You do not have permission to access the Admin Panel.
                        <br />
                        <span className="text-sm text-gray-500">(Current Role: {userProfile.role})</span>
                    </p>
                    <button
                        onClick={async () => {
                            await logout();
                            router.replace('/');
                        }}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium"
                    >
                        Logout
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
