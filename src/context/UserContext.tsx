"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import Script from "next/script";
import { UserProfile } from "@/types/user";

interface UserContextType {
    user: UserProfile | null;
    loading: boolean;
    lineUserId: string | null;
    lineProfile: any | null;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
    user: null,
    loading: true,
    lineUserId: null,
    lineProfile: null,
    refreshUser: async () => { },
});

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [lineUserId, setLineUserId] = useState<string | null>(null);
    const [lineProfile, setLineProfile] = useState<any | null>(null);
    const [liffReady, setLiffReady] = useState(false);

    const initLiff = async () => {
        try {
            // Wait for LIFF SDK to be available
            if (!window.liff) {
                console.error("LIFF SDK not loaded");
                setLoading(false);
                return;
            }

            const liff = window.liff;
            console.log("Initializing LIFF...");

            const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
            if (!liffId) {
                console.error("LIFF ID not found");
                setLoading(false);
                return;
            }

            // Initialize LIFF
            await liff.init({ liffId });
            console.log("LIFF initialized successfully");
            setLiffReady(true);

            // Check if user is logged in
            if (liff.isLoggedIn()) {
                console.log("User is logged in via LINE");
                const profile = await liff.getProfile();
                console.log("LINE Profile:", profile);
                setLineUserId(profile.userId);
                setLineProfile(profile);
                await fetchUser(profile.userId, profile);
            } else {
                console.log("User is not logged in");
                // Development mode check
                const isDev = process.env.NODE_ENV === 'development';
                const useMockLiff = process.env.NEXT_PUBLIC_MOCK_LIFF === 'true';

                if (isDev && useMockLiff) {
                    console.log("🔧 Development Mode: Using Mock User");
                    const mockLineId = 'dev_user_001';
                    const mockProfile = {
                        userId: mockLineId,
                        displayName: 'Dev User',
                        pictureUrl: ''
                    };
                    setLineUserId(mockLineId);
                    setLineProfile(mockProfile);

                    // Mock user for development
                    setUser({
                        id: mockLineId,
                        uid: mockLineId,
                        lineId: mockLineId,
                        name: 'Dev User (ทดสอบ)',
                        displayName: 'Dev User',
                        role: 'admin',
                        phone: '0812345678',
                        position: 'Developer',
                    });
                    setLoading(false);
                    return;
                }

                // Auto login if not in LIFF client
                if (!liff.isInClient()) {
                    console.log("Not in LINE app, redirecting to login...");
                    liff.login();
                } else {
                    setLoading(false);
                }
            }
        } catch (error) {
            console.error("LIFF Initialization failed:", error);
            setLoading(false);
        }
    };

    const fetchUser = async (lineId: string, profile?: any) => {
        try {
            if (!db) {
                console.error("Firestore not initialized");
                setLoading(false);
                return;
            }

            // Query user by lineId
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('lineId', '==', lineId));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                const userData = userDoc.data();

                // Update user with LINE profile info
                const userProfile: UserProfile = {
                    id: userDoc.id,
                    uid: userDoc.id,
                    ...userData,
                    displayName: profile?.displayName || userData.displayName,
                    pictureUrl: profile?.pictureUrl || userData.pictureUrl,
                } as UserProfile;

                setUser(userProfile);
                console.log("User found:", userProfile);
            } else {
                console.log("User not found with lineId:", lineId);
                setUser(null);
            }
        } catch (error: any) {
            console.error("Error fetching user:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const refreshUser = async () => {
        if (lineUserId) {
            setLoading(true);
            await fetchUser(lineUserId, lineProfile);
        }
    };

    return (
        <UserContext.Provider value={{ user, loading, lineUserId, lineProfile, refreshUser }}>
            <Script
                src="https://static.line-scdn.net/liff/edge/2/sdk.js"
                onLoad={initLiff}
                strategy="afterInteractive"
            />
            {children}
        </UserContext.Provider>
    );
}

export const useUser = () => useContext(UserContext);

// Type declaration for window.liff
declare global {
    interface Window {
        liff: any;
    }
}
