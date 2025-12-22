"use client";

import { useState, useEffect } from 'react';
import { Liff } from '@line/liff';

interface UseLiffReturn {
    liff: Liff | any | null; // Use any for mock support
    profile: any | null;
    loading: boolean;
    error: string;
}

const useLiff = (liffId: string | undefined): UseLiffReturn => {
    const [liffObject, setLiffObject] = useState<any | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const initializeLiff = async () => {
            // =====================================================
            // DEVELOPMENT MODE: ข้ามการ Login LINE ใน Development
            // =====================================================
            const isDev = process.env.NODE_ENV === 'development';
            const useMockLiff = process.env.NEXT_PUBLIC_MOCK_LIFF === 'true';

            if (isDev && useMockLiff) {
                console.log('🔧 Development Mode: Using Mock LIFF');

                // สร้าง Mock LIFF object
                const mockLiff = {
                    isLoggedIn: () => true,
                    getAccessToken: () => 'mock_access_token_dev',
                    getProfile: async () => ({
                        userId: 'dev_user_001',
                        displayName: 'Dev User',
                    }),
                    login: () => console.log('Mock liff.login called'),
                    logout: () => console.log('Mock liff.logout called'),
                    closeWindow: () => console.log('Mock liff.closeWindow called'),
                };

                setLiffObject(mockLiff);
                setProfile({
                    userId: 'dev_user_001',
                    displayName: 'Dev User',
                });
                setLoading(false);
                return;
            }
            // =====================================================

            if (!liffId) {
                setError("LIFF ID is not provided.");
                setLoading(false);
                return;
            }

            try {
                // Dynamic import to avoid SSR issues
                const liffModule = (await import('@line/liff')).default;
                await liffModule.init({ liffId });

                // จัดการ liff.state ที่ค้างอยู่ใน URL (ถ้ามี)
                const params = new URLSearchParams(window.location.search);
                let redirectPath = params.get('liff.state');
                if (redirectPath) {
                    try {
                        let decoded = redirectPath;
                        for (let i = 0; i < 3; i++) {
                            const prev = decoded;
                            try { decoded = decodeURIComponent(decoded); } catch (e) { break; }
                            if (decoded === prev) break;
                        }
                        const nestedMatch = decoded.match(/liff\.state=([^&]+)/);
                        if (nestedMatch && nestedMatch[1]) {
                            try { decoded = decodeURIComponent(nestedMatch[1]); } catch (e) { }
                        }
                        decoded = decoded.split('?')[0].trim();
                        let targetPath = decoded;
                        if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;

                        const currentPath = window.location.pathname || '/';
                        if (targetPath.startsWith('/confirm') && currentPath !== targetPath) {
                            window.location.replace(targetPath);
                            return;
                        }
                    } catch (e) {
                        console.warn('Failed to normalize liff.state', e);
                    }
                }

                if (!liffModule.isLoggedIn()) {
                    liffModule.login();
                    return;
                }

                setLiffObject(liffModule);
                setLoading(false);

            } catch (err: any) {
                console.error("LIFF initialization failed", err);

                // Handle "code_verifier does not match" error
                // This happens when LIFF login flow was interrupted
                if (err.message?.includes('code_verifier') || err.code === 'INIT_FAILED') {
                    console.log('🔄 Clearing LIFF session and retrying...');

                    // Clear all LIFF-related data from localStorage
                    try {
                        const keysToRemove: string[] = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && (key.startsWith('LIFF') || key.includes('liff') || key.includes('code_verifier'))) {
                                keysToRemove.push(key);
                            }
                        }
                        keysToRemove.forEach(key => localStorage.removeItem(key));
                        console.log('✅ Cleared LIFF localStorage keys:', keysToRemove);

                        // Retry login after a short delay
                        setTimeout(() => {
                            const liffModule = (window as any).__liffModule;
                            if (liffModule) {
                                liffModule.login();
                            } else {
                                // Reload the page to restart LIFF initialization
                                window.location.reload();
                            }
                        }, 100);
                        return;
                    } catch (clearError) {
                        console.error('Failed to clear localStorage:', clearError);
                    }
                }

                const detailedError = `การเชื่อมต่อ LINE ไม่สมบูรณ์: ${err.message || 'Unknown error'}`;
                setError(detailedError);
                setLoading(false);
            }
        };

        initializeLiff();
    }, [liffId]);

    return { liff: liffObject, profile, loading, error };
};

export default useLiff;
