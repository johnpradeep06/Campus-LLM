"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatInterface from "../components/ChatInterface";
import UploadComponent from "../components/Upload";

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
            setRole(storedRole);
            setLoading(false);
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        router.push('/login');
    };

    if (loading) return <div className="h-screen bg-[#212121] text-white flex items-center justify-center">Loading...</div>;

    return (
        <main className="h-screen w-full bg-[#212121] flex flex-col relative">
            <div className="absolute top-4 right-4 z-50">
                <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                    Logout
                </button>
            </div>

            {role === 'admin' && (
                <div className="bg-white p-4">
                    <UploadComponent />
                </div>
            )}

            <div className="flex-1 overflow-hidden">
                <ChatInterface />
            </div>
        </main>
    );
}
