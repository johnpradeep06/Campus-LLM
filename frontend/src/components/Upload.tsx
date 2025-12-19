'use client';

import { useState } from 'react';

export default function UploadComponent() {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('Uploading...');
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('token');

        try {
            const res = await fetch('http://localhost:8000/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });

            if (!res.ok) {
                throw new Error('Upload failed');
            }

            setStatus('Upload successful and file indexed!');
        } catch (err) {
            setStatus('Error uploading file.');
        }
    };

    return (
        <div className="p-4 border rounded bg-gray-50 mb-6">
            <h3 className="font-bold mb-2 text-black">Admin: Upload Knowledge</h3>
            <div className="flex gap-4">
                <input type="file" onChange={handleFileChange} className="text-black" />
                <button
                    onClick={handleUpload}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                >
                    Upload & Index
                </button>
            </div>
            {status && <p className="mt-2 text-sm text-gray-700">{status}</p>}
        </div>
    );
}
