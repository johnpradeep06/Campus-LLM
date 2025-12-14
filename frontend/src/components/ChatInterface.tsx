"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Menu, Plus, User, Bot, Loader2 } from "lucide-react";
import { askRag } from "../../lib/app";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type Message = {
    role: "user" | "assistant";
    content: string;
};

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const data = await askRag(userMessage);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.answer },
            ]);
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

    return (
        <div className="flex h-screen w-full bg-[#212121] text-gray-100 font-sans overflow-hidden">
            {/* Sidebar */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-[260px] bg-[#171717] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 border-r border-white/10",
                    !sidebarOpen && "-translate-x-full hidden md:block md:w-0 md:border-none overflow-hidden"
                )}
            >
                <div className="flex flex-col h-full p-2">
                    <button
                        onClick={() => setMessages([])}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition-colors text-sm text-white mb-4 border border-white/20"
                    >
                        <Plus size={16} />
                        New chat
                    </button>

                    <div className="flex-1 overflow-y-auto">
                        <div className="text-xs font-semibold text-gray-400 px-3 py-2">Today</div>
                        {/* Mock History Items */}
                        <div className="px-3 py-2 text-sm text-gray-100 truncate hover:bg-white/10 rounded-lg cursor-pointer">
                            Introduction to RAG
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-2">
                        <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">
                                U
                            </div>
                            <div className="text-sm font-medium">User</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full relative">
                {/* Mobile Header */}
                <div className="sticky top-0 z-10 flex items-center p-2 text-gray-200 md:hidden bg-[#212121]">
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-md">
                        <Menu size={24} />
                    </button>
                    <span className="ml-4 font-medium">Chat</span>
                </div>

                {/* Desktop Toggle (absolute) */}
                <div className={`absolute top-2 left-2 z-20 hidden md:block ${!sidebarOpen ? 'block' : 'hidden'}`}>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                        title="Open Sidebar"
                    >
                        <Menu size={20} />
                    </button>
                </div>
                <div className={`absolute top-2 left-2 z-20 hidden md:block ${sidebarOpen ? 'block' : 'hidden'}`}>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                        title="Close Sidebar"
                    >
                        <Menu size={20} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg">
                                <Bot size={32} className="text-black" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">How can I help you today?</h2>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center w-full pb-32 pt-10">
                            {messages.map((msg, idx) => (
                                <div key={idx} className="w-full max-w-3xl px-4 py-6 md:py-8 border-b border-black/5 dark:border-white/5 hover:bg-white/5 transition-colors rounded-lg">
                                    <div className="flex gap-4 md:gap-6">
                                        <div className="flex-shrink-0 flex flex-col relative items-end">
                                            {msg.role === 'user' ? (
                                                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-md">
                                                    <User size={16} />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white shadow-md">
                                                    <Bot size={16} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative flex-1 overflow-hidden">
                                            <div className="font-semibold text-sm mb-1 opacity-90">
                                                {msg.role === 'user' ? 'You' : 'Assistant'}
                                            </div>
                                            <div className="prose prose-invert max-w-none text-gray-200 leading-7 whitespace-pre-wrap">
                                                {msg.content}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="w-full max-w-3xl px-4 py-8">
                                    <div className="flex gap-4 md:gap-6">
                                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-md">
                                            <Bot size={16} />
                                        </div>
                                        <div className="flex items-center">
                                            <Loader2 size={20} className="animate-spin text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="w-full max-w-3xl mx-auto px-4 pb-6 pt-2">
                    <div className="relative flex items-end w-full p-3 bg-[#2f2f2f] rounded-2xl border border-white/10 shadow-xl focus-within:border-white/20">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            placeholder="Message ChatGPT..."
                            className="w-full bg-transparent text-white placeholder-gray-400 resize-none focus:outline-none max-h-[200px] min-h-[44px] py-3 pl-2 custom-scrollbar"
                            style={{ height: 'auto', minHeight: '44px' }}
                        />
                        <button
                            onClick={() => handleSubmit()}
                            disabled={!input.trim() || isLoading}
                            className="p-2 rounded-lg bg-white disabled:bg-white/20 disabled:text-gray-400 text-black hover:opacity-90 transition-colors mb-1 mr-1"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                    <div className="text-center mt-2 text-xs text-gray-500">
                        AI can make mistakes. Consider checking important information.
                    </div>
                </div>
            </div>
        </div>
    );
}
