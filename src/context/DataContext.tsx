"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Booking } from '@/types/booking';

interface DataContextType {
    bookings: Booking[];
    trips: Booking[];
    loading: boolean;
    error: string | null;
    lastFetch: Date | null;
    stats: {
        totalBookings: number;
        pendingBookings: number;
        approvedBookings: number;
        totalTrips: number;
        inProgressTrips: number;
        completedTrips: number;
    };
    refreshData: () => Promise<void>;
    addBooking: (newBooking: Booking) => void;
    updateBooking: (bookingId: string, updates: Partial<Booking>) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children, userId }: { children: React.ReactNode, userId?: string }) => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [trips, setTrips] = useState<Booking[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetch, setLastFetch] = useState<Date | null>(null);

    // Setup real-time listener
    useEffect(() => {
        if (!userId || !db) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Real-time listener สำหรับ bookings
            const bookingsRef = collection(db as any, 'bookings');
            const bookingsQuery = query(
                bookingsRef,
                where('userId', '==', userId),
                orderBy('createdAt', 'desc')
            );

            const unsubscribe = onSnapshot(
                bookingsQuery,
                (snapshot) => {
                    const bookingsData: Booking[] = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as Booking));

                    setBookings(bookingsData);

                    // แยก trips (approved + in-progress + completed)
                    const tripsData = bookingsData.filter(b =>
                        b.status === 'approved' ||
                        b.status === 'in-progress' ||
                        b.status === 'completed'
                    );
                    setTrips(tripsData);

                    setLastFetch(new Date());
                    setLoading(false);

                    console.log(`🔄 Real-time update: ${bookingsData.length} bookings, ${tripsData.length} trips`);
                },
                (err) => {
                    console.error('Error in real-time listener:', err);
                    setError(err.message);
                    setLoading(false);
                }
            );

            // Cleanup listener เมื่อ component unmount หรือ userId เปลี่ยน
            return () => {
                console.log('🔌 Unsubscribing from real-time updates');
                unsubscribe();
            };
        } catch (err: any) {
            console.error('Error setting up real-time listener:', err);
            setError(err.message);
            setLoading(false);
        }
    }, [userId]);

    // ฟังก์ชัน refresh (ไม่จำเป็นสำหรับ real-time แต่เก็บไว้ให้ backward compatible)
    const refreshData = useCallback(async () => {
        console.log('🔄 Manual refresh requested (real-time is already active)');
        setLastFetch(new Date());
        return Promise.resolve();
    }, []);

    // เพิ่ม booking ใหม่โดยไม่ต้อง refetch ทั้งหมด
    const addBooking = useCallback((newBooking: Booking) => {
        setBookings(prev => [newBooking, ...prev]);
        if (newBooking.status === 'approved') {
            setTrips(prev => [newBooking, ...prev]);
        }
    }, []);

    // อัปเดต booking (เช่น เปลี่ยน status)
    const updateBooking = useCallback((bookingId: string, updates: Partial<Booking>) => {
        setBookings(prev => prev.map(b =>
            b.id === bookingId ? { ...b, ...updates } : b
        ));
        setTrips(prev => prev.map(t =>
            t.id === bookingId ? { ...t, ...updates } : t
        ));
    }, []);

    // คำนวณข้อมูลสถิติ (memoized)
    const stats = useMemo(() => {
        const pending = bookings.filter(b => b.status === 'pending').length;
        const approved = bookings.filter(b => b.status === 'approved').length;
        const inProgress = trips.filter(t => t.status === 'in-progress').length;
        const completed = trips.filter(t => t.status === 'completed').length;

        return {
            totalBookings: bookings.length,
            pendingBookings: pending,
            approvedBookings: approved,
            totalTrips: trips.length,
            inProgressTrips: inProgress,
            completedTrips: completed
        };
    }, [bookings, trips]);

    const contextValue = useMemo(() => ({
        bookings,
        trips,
        loading,
        error,
        lastFetch,
        stats,
        refreshData,
        addBooking,
        updateBooking
    }), [bookings, trips, loading, error, lastFetch, stats, refreshData, addBooking, updateBooking]);

    return (
        <DataContext.Provider value={contextValue}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within DataProvider');
    }
    return context;
};
