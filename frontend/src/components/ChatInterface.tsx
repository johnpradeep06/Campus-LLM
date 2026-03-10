"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Menu, Plus, Bot, Loader2, MessageSquare, X, Globe, Building, Calendar, GraduationCap, BookOpen, Briefcase } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from "next/navigation";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type Message = {
    role: "user" | "assistant";
    content: string;
};

type ChatSession = {
    id: number;
    title: string;
    created_at: string;
};

const SUGGESTED_QUERIES = [
    { text: "What is the hostel fee structure for 2026?", icon: Building, label: "Hostel fees" },
    { text: "When does the next semester begin?", icon: Calendar, label: "Academic calendar" },
    { text: "What is the S grade policy", icon: GraduationCap, label: "Grades" },
    { text: "what happens if i caught for malpractice during CAT exams", icon: BookOpen, label: "Malpractice" },
    { text: "Do we have placement training during weekend in final year", icon: Briefcase, label: "Placements" },
];

const PLACEHOLDERS = [
    "Ask anything...",
    "When does campus placement start?",
    "What is the average package for CSE?",
    "Library open hours?"
];

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const [currentPlaceholder, setCurrentPlaceholder] = useState("");
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const timeoutContext = setTimeout(() => {
            const fullText = PLACEHOLDERS[placeholderIndex];

            if (!isDeleting) {
                setCurrentPlaceholder(fullText.substring(0, currentPlaceholder.length + 1));
                if (currentPlaceholder.length === fullText.length) {
                    setTimeout(() => setIsDeleting(true), 1500);
                }
            } else {
                setCurrentPlaceholder(fullText.substring(0, currentPlaceholder.length - 1));
                if (currentPlaceholder.length === 0) {
                    setIsDeleting(false);
                    setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
                }
            }
        }, isDeleting ? 30 : 50);

        return () => clearTimeout(timeoutContext);
    }, [currentPlaceholder, isDeleting, placeholderIndex]);

    useEffect(() => {
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchSessions = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                return;
            }
            const res = await fetch('https://campus-llm-production.up.railway.app/sessions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                router.push('/login');
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        }
    };

    const loadSession = async (sessionId: number) => {
        setCurrentSessionId(sessionId);
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`https://campus-llm-production.up.railway.app/sessions/${sessionId}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                router.push('/login');
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
            }
        } catch (error) {
            console.error("Failed to load session", error);
        } finally {
            setIsLoading(false);
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleSubmit = async (e?: React.FormEvent, overrideInput?: string) => {
        e?.preventDefault();
        const textToSubmit = overrideInput !== undefined ? overrideInput : input;
        if (!textToSubmit.trim() || isLoading) return;

        const userMessage = textToSubmit.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            let activeSessionId = currentSessionId;

            if (!activeSessionId) {
                const createRes = await fetch('https://campus-llm-production.up.railway.app/sessions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (createRes.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('role');
                    router.push('/login');
                    return;
                }
                if (createRes.ok) {
                    const newSession = await createRes.json();
                    activeSessionId = newSession.id;
                    setCurrentSessionId(activeSessionId);
                } else {
                    throw new Error("Failed to create session");
                }
            }

            const askRes = await fetch(`https://campus-llm-production.up.railway.app/sessions/${activeSessionId}/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ question: userMessage, session_id: activeSessionId })
            });

            if (askRes.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                router.push('/login');
                return;
            }

            if (!askRes.ok) throw new Error("Failed to get answer");

            const data = await askRes.json();
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.answer },
            ]);

            fetchSessions();
        } catch (error) {
            console.error(error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, I had trouble connecting to the server. Please check your backend connection." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const renderMessageContent = (content: string) => {
        const sourcesMatch = content.match(/\*\*Sources:\*\*\s*\n([\s\S]+)/);
        let mainContent = content;
        const sources: { title: string, uri: string }[] = [];

        if (sourcesMatch) {
            mainContent = content.replace(sourcesMatch[0], '').trim();
            const sourcesText = sourcesMatch[1];
            const sourceRegex = /-\s+\[(.*?)\]\((.*?)\)/g;
            let match;
            while ((match = sourceRegex.exec(sourcesText)) !== null) {
                sources.push({ title: match[1], uri: match[2] });
            }
        }

        return (
            <div className="flex flex-col w-full min-w-0">
                <div className="flex-1 text-[15px] leading-relaxed break-words mt-1.5 md:mt-2 text-gray-200 space-y-4 w-full">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            ul: (props) => <ul className="list-disc pl-6 space-y-1 mb-4" {...props} />,
                            ol: (props) => <ol className="list-decimal pl-6 space-y-1 mb-4" {...props} />,
                            li: (props) => <li className="pl-1 marker:text-gray-500" {...props} />,
                            h1: (props) => <h1 className="text-2xl font-bold mt-6 mb-3 text-white" {...props} />,
                            h2: (props) => <h2 className="text-xl font-bold mt-5 mb-3 text-white pb-1 border-b border-white/10" {...props} />,
                            h3: (props) => <h3 className="text-lg font-bold mt-4 mb-2 text-white" {...props} />,
                            p: (props) => <p className="mb-4 last:mb-0 leading-relaxed" {...props} />,
                            a: (props) => <a className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors" target="_blank" rel="noreferrer" {...props} />,
                            code: ({ className, children, ...props }) => {
                                const match = /language-(\w+)/.exec(className || '')
                                return match ? (
                                    <pre className="block bg-[#121212] p-4 rounded-xl text-sm font-mono my-4 overflow-x-auto border border-white/5 shadow-inner max-w-full">
                                        <code className={cn("text-gray-300", className)} {...props as any}>
                                            {children}
                                        </code>
                                    </pre>
                                ) : (
                                    <code className="bg-white/10 rounded-md px-1.5 py-0.5 text-[0.9em] font-mono text-purple-300" {...props as any}>
                                        {children}
                                    </code>
                                )
                            },
                            strong: (props) => <strong className="font-semibold text-white" {...props} />,
                            blockquote: (props) => <blockquote className="border-l-2 border-purple-500/50 pl-4 py-1 italic text-gray-400 my-4 bg-purple-500/5 rounded-r-lg" {...props} />,
                            table: (props) => <div className="w-full overflow-x-auto my-4 max-w-full"><table className="w-full text-sm text-left border-collapse border border-white/10 rounded-lg overflow-hidden" {...props} /></div>,
                            th: (props) => <th className="bg-[#2f2f2f] p-3 border-b border-white/10 font-semibold text-gray-200" {...props} />,
                            td: (props) => <td className="p-3 border-b border-white/5 last:border-0" {...props} />,
                        }}
                    >
                        {mainContent}
                    </ReactMarkdown>
                </div>

                {sources.length > 0 && (
                    <div className="w-full mt-5 border-t border-white/10 pt-4">
                        <div className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                            <Globe size={13} className="text-gray-400" />
                            Sources
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {sources.map((src, i) => (
                                <a
                                    key={i}
                                    href={src.uri}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group flex flex-col justify-center bg-[#1c1c1c] hover:bg-[#2a2a2a] border border-white/10 hover:border-white/20 rounded-xl px-2.5 py-2.5 transition-all text-left w-full shadow-sm overflow-hidden"
                                >
                                    <div className="flex items-center gap-2 mb-1 text-xs">
                                        <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-gray-300 font-medium shrink-0 group-hover:bg-white/20 transition-colors">
                                            {i + 1}
                                        </div>
                                        <span className="text-sm font-medium text-gray-200 truncate w-full flex-1">
                                            {src.title}
                                        </span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-full w-full bg-[#212121] text-gray-100 font-sans overflow-hidden">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/70 z-30 md:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-40 w-[260px] bg-[#171717] transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col border-r border-white/5",
                    !sidebarOpen && "-translate-x-full md:w-0 md:opacity-0 md:border-none overflow-hidden"
                )}
            >
                <div className="flex flex-col h-full p-3 w-[260px]">
                    <div className="flex items-center justify-between mb-4 md:hidden text-gray-400 px-1 pt-1">
                        <span className="font-semibold text-white">Menu</span>
                        <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-white/10 rounded-md transition-colors" title="Close Sidebar">
                            <X size={20} />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            setMessages([]);
                            setCurrentSessionId(null);
                            if (window.innerWidth < 768) setSidebarOpen(false);
                        }}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-colors text-sm text-white border border-white/5 shadow-sm"
                    >
                        <Plus size={16} />
                        New chat
                    </button>

                    <div className="flex-1 overflow-y-auto mt-6 custom-scrollbar pr-2">
                        <div className="text-xs font-semibold text-gray-500 px-3 py-2 mb-1">Recent Chats</div>
                        {sessions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500 italic">No previous chats</div>
                        ) : (
                            sessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => loadSession(session.id)}
                                    className={cn(
                                        "px-3 py-2.5 text-sm truncate rounded-lg cursor-pointer transition-all mb-1 flex items-center gap-3 border",
                                        currentSessionId === session.id
                                            ? "bg-white/10 text-white font-medium border-white/10 shadow-sm"
                                            : "text-gray-300 hover:bg-white/5 border-transparent"
                                    )}
                                >
                                    <MessageSquare size={14} className={currentSessionId === session.id ? "text-white" : "text-gray-500"} />
                                    <span className="truncate">{session.title}</span>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="border-t border-white/5 pt-3 mt-2">
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                U
                            </div>
                            <div className="text-sm font-medium text-gray-200">User</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
                {/* Header */}
                <div className="sticky top-0 z-50 flex items-center p-3 text-gray-200 pointer-events-none">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors pointer-events-auto"
                        title="Toggle Sidebar"
                    >
                        <Menu size={20} />
                    </button>
                    <span className="ml-3 font-medium text-lg text-gray-200 md:hidden">Chat</span>
                </div>

                {/* Messages Area */}
                {messages.length > 0 && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar w-full flex flex-col items-center">
                        <div className="flex flex-col w-full max-w-3xl pb-4 pt-4 px-4 md:px-0">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={cn("flex w-full mt-6 first:mt-0", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                    {msg.role === 'user' ? (
                                        <div className="max-w-[85%] md:max-w-[75%] bg-[#2f2f2f] text-gray-100 rounded-3xl px-5 py-3.5 shadow-sm text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                                            {msg.content}
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 w-full">
                                            <div className="w-8 h-8 md:w-9 md:h-9 bg-white rounded-full flex items-center justify-center text-[#212121] flex-shrink-0 mt-1 shadow-sm border border-white/10">
                                                <Bot size={18} />
                                            </div>
                                            {renderMessageContent(msg.content)}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex w-full mt-6 justify-start">
                                    <div className="flex gap-4 w-full">
                                        <div className="w-8 h-8 md:w-9 md:h-9 bg-white rounded-full flex items-center justify-center text-[#212121] flex-shrink-0 mt-1 shadow-sm border border-white/10">
                                            <Bot size={18} />
                                        </div>
                                        <div className="flex flex-col gap-3 w-full max-w-2xl mt-1.5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-300 font-medium text-[15px] animate-pulse">Searching sources</span>
                                                <div className="flex -space-x-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center animate-bounce shadow-sm z-30" style={{ animationDelay: '0ms' }}><Globe size={11} className="text-blue-400" /></div>
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center animate-bounce shadow-sm z-20" style={{ animationDelay: '150ms' }}><BookOpen size={11} className="text-emerald-400" /></div>
                                                    <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center animate-bounce shadow-sm z-10" style={{ animationDelay: '300ms' }}><GraduationCap size={11} className="text-purple-400" /></div>
                                                </div>
                                            </div>
                                            <div className="space-y-2.5 mt-2">
                                                <div className="h-4 bg-white/5 rounded-md w-full animate-pulse"></div>
                                                <div className="h-4 bg-white/5 rounded-md w-5/6 animate-pulse"></div>
                                                <div className="h-4 bg-white/5 rounded-md w-4/6 animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className={cn(
                    "w-full px-4 md:px-0 flex flex-col items-center z-20 shrink-0 transition-all duration-500",
                    messages.length === 0 ? "flex-1 justify-center mt-[-8vh]" : "bg-[#212121] pt-4 pb-6 justify-end"
                )}>
                    <div className="w-full max-w-3xl relative flex flex-col items-center">
                        {messages.length === 0 && (
                            <h2 className="text-3xl md:text-4xl font-medium text-white mb-8 tracking-tight text-center">
                                How can I help you today?
                            </h2>
                        )}

                        <style>{`
                            @keyframes spin-slow {
                                from { transform: translate(-50%, -50%) rotate(0deg); }
                                to { transform: translate(-50%, -50%) rotate(360deg); }
                            }
                        `}</style>
                        <div className="relative w-full rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.3)] group overflow-hidden">
                            <div
                                className={cn(
                                    "absolute top-1/2 left-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_40%,rgba(255,255,255,1)_100%)] rounded-full z-0 pointer-events-none transition-opacity duration-500",
                                    isLoading ? "opacity-100" : "opacity-0"
                                )}
                                style={{ animation: 'spin-slow 3s linear infinite' }}
                            />

                            <div className="relative flex flex-col w-[calc(100%-4px)] bg-[#2a2a2a] group-focus-within:bg-[#2f2f2f] rounded-[14px] m-[1px] transition-colors duration-300 z-10">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                    placeholder={currentPlaceholder + (isDeleting ? "" : "|")}
                                    className="w-full bg-transparent text-white placeholder-gray-400 resize-none focus:outline-none min-h-[56px] py-4 px-5 text-[15px] custom-scrollbar"
                                    style={{ height: 'auto', minHeight: '56px' }}
                                    rows={1}
                                />
                                <div className="flex items-center justify-between px-3 pb-3">
                                    <div className="flex items-center gap-2">
                                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors text-xs font-medium">
                                            <Bot size={14} />
                                            Model
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleSubmit()}
                                        disabled={!input.trim() || isLoading}
                                        className={cn(
                                            "p-2 rounded-full transition-all flex items-center justify-center w-8 h-8 outline-none",
                                            input.trim() && !isLoading ? "bg-white text-black shadow-md hover:scale-105" : "bg-white/5 text-gray-500 cursor-not-allowed"
                                        )}
                                    >
                                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} className="ml-0.5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {messages.length === 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6 w-full px-2">
                                {SUGGESTED_QUERIES.map((query, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSubmit(undefined, query.text)}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1c1c1c] border border-white/5 hover:bg-[#2a2a2a] hover:border-white/20 text-gray-300 hover:text-white transition-all text-[13px] font-medium shadow-sm hover:shadow-md"
                                    >
                                        <query.icon size={15} className="text-gray-400" />
                                        {query.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {messages.length > 0 && (
                            <div className="text-center mt-3 text-xs text-gray-500 font-medium tracking-wide">
                                Shadow AI can make mistakes. Consider checking important information.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
