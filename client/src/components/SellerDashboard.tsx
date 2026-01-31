import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Bell, MessageSquare, Clock, CheckCircle, XCircle, LogOut } from 'lucide-react';

const SOCKET_URL = 'http://localhost:3000';

interface Notification {
    id: string;
    buyerName: string;
    item: string;
    location: string;
    timestamp: Date;
    status: 'pending' | 'active' | 'completed' | 'rejected';
    roomId: string;
}

const SellerDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [sellerName, setSellerName] = useState('');
    const [sellerId, setSellerId] = useState('');

    useEffect(() => {
        // Get seller info from localStorage
        const userType = localStorage.getItem('userType');
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');

        if (userType !== 'seller' || !userId) {
            navigate('/seller/login');
            return;
        }

        setSellerName(userName || 'Seller');
        setSellerId(userId);

        // Connect to Socket.io for real-time notifications
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Seller connected to notification system');
            // Join seller's notification room
            newSocket.emit('join_seller_room', userId);
        });

        // Listen for new negotiation requests
        newSocket.on('new_negotiation_request', (data: any) => {
            console.log('📢 New negotiation request:', data);
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

            // Show browser notification if permitted
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('New Negotiation Request', {
                    body: `${data.buyerName} wants to negotiate for ${data.item}`,
                    icon: '/favicon.ico'
                });
            }
        });

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Fetch existing conversations
        fetch(`${SOCKET_URL}/api/conversations/vendor/${userId}`)
            .then(res => res.json())
            .then(data => {
                const existing = data.map((conv: any) => ({
                    id: conv.roomId,
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

        return () => {
            newSocket.close();
        };
    }, [navigate]);

    const handleAcceptNegotiation = (notification: Notification) => {
        // Update status
        setNotifications(prev =>
            prev.map(n => n.id === notification.id ? { ...n, status: 'active' } : n)
        );

        // Navigate to seller interface for this negotiation
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
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 shadow-lg">
                <div className="container mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            🏪 Seller Dashboard
                        </h1>
                        <p className="text-sm opacity-90 mt-1">Welcome, {sellerName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 px-4 py-2 rounded-full flex items-center gap-2">
                            <Bell size={20} />
                            <span className="font-semibold">{pendingCount} Pending</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full flex items-center gap-2 transition-colors"
                        >
                            <LogOut size={20} />
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto p-6">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <MessageSquare size={28} className="text-orange-600" />
                        Negotiation Requests
                    </h2>

                    {notifications.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Bell size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-lg">No negotiation requests yet</p>
                            <p className="text-sm">You'll be notified when buyers want to negotiate</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-xl font-bold text-gray-800">
                                                    {notification.buyerName}
                                                </h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getStatusColor(notification.status)}`}>
                                                    {notification.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-sm text-gray-600">
                                                <p><strong>Item:</strong> {notification.item}</p>
                                                <p><strong>Location:</strong> {notification.location}</p>
                                                <p className="flex items-center gap-1">
                                                    <Clock size={14} />
                                                    {new Date(notification.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {notification.status === 'pending' && (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleAcceptNegotiation(notification)}
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <CheckCircle size={20} />
                                                Accept & Join Negotiation
                                            </button>
                                            <button
                                                onClick={() => handleRejectNegotiation(notification.id)}
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <XCircle size={20} />
                                                Decline
                                            </button>
                                        </div>
                                    )}

                                    {notification.status === 'active' && (
                                        <button
                                            onClick={() => navigate(`/seller/${notification.roomId}?item=${notification.item}&location=${notification.location}`)}
                                            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-semibold transition-colors"
                                        >
                                            Continue Negotiation →
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SellerDashboard;
