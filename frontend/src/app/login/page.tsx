'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        try {
            const res = await fetch('http://localhost:8000/token', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                throw new Error('Login failed. Check credentials.');
            }

            const data = await res.json();
            localStorage.setItem('token', data.access_token);

            // Fetch user role
            const userRes = await fetch('http://localhost:8000/users/me', {
                headers: {
                    'Authorization': `Bearer ${data.access_token}`
                }
            });
            const userData = await userRes.json();
            localStorage.setItem('role', userData.role);

            router.push('/');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md">
                <h2 className="text-2xl font-bold text-center">Login</h2>
                {error && <p className="text-red-500 text-center">{error}</p>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-2 border rounded text-black"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border rounded text-black"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Sign In
                    </button>
                </form>
                <div className="text-center">
                    <a href="/register" className="text-blue-500 hover:underline">
                        Create an account
                    </a>
                </div>
            </div>
        </div>
    );
}
