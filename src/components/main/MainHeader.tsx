"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { UserProfile } from '@/types/user';

interface MainHeaderProps {
    userProfile: UserProfile | null;
    activeTab?: string;
    setActiveTab?: (tab: string) => void;
}

export default function MainHeader({ userProfile, activeTab, setActiveTab }: MainHeaderProps) {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!setActiveTab) return;
        if (pathname?.startsWith('/my-equipment')) {
            setActiveTab('my-equipment');
        } else if (pathname?.startsWith('/equipment-selection')) {
            setActiveTab('borrow');
        } else if (pathname?.startsWith('/my-history')) {
            setActiveTab('history');
        } else if (pathname?.startsWith('/report-repair')) {
            setActiveTab('report-repair');
        }
    }, [pathname, setActiveTab]);

    return (
        <div className="gradient-bg px-6 pt-8 pb-24">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-md overflow-hidden border border-white bg-teal-800">
                        {(userProfile?.imageUrl || userProfile?.pictureUrl || userProfile?.photoURL) ? (
                            <Image
                                src={userProfile.imageUrl || userProfile.pictureUrl || userProfile.photoURL || ''}
                                alt={userProfile?.name || 'user'}
                                width={56}
                                height={56}
                                className="w-full h-full object-cover"
                                unoptimized
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-semibold text-xl">
                                {userProfile?.name?.charAt(0) || 'U'}
                            </div>
                        )}
                    </div>
                    <div className="text-white">
                        <p className="font-semibold text-lg">{userProfile?.name || 'ผู้ใช้งาน'}</p>
                        <p className="text-sm text-teal-100">{userProfile?.position || 'พนักงาน'}</p>
                    </div>
                </div>

            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => {
                        router.push('/equipment-selection');
                        if (typeof setActiveTab === 'function') setActiveTab('borrow');
                    }}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm border-0 focus:outline-none ${activeTab === 'borrow'
                        ? 'bg-teal-900 text-white ring-2 ring-teal-200/20'
                        : 'bg-teal-500/40 text-teal-100 hover:bg-teal-500/70'
                        }`}
                >
                    ยืม/เบิก
                </button>
                <button
                    onClick={() => {
                        router.push('/my-equipment');
                        if (typeof setActiveTab === 'function') setActiveTab('my-equipment');
                    }}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm border-0 focus:outline-none ${activeTab === 'my-equipment'
                        ? 'bg-teal-900 text-white ring-2 ring-teal-200/20'
                        : 'bg-teal-500/40 text-teal-100 hover:bg-teal-500/70'
                        }`}
                >
                    ที่กำลังยืม
                </button>
                <button
                    onClick={() => {
                        router.push('/my-history');
                        if (typeof setActiveTab === 'function') setActiveTab('history');
                    }}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm border-0 focus:outline-none ${activeTab === 'history'
                        ? 'bg-teal-900 text-white ring-2 ring-teal-200/20'
                        : 'bg-teal-500/40 text-teal-100 hover:bg-teal-500/70'
                        }`}
                >
                    ประวัติ
                </button>
                <button
                    onClick={() => {
                        router.push('/report-repair');
                        if (typeof setActiveTab === 'function') setActiveTab('report-repair');
                    }}
                    className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm border-0 focus:outline-none ${activeTab === 'report-repair'
                        ? 'bg-teal-900 text-white ring-2 ring-teal-200/20'
                        : 'bg-teal-500/40 text-teal-100 hover:bg-teal-500/70'
                        }`}
                >
                    แจ้งซ่อม
                </button>
            </div>
        </div>
    );
}
