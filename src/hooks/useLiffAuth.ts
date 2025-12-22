"use client";

import { useEffect, useState } from 'react';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import useLiff from './useLiff';
import { UserProfile } from '@/types/user';

interface UseLiffAuthReturn {
    loading: boolean;
    error: string | null;
    needsLink: boolean;
    linkProfile: any | null;
    linkByPhone: (phone: string) => Promise<{ success: boolean; error?: string }>;
    userProfile: UserProfile | null;
}

export default function useLiffAuth(): UseLiffAuthReturn {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needsLink, setNeedsLink] = useState(false);
    const [linkProfile, setLinkProfile] = useState<any | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const { liff, loading: liffLoading, error: liffError } = useLiff(liffId);

    useEffect(() => {
        let mounted = true;
        async function init() {
            try {
                // =====================================================
                // DEVELOPMENT MODE: ใช้ Mock User
                // =====================================================
                const isDev = process.env.NODE_ENV === 'development';
                const useMockLiff = process.env.NEXT_PUBLIC_MOCK_LIFF === 'true';

                if (isDev && useMockLiff) {
                    console.log('🔧 Development Mode: Using Mock User Profile');

                    // Mock user profile สำหรับ development
                    const mockUserProfile: UserProfile = {
                        id: 'dev_user_001',
                        uid: 'dev_user_001',
                        lineId: 'dev_user_001',
                        name: 'Dev User (ทดสอบ)',
                        displayName: 'Dev User',
                        role: 'admin', // หรือ 'employee' ตามต้องการ
                        phone: '0812345678',
                        position: 'Developer',

                    };

                    // Sign in anonymously สำหรับ Firebase Auth ใน dev mode
                    // try {
                    //     const auth = getAuth();
                    //     await signInAnonymously(auth);
                    //     console.log('🔧 Firebase Anonymous Auth Success');
                    // } catch (authErr) {
                    //     console.warn('🔧 Firebase Anonymous Auth failed (ignored in dev):', authErr);
                    // }

                    setUserProfile(mockUserProfile);
                    setLoading(false);
                    return;
                }
                // =====================================================

                if (liffLoading) return;
                if (liffError) {
                    setError(liffError);
                    setLoading(false);
                    return;
                }

                if (!liff) {
                    setError('LIFF not available');
                    setLoading(false);
                    return;
                }

                const accessToken = typeof liff.getAccessToken === 'function' ? liff.getAccessToken() : null;
                if (!accessToken) {
                    setError('no access token');
                    setLoading(false);
                    return;
                }

                const resp = await fetch('/api/auth/line', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessToken }),
                });
                if (!resp.ok) {
                    const errBody = await resp.text();
                    throw new Error(`auth exchange failed: ${resp.status} ${errBody}`);
                }
                const body = await resp.json();
                if (body.needsLink) {
                    setNeedsLink(true);
                    setLinkProfile(body.profile || null);
                    setLoading(false);
                    return;
                }
                const { customToken, userProfile: receivedProfile } = body;

                if (receivedProfile) {
                    setUserProfile(receivedProfile);
                }

                const auth = getAuth();
                await signInWithCustomToken(auth, customToken);
                if (!mounted) return;
                setLoading(false);
            } catch (err: any) {
                console.error('useLiffAuth error', err);
                setError(err?.message || 'liff-error');
                setLoading(false);
            }
        }

        init();
        return () => { mounted = false; };
    }, [liff, liffLoading, liffError]);

    const linkByPhone = async (phone: string) => {
        setLoading(true);
        setError(null);
        try {
            if (!linkProfile?.lineId) throw new Error('no_profile');
            const resp = await fetch('/api/auth/line/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lineId: linkProfile.lineId, phone }),
            });
            const body = await resp.json();
            if (!resp.ok) {
                throw new Error(body?.error || 'link_failed');
            }
            const { customToken, userProfile: receivedProfile } = body;

            if (receivedProfile) {
                setUserProfile(receivedProfile);
            }

            const auth = getAuth();
            await signInWithCustomToken(auth, customToken);
            setNeedsLink(false);
            setLinkProfile(null);
            setLoading(false);
            return { success: true };
        } catch (err: any) {
            console.error('linkByPhone error', err);
            setError(err?.message || 'link-error');
            setLoading(false);
            return { success: false, error: err?.message };
        }
    };

    return { loading, error, needsLink, linkProfile, linkByPhone, userProfile };
}
