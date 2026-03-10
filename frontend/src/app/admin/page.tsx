"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UploadComponent from "../../components/Upload";
import { ArrowLeft, LayoutDashboard, Database, Settings, FileText, Clock } from "lucide-react";

type UploadedFile = {
    filename: string;
    size: number;
    uploaded_at: string;
};

export default function AdminPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<UploadedFile[]>([]);

    const fetchFiles = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('https://campus-llm-production.up.railway.app/files', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Sort by newest first
                setFiles(data.sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()));
            }
        } catch (error) {
            console.error("Failed to fetch files", error);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');

        if (!token || role !== 'admin') {
            router.push('/');
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
            fetchFiles();
        }
    }, [router]);

    if (loading) return <div className="min-h-[100dvh] bg-[#121212] text-white flex items-center justify-center">Loading Admin...</div>;

    return (
        <main className="h-[100dvh] overflow-y-auto w-full bg-[#121212] flex flex-col items-center custom-scrollbar">
            {/* Navigation Bar */}
            <div className="w-full bg-[#1a1a1a] border-b border-white/5 p-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
                <div className="flex items-center gap-4 px-2 md:px-6">
                    <button
                        onClick={() => router.push('/')}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                        title="Back to Chat"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2 text-white font-medium text-lg">
                        <LayoutDashboard size={20} className="text-purple-500" />
                        Admin Dashboard
                    </div>
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="w-full max-w-5xl p-6 md:p-10 flex flex-col gap-8 flex-1">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Knowledge Base</h1>
                        <p className="text-gray-400 text-sm">Upload, index, and manage documents to empower Shadow AI&apos;s knowledge retrieval.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* Main Upload Box */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <UploadComponent onUploadSuccess={fetchFiles} />

                        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl flex-1 flex flex-col min-h-[300px]">
                            <h3 className="font-medium text-white flex items-center gap-2 mb-4">
                                <FileText size={18} className="text-purple-400" />
                                Uploaded Documents
                            </h3>
                            {files.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">No documents found. Upload one to start tracking.</div>
                            ) : (
                                <div className="flex flex-col gap-3 overflow-y-auto flex-1 custom-scrollbar pr-2 min-h-0">
                                    {files.map((f, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                                    <FileText size={14} className="text-purple-400" />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-medium text-white truncate">{f.filename}</p>
                                                    <p className="text-xs text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
                                                <Clock size={12} />
                                                <span>{new Date(f.uploaded_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats / Info sidebar */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl">
                            <h3 className="font-medium text-white flex items-center gap-2 mb-4">
                                <Database size={18} className="text-blue-400" />
                                Database Status
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">Vector Store</span>
                                    <span className="text-green-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Online</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">Embedding Model</span>
                                    <span className="text-gray-200">Active</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 shadow-xl opacity-70">
                            <h3 className="font-medium text-white flex items-center gap-2 mb-4">
                                <Settings size={18} className="text-gray-400" />
                                Advanced Settings
                            </h3>
                            <p className="text-sm text-gray-500 leading-relaxed mb-4">
                                Chunking settings and distance metrics are currently configured by the backend pipeline.
                            </p>
                            <button className="w-full py-2 bg-white/5 hover:bg-white/10 text-xs text-white rounded-lg transition-colors cursor-not-allowed">
                                Manage Settings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
