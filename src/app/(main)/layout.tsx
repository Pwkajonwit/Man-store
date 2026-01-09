"use client";

import { UserProvider, useUser } from "@/context/UserContext";
import { useState } from 'react';
import LiffQueryRouter from '@/components/main/LiffQueryRouter';
import { ModalProvider } from '@/components/ui/Modal';
import { AppSettingsProvider } from '@/context/AppSettingsContext';

function MainLayoutContent({ children }: { children: React.ReactNode }) {
    const { user, loading, lineUserId, lineProfile } = useUser();
    const [phoneInput, setPhoneInput] = useState('');
    const [linking, setLinking] = useState(false);
    const [linkMessage, setLinkMessage] = useState('');

    // Loading state - shows beautiful loading screen
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-teal-50 flex items-center justify-center">
                <div className="text-center">
                    {/* Logo/Icon */}
                    <div className="relative mb-6">
                        <div className="w-20 h-20 bg-teal-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-teal-500/30">
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        {/* Pulse Ring */}
                        <div className="absolute inset-0 w-20 h-20 mx-auto rounded-2xl bg-teal-500/20 animate-ping"></div>
                    </div>

                    {/* App Name */}
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Store</h1>
                    <p className="text-gray-500 text-sm mb-6">ระบบยืม-คืนอุปกรณ์</p>

                    {/* Loading Dots */}
                    <div className="flex justify-center gap-2">
                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                </div>
            </div>
        );
    }

    // User not found - needs to link account
    if (lineUserId && !user) {
        const handleLinkByPhone = async () => {
            if (!phoneInput.trim() || !lineProfile) return;

            setLinking(true);
            setLinkMessage('');

            try {
                const resp = await fetch('/api/auth/line/link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lineId: lineUserId,
                        phone: phoneInput.trim(),
                        displayName: lineProfile.displayName,
                        pictureUrl: lineProfile.pictureUrl
                    }),
                });

                const body = await resp.json();

                if (resp.ok && (body.customToken || body.userProfile)) {
                    setLinkMessage('ผูกบัญชีสำเร็จ กำลังโหลดข้อมูล...');
                    // Reload to refresh user data
                    window.location.reload();
                } else {
                    setLinkMessage(body.error || 'ไม่สามารถผูกบัญชีได้');
                }
            } catch (error) {
                console.error('Link error:', error);
                setLinkMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ');
            }

            setLinking(false);
        };

        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                    <div className="mb-4">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-center mb-2">ผูกบัญชีด้วยหมายเลขโทรศัพท์</h2>
                        <p className="text-sm text-gray-600 text-center mb-6">
                            เราไม่พบบัญชีพนักงานที่เชื่อมกับ LINE นี้ ({lineProfile?.displayName || ''})
                        </p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            หมายเลขโทรศัพท์
                        </label>
                        <input
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            placeholder="0812345678"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            type="tel"
                        />
                    </div>

                    {linkMessage && (
                        <div className={`mb-4 p-3 rounded ${linkMessage.includes('สำเร็จ') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            <p className="text-sm">{linkMessage}</p>
                        </div>
                    )}

                    <button
                        onClick={handleLinkByPhone}
                        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        disabled={linking || !phoneInput.trim()}
                    >
                        {linking ? 'กำลังผูกบัญชี...' : 'ผูกบัญชี'}
                    </button>

                    <p className="text-xs text-gray-500 text-center mt-4">
                        ถ้าคุณยังไม่ลงทะเบียนในระบบ โปรดติดต่อผู้ดูแล
                    </p>
                </div>
            </div>
        );
    }

    // User found - render children
    return (
        <ModalProvider>
            <AppSettingsProvider>
                <div className="min-h-screen bg-gray-50">
                    <LiffQueryRouter />
                    {children}
                </div>
            </AppSettingsProvider>
        </ModalProvider>
    );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <UserProvider>
            <MainLayoutContent>{children}</MainLayoutContent>
        </UserProvider>
    );
}
