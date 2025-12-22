"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface LineSettings {
    userChatMessage: boolean;
    groupId: string;
}

interface AppSettingsContextType {
    lineSettings: LineSettings;
    loading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [lineSettings, setLineSettings] = useState<LineSettings>({
        userChatMessage: false,
        groupId: '',
    });
    const [loading, setLoading] = useState<boolean>(true);

    // Load settings once when app starts
    useEffect(() => {
        async function loadSettings() {
            try {
                if (!db) return;
                const docRef = doc(db, "settings", "notifications");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setLineSettings({
                        userChatMessage: data.line?.userChatMessage ?? false,
                        groupId: data.line?.groupId || '',
                    });
                }
            } catch (e) {
                console.error("Error loading settings:", e);
            }
            setLoading(false);
        }
        loadSettings();
    }, []);

    const contextValue = useMemo(() => ({
        lineSettings,
        loading,
    }), [lineSettings, loading]);

    return (
        <AppSettingsContext.Provider value={contextValue}>
            {children}
        </AppSettingsContext.Provider>
    );
};

export const useAppSettings = () => {
    const context = useContext(AppSettingsContext);
    if (!context) {
        // Return default values if not in provider (for safety)
        return { lineSettings: { userChatMessage: false, groupId: '' }, loading: false };
    }
    return context;
};
