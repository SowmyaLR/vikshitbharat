import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Store } from 'lucide-react';

interface LoginProps {
    onLogin: (userType: 'buyer' | 'seller') => void;
    initialMode?: 'buyer' | 'seller';
}

const Login: React.FC<LoginProps> = ({ onLogin, initialMode = 'buyer' }) => {
    const navigate = useNavigate();
    const [userType, setUserType] = useState<'buyer' | 'seller'>(initialMode);
    const [userId, setUserId] = useState('');

    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        setUserType(initialMode);
        setUserId('');
    }, [initialMode]);

    useEffect(() => {
        // Fetch users from backend
        const fetchUsers = async () => {
            try {
                // In a real app, you'd separate this endpoint or pass role as param
                const response = await fetch('http://localhost:3000/api/users');
                if (response.ok) {
                    const allUsers = await response.json();
                    setUsers(allUsers);
                }
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };

        fetchUsers();
    }, []);

    const filteredUsers = users.filter(user => user.role === userType || user.role === 'both' || (userType === 'seller' && user.role === 'vendor'));

    const handleLoginClick = () => {
        if (!userId) {
            alert('Please select a user');
            return;
        }

        const selectedUser = users.find(u => u._id === userId);

        // Store in localStorage
        localStorage.setItem('userType', userType);
        localStorage.setItem('userId', userId);
        localStorage.setItem('userName', selectedUser?.name || '');

        onLogin(userType);

        // Redirect logic based on user type
        if (userType === 'buyer') {
            window.location.href = '/locations'; // Direct reload/redirect to Locations
        } else {
            window.location.href = '/seller-dashboard'; // Direct reload/redirect to Seller Dashboard
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 bg-gradient-to-br ${userType === 'buyer' ? 'from-green-50 via-white to-green-50' : 'from-blue-50 via-white to-blue-50'
            }`}>
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className={`text-3xl font-bold mb-2 ${userType === 'buyer' ? 'text-green-800' : 'text-blue-800'}`}>
                        {userType === 'buyer' ? 'Buyer Login' : 'Seller Login'}
                    </h1>
                    <p className="text-gray-500">Welcome back to DharmaVyāpaara</p>
                </div>

                {/* User Type Selection Toggles */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={() => navigate('/buyer/login')}
                        className={`p-6 rounded-xl border-2 transition-all ${userType === 'buyer'
                            ? 'border-green-600 bg-green-50 shadow-md transform scale-105'
                            : 'border-gray-200 hover:border-green-300 opacity-60 hover:opacity-100'
                            }`}
                    >
                        <User size={32} className={`mx-auto mb-2 ${userType === 'buyer' ? 'text-green-600' : 'text-gray-400'}`} />
                        <div className="font-semibold text-gray-800">Buyer</div>
                        <div className="text-xs text-gray-500">Farmer/Trader</div>
                    </button>

                    <button
                        onClick={() => navigate('/seller/login')}
                        className={`p-6 rounded-xl border-2 transition-all ${userType === 'seller'
                            ? 'border-blue-600 bg-blue-50 shadow-md transform scale-105'
                            : 'border-gray-200 hover:border-blue-300 opacity-60 hover:opacity-100'
                            }`}
                    >
                        <Store size={32} className={`mx-auto mb-2 ${userType === 'seller' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <div className="font-semibold text-gray-800">Seller</div>
                        <div className="text-xs text-gray-500">Vendor/Supplier</div>
                    </button>
                </div>

                {/* Account Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select {userType === 'buyer' ? 'Buyer' : 'Seller'} Account
                    </label>
                    <div className="relative">
                        <select
                            value={userId}
                            onChange={(e) => {
                                setUserId(e.target.value);
                            }}
                            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 appearance-none ${userType === 'buyer'
                                ? 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                }`}
                        >
                            <option value="">-- Select Account --</option>
                            {filteredUsers.map((user) => (
                                <option key={user._id} value={user._id}>
                                    {user.name} ({user.phone})
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>


                {/* Login Button */}
                <button
                    onClick={handleLoginClick}
                    disabled={!userId}
                    className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${userId
                        ? userType === 'buyer'
                            ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    Login as {userType === 'buyer' ? 'Buyer' : 'Seller'}
                </button>

                <div className="mt-6 text-center text-sm text-gray-500">
                    <p>Demo Mode - No password required</p>
                    <p className="mt-2 text-xs">Login to access your dashboard</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
