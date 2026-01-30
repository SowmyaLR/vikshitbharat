import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Phone, CheckCircle } from 'lucide-react';

const SOCKET_URL = 'http://localhost:3000';

interface Message {
    id: string;
    originalText: string;
    translatedText: string;
    sender: 'buyer' | 'vendor' | 'ai_mediator';
    timestamp: Date;
    metadata?: any;
}

const SellerInterface: React.FC = () => {
    const { vendorId } = useParams();
    const [searchParams] = useSearchParams();
    const item = searchParams.get('item');
    const location = searchParams.get('location');

    const [socket, setSocket] = useState<Socket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [dealStatus, setDealStatus] = useState<string | null>(null);
    const [vendorName] = useState('Ramesh Kumar'); // In production, fetch from auth

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Seller connected to server');
            newSocket.emit('join_room', `room-${vendorId}`);
        });

        newSocket.on('new_message', (msg: Message) => {
            setMessages(prev => [...prev, msg]);
        });

        newSocket.on('deal_update', (data: any) => {
            console.log('🎉 Deal update:', data);
            setDealStatus(data.message);
        });

        return () => {
            newSocket.close();
        };
    }, [vendorId]);

    const sendMessage = () => {
        if (socket && inputText.trim()) {
            console.log('📤 Seller sending message:', inputText);
            socket.emit('voice_message_transcript', {
                roomId: `room-${vendorId}`,
                text: inputText,
                sender: 'vendor',
                language: 'ta', // Tamil
                commodity: item,
                location: location,
                vendorName: vendorName
            });
            setInputText('');
        }
    };

    const acceptDeal = () => {
        if (socket) {
            socket.emit('accept_deal', {
                roomId: `room-${vendorId}`,
                acceptedBy: 'vendor'
            });
        }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-4 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">🏪 Seller Dashboard</h1>
                            <p className="text-sm opacity-90">
                                Negotiating: {item} | Location: {location}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                            <Phone size={16} />
                            <span className="text-sm font-semibold">AI Mediator Active</span>
                        </div>
                    </div>
                </div>

                {/* Deal Status Banner */}
                {dealStatus && (
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 text-center font-bold text-lg shadow-lg">
                        {dealStatus}
                        <button
                            onClick={acceptDeal}
                            className="ml-4 bg-white text-green-600 px-6 py-2 rounded-full font-bold hover:bg-green-50 transition-all"
                        >
                            <CheckCircle className="inline mr-2" size={20} />
                            Accept Deal
                        </button>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'vendor' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.sender === 'vendor'
                                    ? 'bg-orange-600 text-white rounded-br-none'
                                    : msg.sender === 'ai_mediator'
                                        ? 'bg-blue-600 text-white rounded-bl-none shadow-lg border-2 border-blue-400'
                                        : 'bg-white border-2 border-green-200 text-gray-800 rounded-bl-none shadow-sm'
                                }`}>
                                <div className={`text-xs font-semibold mb-1 flex items-center gap-1 ${msg.sender === 'vendor' ? 'text-orange-100' :
                                        msg.sender === 'ai_mediator' ? 'text-blue-100' :
                                            'text-green-600'
                                    }`}>
                                    {msg.sender === 'vendor' ? '🏪 You (Tamil)' :
                                        msg.sender === 'ai_mediator' ? '🤖 AI Mediator' :
                                            '👤 Buyer (Hindi)'}
                                </div>
                                <div className="text-base leading-relaxed">{msg.originalText}</div>
                                {msg.translatedText !== msg.originalText && (
                                    <div className={`mt-2 p-2 rounded text-sm ${msg.sender === 'vendor' ? 'bg-orange-700/50 text-orange-50' :
                                            msg.sender === 'ai_mediator' ? 'bg-blue-700/50 text-blue-50' :
                                                'bg-green-50 text-gray-700 border border-green-100'
                                        }`}>
                                        <span className="opacity-75 text-xs uppercase tracking-wider block mb-1">Translation</span>
                                        {msg.translatedText}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="bg-white p-4 border-t">
                    <div className="flex gap-2 items-center">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Type your response (Tamil)..."
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <button
                            onClick={sendMessage}
                            className="bg-orange-600 text-white p-3 rounded-xl hover:bg-orange-700 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SellerInterface;
