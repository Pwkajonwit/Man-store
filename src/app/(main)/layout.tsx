"use client";

import { useAuth } from "@/context/AuthContext";
import useLiffAuth from '@/hooks/useLiffAuth';
import { useState, useEffect } from 'react';
import LiffQueryRouter from '@/components/main/LiffQueryRouter';
import { ModalProvider } from '@/components/ui/Modal';
import { AppSettingsProvider } from '@/context/AppSettingsContext';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const { loading: authLoading, setUserProfileFromAuth } = useAuth();
    // ดึง error: liffAuthError ออกมาใช้งาน
    const { loading: liffLoading, needsLink, linkProfile, linkByPhone, error: liffAuthError, userProfile: liffUserProfile } = useLiffAuth();
    const [phoneInput, setPhoneInput] = useState('');
    const [linking, setLinking] = useState(false);
    const [linkMessage, setLinkMessage] = useState('');

    useEffect(() => {
        if (liffUserProfile && setUserProfileFromAuth) {
            console.log('Setting userProfile from LIFF auth:', liffUserProfile);
            setUserProfileFromAuth(liffUserProfile);
        }
    }, [liffUserProfile, setUserProfileFromAuth]);

    if (liffLoading || authLoading) {
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

    // -------------------------------------------------------
    // [ส่วนที่เพิ่ม] ถ้ามี Error จาก LIFF/API ให้แสดงออกมาเลย
    // -------------------------------------------------------
    if (liffAuthError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6">
                <div className="bg-white p-6 rounded-lg shadow-md max-w-sm w-full text-center">
                    <h3 className="text-lg font-bold text-red-600 mb-2">เกิดข้อผิดพลาด!</h3>
                    <div className="bg-gray-100 p-3 rounded text-sm font-mono text-left text-red-800 break-words mb-4">
                        {typeof liffAuthError === 'string' ? liffAuthError : JSON.stringify(liffAuthError)}
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        กรุณาแคปหน้าจอนี้แจ้งผู้ดูแลระบบ หรือตรวจสอบ Console Log
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 w-full"
                    >
                        ลองใหม่
                    </button>
                </div>
            </div>
        );
    }
    // -------------------------------------------------------

    if (needsLink) {
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
                            เราไม่พบบัญชีพนักงานที่เชื่อมกับ LINE นี้ ({linkProfile?.displayName || ''})
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
                        onClick={async () => {
                            setLinking(true);
                            setLinkMessage('');
                            const res = await linkByPhone(phoneInput.trim());
                            if (res.success) {
                                setLinkMessage('ผูกบัญชีสำเร็จ กำลังโหลดข้อมูล...');
                            } else {
                                setLinkMessage(res.error || 'ไม่สามารถผูกบัญชีได้');
                            }
                            setLinking(false);
                        }}
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

    // Note: Instead of returning children immediately if userProfile exists,
    // we should render children generally, but the LiffAuth hook ensures validation.
    // However, the original code wraps children in context providers ONLY if userProfile exists.
    // If not, it shows "Waiting" or "Loading".
    // Wait, in React functional components, hooks must be called unconditionally.
    // But the `if (liffLoading)` return block above prevents subsequent code execution.
    // That's fine.

    if (liffUserProfile || (!liffLoading && !authLoading)) {
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-teal-50 flex items-center justify-center">
            <div className="text-center">
                <div className="relative mb-6">
                    <div className="w-20 h-20 bg-teal-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-teal-500/30">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <div className="absolute inset-0 w-20 h-20 mx-auto rounded-2xl bg-teal-500/20 animate-ping"></div>
                </div>
                <h1 className="text-xl font-bold text-gray-800 mb-2">กำลังตรวจสอบ</h1>
                <p className="text-gray-500 text-sm mb-6">รอสักครู่...</p>
                <div className="flex justify-center gap-2">
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
        </div>
    );
}
