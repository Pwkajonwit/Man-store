"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Icons
const Icons = {
    Dashboard: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
    ),
    Check: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    Tool: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    History: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    Users: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    ),
    Settings: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    Repair: ({ className }: { className?: string }) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
    ),
};

// Navigation items
const navItems = [
    { href: '/equipment-usage-realtime', label: 'ใช้งานอุปกรณ์', icon: Icons.Dashboard, match: ['/equipment-usage-realtime', '/equipment-usage-realtime'] },
    { href: '/return-approvals', label: 'อนุมัติการคืน', icon: Icons.Check, match: ['/return-approvals'] },
    { href: '/equipment-analysis', label: 'ภาพรวม', icon: Icons.Dashboard, match: ['/equipment-analysis', '/dashboard'] },
    { href: '/equipment', label: 'จัดการอุปกรณ์', icon: Icons.Tool, match: ['/equipment'] },
    { href: '/repairs', label: 'ซ่อมอุปกรณ์', icon: Icons.Repair, match: ['/repairs'] },
    { href: '/equipment-history', label: 'ประวัติการยืม-เบิก', icon: Icons.History, match: ['/equipment-history'] },
    { href: '/users', label: 'จัดการผู้ใช้งาน', icon: Icons.Users, match: ['/users'] },
    { href: '/settings', label: 'การตั้งค่า', icon: Icons.Settings, match: ['/settings'] },
];

export default function AdminSidebar({ isOpen = false, onClose = () => { } }: { isOpen?: boolean, onClose?: () => void }) {
    //   const router = useRouter(); // Removed unused
    const { userProfile } = useAuth(); // Removed logout unused
    const pathname = usePathname();

    // Check if current path matches nav item
    const isActive = (item: { match: string[] }) => {
        return item.match.some(m => pathname === m || pathname?.startsWith(m + '/'));
    };

    // If userProfile is not present yet, or role disallows admin UI, don't render sidebar
    if (!userProfile) return null;
    const role = userProfile.role;
    if (role !== 'admin' && role !== 'employee') return null;

    // Desktop sidebar
    const desktop = (
        <aside className="hidden md:flex w-64 p-4 text-white gradient-bg shrink-0 flex-col justify-between">
            <div>
                <h2 className="mb-8 text-2xl font-bold">Admin Panel</h2>
                <nav>
                    <ul className="space-y-2">
                        {navItems.map((item) => {
                            const active = isActive(item);
                            const Icon = item.icon;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${active
                                            ? 'bg-white text-gray-900 font-semibold shadow-lg'
                                            : 'hover:bg-white/20'
                                            }`}
                                        aria-current={active ? 'page' : undefined}
                                    >
                                        <Icon className={`w-5 h-5 ${active ? 'text-teal-600' : ''}`} />
                                        <span>{item.label}</span>
                                        {active && (
                                            <span className="ml-auto w-2 h-2 rounded-full bg-teal-500"></span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </div>
        </aside>
    );

    // Mobile drawer
    const mobile = (
        <div className={`fixed inset-0 z-50 md:hidden ${isOpen ? '' : 'pointer-events-none'}`} aria-hidden={!isOpen}>
            <div
                className={`fixed inset-0 bg-black/40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <aside className={`fixed left-0 top-0 w-64 h-[100vh] p-4 gradient-bg text-white transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Admin Panel</h2>
                    <button onClick={onClose} aria-label="Close menu" className="p-2 rounded bg-white/10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <nav>
                    <ul className="space-y-2">
                        {navItems.map((item) => {
                            const active = isActive(item);
                            const Icon = item.icon;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${active
                                            ? 'bg-white text-gray-900 font-semibold shadow-lg'
                                            : 'hover:bg-white/20'
                                            }`}
                                        onClick={onClose}
                                    >
                                        <Icon className={`w-5 h-5 ${active ? 'text-teal-600' : ''}`} />
                                        <span>{item.label}</span>
                                        {active && (
                                            <span className="ml-auto w-2 h-2 rounded-full bg-teal-500"></span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>
        </div>
    );

    return (
        <>
            {desktop}
            {mobile}
        </>
    );
}
