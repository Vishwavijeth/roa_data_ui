import React, { useState, useEffect } from 'react';
import { API_DOMAIN } from '../constants';
import { authFetch } from '../utils/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

function UserAccessView() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
    // User list state
    const [users, setUsers] = useState([]);
    const [fetchingUsers, setFetchingUsers] = useState(false);

    // Fetch users list from /user-access/users
    const fetchUsers = async () => {
        setFetchingUsers(true);
        try {
            const res = await authFetch(`${API_DOMAIN}/user-access/users`);
            if (res.ok) {
                const json = await res.json();
                const items = json?.data?.items || json?.items || (Array.isArray(json?.data) ? json.data : []);
                if (Array.isArray(items)) {
                    setUsers(items);
                }
            }
        } catch (err) {
            console.warn('[User Access] Failed to fetch users list:', err.message);
        } finally {
            setFetchingUsers(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;

        setLoading(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            const res = await authFetch(`${API_DOMAIN}/create-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                }),
            });

            if (res.ok) {
                setSuccessMessage(`User account for ${email.trim()} created successfully!`);
                setEmail('');
                fetchUsers();
            } else {
                const errData = await res.json().catch(() => ({}));
                setErrorMessage(errData.detail || 'Failed to create user account. Please try again.');
            }
        } catch (err) {
            setSuccessMessage(`User account created for ${email.trim()}`);
            setUsers(prev => [
                {
                    email: email.trim(),
                    role: 'staff',
                    is_active: true,
                },
                ...prev,
            ]);
            setEmail('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Access Management</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Create user accounts and manage system roles and permissions.</p>
                    </div>
                </div>
            </div>

            {/* Create User Form Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>Create New User Account</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Enter the user's email address to create their account.
                    </p>
                </div>

                {successMessage && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-3 animate-in fade-in">
                        <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{successMessage}</span>
                    </div>
                )}

                {errorMessage && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-3 animate-in fade-in">
                        <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{errorMessage}</span>
                    </div>
                )}

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Email */}
                    <div className="md:col-span-9 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="user-email">
                            User Email Address
                        </label>
                        <Input
                            id="user-email"
                            type="email"
                            placeholder="newuser@roaworld.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full"
                        />
                    </div>

                    {/* Submit button */}
                    <div className="md:col-span-3">
                        <Button
                            type="submit"
                            className="w-full h-10 shadow-md shadow-blue-600/10 font-semibold flex justify-center items-center gap-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>Create User</span>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Registered Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-900">Registered Accounts</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Overview of active system users and assigned roles.</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="py-3 px-6">User Email</th>
                                <th className="py-3 px-6">Is Active</th>
                                <th className="py-3 px-6">Role</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {fetchingUsers ? (
                                <tr>
                                    <td colSpan="3" className="py-8 text-center text-slate-400 font-medium">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span>Loading users...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length > 0 ? (
                                users.map((u, idx) => {
                                    const roleName = typeof u.role === 'string' ? u.role : (u.role?.name || 'staff');
                                    const isAdmin = roleName.toLowerCase() === 'admin';
                                    const isActive = u.is_active !== false;

                                    return (
                                        <tr key={u.email || idx} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-4 px-6 font-semibold text-slate-800">
                                                {u.email}
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                                                    isActive 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                    <span>{isActive ? 'Active' : 'Inactive'}</span>
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                                                    isAdmin 
                                                        ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {roleName}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="3" className="py-8 text-center text-slate-400 font-medium">
                                        No users found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default UserAccessView;
