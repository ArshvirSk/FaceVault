'use client';

import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Toast } from '../components/Toast';

const API_URL = 'http://localhost:8000';

export default function ProfilePage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [photoKey, setPhotoKey] = useState(0);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

    useEffect(() => {
        axios.get(`${API_URL}/auth/me`, { withCredentials: true })
            .then(res => setUser(res.data))
            .catch(() => router.push('/auth/login'))
            .finally(() => setLoading(false));
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setUploadPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleUpdatePhoto = async () => {
        if (!uploadFile) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('profile_photo', uploadFile);
            await axios.post(`${API_URL}/auth/update-profile`, formData, {
                withCredentials: true,
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadFile(null);
            setUploadPreview(null);
            setPhotoKey(k => k + 1);
            showToast('Profile photo updated!', 'success');
        } catch (error: any) {
            showToast(error.response?.data?.detail || 'Failed to update profile photo', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteInput !== user?.username) return;
        setDeleting(true);
        try {
            await axios.delete(`${API_URL}/auth/account`, { withCredentials: true });
            router.push('/auth/login');
        } catch (error: any) {
            showToast(error.response?.data?.detail || 'Failed to delete account', 'error');
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="max-w-xl mx-auto space-y-8">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>

            {/* Profile Photo Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
                <h2 className="text-xl font-semibold dark:text-white">Profile Photo</h2>

                <div className="flex items-center gap-6">
                    {/* Current photo */}
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
                        <img
                            key={photoKey}
                            src={`${API_URL}/profile-photo/${user.user_id}?v=${photoKey}`}
                            alt={user.username}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900 dark:text-white text-lg">{user.username}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Member since {new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Upload new photo */}
                {uploadPreview ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <img
                                src={uploadPreview}
                                alt="Preview"
                                className="w-20 h-20 rounded-full object-cover border-2 border-blue-400"
                            />
                            <div>
                                <p className="text-sm text-gray-700 font-medium">New photo preview</p>
                                <p className="text-xs text-gray-500">{uploadFile?.name}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleUpdatePhoto}
                                disabled={uploading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                            >
                                {uploading ? 'Uploading...' : 'Save New Photo'}
                            </button>
                            <button
                                onClick={() => { setUploadPreview(null); setUploadFile(null); }}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                        >
                            Choose New Photo
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Photo must contain exactly one face for detection.
                        </p>
                    </>
                )}
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-red-200 dark:border-red-900 space-y-4">
                <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">Danger Zone</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Permanently delete your account. Albums you admin will remain but lose their admin. This action cannot be undone.
                </p>

                {!showDeleteConfirm ? (
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                    >
                        Delete My Account
                    </button>
                ) : (
                    <div className="space-y-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                            Type <strong>{user.username}</strong> to confirm account deletion:
                        </p>
                        <input
                            type="text"
                            value={deleteInput}
                            onChange={(e) => setDeleteInput(e.target.value)}
                            placeholder={user.username}
                            className="w-full px-3 py-2 border border-red-300 dark:border-red-700 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleteInput !== user.username || deleting}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                            >
                                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
                            </button>
                            <button
                                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
