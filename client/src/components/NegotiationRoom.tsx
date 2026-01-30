import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Send, MessageSquare, TrendingUp, AlertCircle, Info } from 'lucide-react';

const SOCKET_URL = 'http://localhost:3000';

interface Message {
    id: string;
    sender: string;
    originalText: string;
    translatedText: string;
    timestamp: string;
}

interface PriceData {
    commodity: string;
    minPrice: number;
    maxPrice: number;
    modalPrice: number;
}

interface Vendor {
    id: string;
    name: string;
    location: { mandiName: string; state: string };
    availableCommodities: string[];
}

const NegotiationRoom: React.FC = () => {
    const { vendorId } = useParams();
    const [searchParams] = useSearchParams();
    const item = searchParams.get('item');
    const location = searchParams.get('location');
    const [socket, setSocket] = useState<Socket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [inputText, setInputText] = useState('');
    const [transcript, setTranscript] = useState('');

    // Vendor and Price State
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [prices, setPrices] = useState<PriceData[]>([]);
    const [dealStatus, setDealStatus] = useState<string | null>(null);

    useEffect(() => {
        // Fetch Vendor Details (Mocking getting single from list)
        fetch('http://localhost:3000/api/vendors')
            .then(res => res.json())
            .then((vendors: Vendor[]) => {
                const found = vendors.find(v => v.id === vendorId);
                if (found) {
                    setVendor(found);
                    // Fetch prices for this vendor's commodities
                    found.availableCommodities.forEach(commodity => {
                        fetch(`http://localhost:3000/api/prices?commodity=${commodity}&location=${found.location.mandiName}`)
                            .then(res => res.json())
                            .then(data => {
                                setPrices(prev => [...prev, data]);
                            });
                    });
                }
            });

        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to server');
            newSocket.emit('join_room', `room-${vendorId}`);
        });

        newSocket.on('chat_history', (history: Message[]) => {
            setMessages(history);
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

    // Web Speech API for Mock Voice Input
    const startListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Browser does not support Speech API. Please use text input.");
            return;
        }

        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'hi-IN'; // Default to Hindi for demo
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            const text = event.results[0][0].transcript;
            setTranscript(text);
            sendVoiceMessage(text);
        };

        recognition.start();
    };

    const sendVoiceMessage = (text: string) => {
        if (socket && text) {
            console.log('📤 Sending message:', text);
            socket.emit('voice_message_transcript', {
                roomId: `room-${vendorId}`,
                text: text,
                sender: 'buyer',
                language: 'hi',
                commodity: item || 'Wheat',
                location: location || 'Delhi',
                vendorName: vendor?.name || 'Vendor'
            });
            setTranscript('');
            setInputText('');
        } else {
            console.warn('⚠️ Cannot send message - socket:', socket, 'text:', text);
        }
    };

    return (
        <div className="flex h-[calc(100vh-80px)] bg-gray-50">
            {/* Left Sidebar: Market Intelligence */}
            <div className="w-80 bg-white border-r p-4 hidden md:block overflow-y-auto">
                <div className="mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Live Mandi Rates
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                        Real-time prices from {vendor?.location.mandiName || 'Local Mandi'}
                    </p>

                    <div className="space-y-3">
                        {prices.map((price, idx) => (
                            <div key={idx} className="border rounded-lg p-3 bg-blue-50/50 border-blue-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-semibold text-gray-800">{price.commodity}</span>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                        ₹{price.modalPrice}/qt
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Min: ₹{price.minPrice}</span>
                                    <span>Max: ₹{price.maxPrice}</span>
                                </div>
                                <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    Updated: Just now
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                    <h4 className="font-bold text-yellow-800 text-sm flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        Negotiation Tips
                    </h4>
                    <ul className="text-xs text-yellow-700 space-y-2 list-disc pl-4">
                        <li>Current market trend is stable.</li>
                        <li>Vendor usually agrees to ₹{prices[0]?.modalPrice} +/- 5%.</li>
                        <li>Mention bulk quantity for better rates.</li>
                    </ul>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                <div className="bg-white p-4 shadow-sm border-b flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-lg font-bold">Negotiation with {vendor?.name || `Vendor #${vendorId}`}</h2>
                        <p className="text-sm text-green-600 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            AI Mediator Active
                        </p>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.sender === 'buyer'
                                ? 'bg-green-600 text-white rounded-br-none'
                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                                }`}>
                                <div className={`text-xs opacity-75 mb-1 ${msg.sender === 'buyer' ? 'text-green-100' : 'text-gray-500'}`}>
                                    {msg.sender === 'buyer' ? 'You (Hindi)' : 'Vendor (Tamil)'}
                                </div>
                                <div className="text-lg">{msg.originalText}</div>
                                <div className={`mt-2 p-2 rounded text-sm ${msg.sender === 'buyer' ? 'bg-green-700/50 text-green-50' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                    <span className="opacity-75 text-xs uppercase tracking-wider block mb-1">Translation (English)</span>
                                    {msg.translatedText}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="bg-white p-4 border-t">
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={startListening}
                            className={`p-4 rounded-full transition-all ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-green-100 hover:bg-green-200 text-green-700'
                                }`}
                        >
                            {isListening ? <MicOff /> : <Mic />}
                        </button>

                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type or speak (Hindi)..."
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                            onKeyDown={(e) => e.key === 'Enter' && sendVoiceMessage(inputText)}
                        />

                        <button
                            onClick={() => sendVoiceMessage(inputText)}
                            className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Send />
                        </button>
                    </div>
                    <p className="text-xs text-center text-gray-400 mt-2">
                        Voice Engine: Web Speech API • AI Translation: Active
                    </p>
                </div>
            </div>
        </div>
    );
};

export default NegotiationRoom;
