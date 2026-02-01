import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Bell, MessageSquare, Clock, CheckCircle, XCircle, LogOut } from 'lucide-react';

const SOCKET_URL = ''; // Use proxy

interface Notification {
    id: string;
    buyerName: string;
    item: string;
    location: string;
    timestamp: Date;
    status: string;
    roomId: string;
    closureReason?: string;
    closedAt?: Date;
}

const SellerDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [history, setHistory] = useState<Notification[]>([]);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [sellerName, setSellerName] = useState('');

    const fetchActive = () => {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        fetch(`/api/conversations/vendor/${userId}`)
            .then(res => res.json())
            .then(data => {
                const existing = data.map((conv: any) => ({
                    id: conv._id,
                    buyerName: conv.buyer?.name || 'Active Buyer',
                    item: conv.commodity || 'Wheat',
                    location: conv.location?.mandiName || 'Delhi',
                    timestamp: conv.lastActivityAt || new Date(),
                    status: conv.negotiationPhase === 'chat' ? 'active' : 'pending',
                    roomId: conv.roomId
                }));
                setNotifications(existing);
            })
            .catch(err => console.error("Failed to fetch conversations", err));
    };

    const fetchHistory = () => {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        fetch(`/api/conversations/history/${userId}`)
            .then(res => res.json())
            .then(data => {
                const results = data.map((conv: any) => ({
                    id: conv._id,
                    buyerName: conv.buyer?.name || 'Past Buyer',
                    item: conv.commodity || 'Wheat',
                    location: conv.location?.mandiName || 'Delhi',
                    timestamp: conv.closedAt || conv.updatedAt,
                    status: conv.status,
                    roomId: conv.roomId,
                    closureReason: conv.closureReason
                }));
                setHistory(results);
            })
            .catch(err => console.error("Failed to fetch history", err));
    };

    useEffect(() => {
        const userType = localStorage.getItem('userType');
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');

        if (userType !== 'seller' || !userId) {
            navigate('/seller/login');
            return;
        }

        setSellerName(userName || 'Seller');

        const newSocket = io(SOCKET_URL);
        newSocket.on('connect', () => {
            newSocket.emit('join_seller_room', userId);
        });

        newSocket.on('new_negotiation_request', (data: any) => {
            const notification: Notification = {
                id: data.roomId,
                buyerName: data.buyerName || 'Anonymous Buyer',
                item: data.item,
                location: data.location,
                timestamp: new Date(),
                status: 'pending',
                roomId: data.roomId
            };
            setNotifications(prev => [notification, ...prev]);

            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('New Negotiation Request', {
                    body: `${data.buyerName} wants to negotiate for ${data.item}`,
                    icon: '/favicon.ico'
                });
            }
        });

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        fetchActive();

        return () => {
            newSocket.close();
        };
    }, [navigate]);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        } else {
            fetchActive();
        }
    }, [activeTab]);

    const handleAcceptNegotiation = (notification: Notification) => {
        setNotifications(prev =>
            prev.map(n => n.id === notification.id ? { ...n, status: 'active' } : n)
        );
        navigate(`/seller/${notification.roomId}?item=${notification.item}&location=${notification.location}`);
    };

    const handleRejectNegotiation = (notificationId: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, status: 'rejected' } : n)
        );
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/seller/login');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'active': return 'bg-green-100 text-green-800 border-green-300';
            case 'completed': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const pendingCount = notifications.filter(n => n.status === 'pending').length;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 shadow-lg">
                <div className="container mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">🏪 Seller Dashboard</h1>
                        <p className="text-sm opacity-90 mt-1">Welcome, {sellerName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 px-4 py-2 rounded-full flex items-center gap-2">
                            <Bell size={20} />
                            <span className="font-semibold">{pendingCount} Pending</span>
                        </div>
                        <button onClick={handleLogout} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full flex items-center gap-2 transition-colors">
                            <LogOut size={20} /> Logout
                        </button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto p-6">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <MessageSquare size={28} className="text-orange-600" /> Negotiations
                        </h2>
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button onClick={() => setActiveTab('active')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                Active
                            </button>
                            <button onClick={() => setActiveTab('history')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                History (Audit)
                            </button>
                        </div>
                    </div>

                    {activeTab === 'active' ? (
                        notifications.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Bell size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg">No active negotiation requests</p>
                                <p className="text-sm">New requests will appear here in real-time</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {notifications.map((notification) => (
                                    <div key={notification.id} className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-xl font-bold text-gray-800">{notification.buyerName}</h3>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getStatusColor(notification.status)}`}>
                                                        {notification.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="space-y-1 text-sm text-gray-600">
                                                    <p><strong>Item:</strong> {notification.item}</p>
                                                    <p><strong>Location:</strong> {notification.location}</p>
                                                    <p className="flex items-center gap-1">
                                                        <Clock size={14} /> {new Date(notification.timestamp).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {notification.status === 'pending' && (
                                            <div className="flex gap-3">
                                                <button onClick={() => handleAcceptNegotiation(notification)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
                                                    <CheckCircle size={20} /> Accept & Negotiate
                                                </button>
                                                <button onClick={() => handleRejectNegotiation(notification.id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
                                                    <XCircle size={20} /> Decline
                                                </button>
                                            </div>
                                        )}
                                        {notification.status === 'active' && (
                                            <button onClick={() => navigate(`/seller/${notification.roomId}?item=${notification.item}&location=${notification.location}`)} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-semibold transition-colors">
                                                Continue Negotiation →
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        history.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Clock size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg">No past negotiations found</p>
                                <p className="text-sm">Completed or failed negotiations will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {history.map((item) => (
                                    <div key={item.id} className="border-2 border-gray-100 rounded-xl p-6 bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer" onClick={() => navigate(`/history/${item.id}`)}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="text-lg font-bold text-gray-800">{item.buyerName}</h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.status === 'deal_success' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        item.status === 'deal_failed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                                                        }`}>
                                                        {item.status.replace(/_/g, ' ').toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 flex gap-4">
                                                    <span><strong>{item.item}</strong></span>
                                                    <span>{item.location}</span>
                                                    <span>Closed: {new Date(item.timestamp).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-orange-600 font-bold text-sm flex items-center gap-1 group">
                                                View Audit <span className="group-hover:translate-x-1 transition-transform">→</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default SellerDashboard;
