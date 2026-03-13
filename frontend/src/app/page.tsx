"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatInterface from "../components/ChatInterface";

export default function Home() {
    const router = useRouter();
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedRole = localStorage.getItem('role');

        if (!token) {
            router.push('/login');
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRole(storedRole);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        router.push('/login');
    };

    if (loading) return <div className="h-[100dvh] bg-[#212121] text-white flex items-center justify-center">Loading...</div>;

    return (
        <main className="h-[100dvh] w-full bg-[#212121] flex flex-col relative overflow-hidden">
            {/* Top Right Controls */}
            <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
                {role === 'admin' && (
                    <button
                        onClick={() => router.push('/campus_admin')}
                        className="bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/20 transition-all border border-white/10"
                    >
                        Admin Dashboard
                    </button>
                )}
                <button
                    onClick={handleLogout}
                    className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500 hover:text-white transition-all"
                >
                    Logout
                </button>
            </div>

            <div className="flex-1 w-full h-full">
                <ChatInterface />
            </div>
        </main>
    );
}
