"use client";

import { useAuth } from "@/context/AuthContext";
import Image from 'next/image';

interface AdminHeaderProps {
    onMenuClick: () => void;
}

export default function AdminHeader({ onMenuClick }: AdminHeaderProps) {
    const { userProfile, logout } = useAuth();

    return (
        <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <button
                    onClick={onMenuClick}
                    className="md:hidden p-2 rounded bg-white/10 hover:bg-white/20 text-black"
                    aria-label="Open menu"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <p className="text-sm text-gray-600">{userProfile?.name || 'ไม่ระบุชื่อ'}</p>

                {userProfile?.imageUrl ? (
                    <Image src={userProfile.imageUrl} alt="avatar" width={40} height={40} className="rounded-full object-cover" unoptimized />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold">{userProfile?.name?.charAt(0) || 'U'}</div>
                )}
                <button onClick={() => { logout(); window.location.reload(); }} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">Logout</button>
            </div>
        </header>
    );
}
