import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Send, TrendingUp, AlertCircle } from 'lucide-react';

const SOCKET_URL = 'http://localhost:3000';

interface Message {
    id: string;
    sender: string;
    senderName?: string;
    originalText: string;
    translatedText: string;
    timestamp: string;
    messageType?: 'text' | 'audio';
    audioUrl?: string;
    metadata?: any;
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
    const { roomId } = useParams();
    const [searchParams] = useSearchParams();
    const vendorIdParam = searchParams.get('vendorId');
    const vendorId = vendorIdParam || (roomId?.split('-')[1] || '');

    const item = searchParams.get('items');
    const location = searchParams.get('location');
    const [socket, setSocket] = useState<Socket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [inputText, setInputText] = useState('');
    const [warning, setWarning] = useState<string | null>(null);

    // Language State
    const [myLanguage, setMyLanguage] = useState('hi');

    // Deal State
    const [currentDeal, setCurrentDeal] = useState<any | null>(null);
    const [previewDeal, setPreviewDeal] = useState<any | null>(null);
    const [vendor, setVendor] = useState<Vendor | null>(null);
    // AI-Led Deal Room Phase State
    const [phase, setPhase] = useState<'greeting' | 'offer' | 'seller_review' | 'buyer_counter_review' | 'chat'>('greeting');
    const [aiGreeting, setAiGreeting] = useState<string | null>(null);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isTooLow, setIsTooLow] = useState(false);
    const [structuredOffer, setStructuredOffer] = useState<{ quantity: number, price: number, purpose?: string } | null>(null);

    const [prices, setPrices] = useState<PriceData[]>([]);

    // Closure State
    const [isClosed, setIsClosed] = useState(false);
    const [closureData, setClosureData] = useState<{ reason: string, message: string, dealId?: string } | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!vendorId) return;

        fetch('http://localhost:3000/api/vendors')
            .then(res => res.json())
            .then((vendors: Vendor[]) => {
                const found = vendors.find(v => v.id === vendorId);
                if (found) {
                    setVendor(found);
                    found.availableCommodities.forEach(commodity => {
                        fetch(`http://localhost:3000/api/prices?commodity=${commodity}&location=${found.location.mandiName}`)
                            .then(res => res.json())
                            .then(data => {
                                setPrices(prev => [...prev, data]);
                            });
                    });
                }
            });
    }, [vendorId]);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to server');
            newSocket.emit('join_room', {
                roomId: roomId,
                buyerName: localStorage.getItem('userName') || 'Buyer',
                location: location || 'Delhi',
                commodity: item || 'Wheat'
            });
            // Emit initial preference
            newSocket.emit('update_preference', {
                roomId: roomId,
                role: 'buyer',
                language: myLanguage
            });
        });

        newSocket.on('chat_history', (history: Message[]) => {
            setMessages(history);
        });

        newSocket.on('new_message', (msg: Message) => {
            setMessages(prev => [...prev, msg]);
            if (msg.sender === 'ai_mediator') {
                playNotificationSound();
            }
        });

        newSocket.on('moderation_warning', (data: { reason: string }) => {
            setWarning(data.reason);
            setTimeout(() => setWarning(null), 5000);
        });

        newSocket.on('deal_created', (deal: any) => {
            console.log('New Deal:', deal);
            setCurrentDeal(deal);
            setPreviewDeal(null); // Clear preview when final deal arrives
        });

        newSocket.on('deal_updated', (deal: any) => {
            console.log('Deal Updated:', deal);
            setCurrentDeal(deal);
        });

        newSocket.on('deal_suggested', (data: { deal: any }) => {
            console.log('📜 Received Deal Suggestion:', data.deal);
            setCurrentDeal({ ...data.deal, status: 'draft' });
        });

        newSocket.on('deal_preview', (deal: any) => {
            console.log('👀 Live Deal Preview:', deal);
            setPreviewDeal(deal);
        });

        // AI-Led Deal Room Listeners
        newSocket.on('ai_greeting', (data: { text: string }) => {
            console.log('🤖 [BUYER] AI Greeting received:', data.text.substring(0, 50));
            setAiGreeting(data.text);
            console.log('🔄 [BUYER] Setting phase to offer');
            setPhase('offer');
        });

        newSocket.on('phase_sync', (data: { phase: string }) => {
            console.log('🔄 Syncing Phase:', data.phase);
            setPhase(data.phase as any);
        });

        newSocket.on('room_sync', (data: any) => {
            console.log('🏠 [BUYER] Room Sync Received:', {
                phase: data.phase,
                aiGreeting: data.aiGreeting ? 'YES' : 'NO',
                aiInsight: data.aiInsight ? 'YES' : 'NO',
                structuredOffer: data.structuredOffer,
                isTooLow: data.isTooLow
            });
            if (data.phase) {
                console.log(`🔄 [BUYER] Setting phase from room_sync: ${data.phase}`);
                setPhase(data.phase);
            }
            if (data.aiGreeting) setAiGreeting(data.aiGreeting);
            if (data.aiInsight) setAiInsight(data.aiInsight);
            if (data.structuredOffer) setStructuredOffer(data.structuredOffer);
            if (data.isTooLow !== undefined) setIsTooLow(data.isTooLow);
            if (data.status && ['deal_success', 'deal_failed', 'abandoned'].includes(data.status)) {
                setIsClosed(true);
            }
        });

        newSocket.on('ai_insight', (data: { insight: string }) => {
            setAiInsight(data.insight);
        });

        newSocket.on('offer_submitted', (data: { offer: any, isTooLow: boolean }) => {
            console.log('📬 [BUYER] Received offer_submitted event:', data);
            setStructuredOffer(data.offer);
            setIsTooLow(data.isTooLow);
            setPhase('seller_review');
        });

        newSocket.on('decision_update', (data: any) => {
            if (data.phase) {
                console.log('🔄 Decision Phase Sync:', data.phase);
                setPhase(data.phase);
            }
            if (data.status && ['deal_success', 'deal_failed', 'abandoned'].includes(data.status)) {
                setIsClosed(true);
            }
        });

        newSocket.on('conversation_closed', (data: { reason: string, message: string, dealId?: string }) => {
            console.log('🔒 Conversation Closed:', data);
            setIsClosed(true);
            setClosureData(data);
        });

        return () => {
            newSocket.close();
        };
    }, [roomId]);

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(e => console.log('Audio play failed', e));
        } catch (e) { }
    };

    const handleSignDeal = () => {
        if (!currentDeal) return;
        const address = prompt("Please enter delivery address:");
        if (address) {
            socket?.emit('update_deal_status', { dealId: currentDeal._id, action: 'sign_buyer', address });
        }
    };

    const handleRejectDeal = () => {
        if (!currentDeal) return;
        if (confirm("Reject this deal?")) {
            socket?.emit('update_deal_status', { dealId: currentDeal._id, action: 'reject' });
        }
    };

    const startListening = async () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Browser does not support Speech API.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start();

            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.continuous = false;
            recognition.lang = myLanguage === 'hi' ? 'hi-IN' : myLanguage === 'ta' ? 'ta-IN' : 'en-US';
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => {
                setIsListening(false);
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                    mediaRecorderRef.current.onstop = () => {
                        // Logic now handled in onresult mainly
                    };
                }
            };

            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                if (mediaRecorderRef.current) {
                    mediaRecorderRef.current.stop();
                    mediaRecorderRef.current.onstop = () => {
                        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                        uploadAndSend(text, audioBlob);
                    };
                }
            };

            recognition.start();

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone.");
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    const uploadAndSend = async (text: string, audioBlob: Blob | null) => {
        if (!text) return;
        let audioUrl = '';

        if (audioBlob) {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice-message.webm');
            try {
                const response = await fetch('http://localhost:3000/api/upload-audio', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                audioUrl = data.audioUrl;
            } catch (error) {
                console.error("Audio upload failed:", error);
            }
        }
        sendMessage(text, audioUrl);
    };

    const handleEndNegotiation = () => {
        if (window.confirm("End this negotiation? This will close the chat for both parties.")) {
            socket?.emit('end_negotiation', { roomId, userId: localStorage.getItem('userId') });
        }
    };

    const sendMessage = (text: string, audioUrl?: string) => {
        if (socket && text && !isClosed) { // Added !isClosed check
            console.log('📤 Sending message:', text);
            socket.emit('send_message', {
                roomId: roomId,
                text: text,
                audioUrl: audioUrl,
                sender: 'buyer',
                senderName: localStorage.getItem('userName') || 'Buyer', // Added senderName
                language: myLanguage,
                commodity: item || 'Wheat',
                location: location || 'Delhi',
                vendorName: vendor?.name
            });
            setInputText('');
        }
    };

    return (
        <div className="flex h-[calc(100vh-80px)] bg-gray-50">
            {warning && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-bounce">
                    <AlertCircle className="w-5 h-5" />
                    {warning}
                </div>
            )}

            <div className="w-80 bg-white border-r p-4 hidden md:block overflow-y-auto">
                <div className="mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Live Mandi Rates
                    </h3>
                    <div className="space-y-3">
                        {prices.map((price, idx) => (
                            <div key={idx} className="border rounded-lg p-3 bg-blue-50/50 border-blue-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-semibold text-gray-800">{price.commodity}</span>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                        ₹{price.modalPrice}/kg
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Min: ₹{price.minPrice}</span>
                                    <span>Max: ₹{price.maxPrice}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* LIVE DRAFT PREVIEW (New) */}
                {previewDeal && !currentDeal && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl animate-pulse">
                        <h3 className="font-bold text-yellow-900 mb-2 flex items-center">
                            <TrendingUp size={16} className="mr-2" /> Seller is drafting...
                        </h3>
                        <div className="space-y-2 text-sm text-gray-700 opacity-80">
                            {previewDeal.items.map((it: any, i: number) => (
                                <div key={i} className="flex justify-between">
                                    <span>{it.name} ({it.quantity})</span>
                                    <span className="font-semibold">₹{it.price}</span>
                                </div>
                            ))}
                            <div className="border-t border-yellow-200 pt-2 mt-2 flex justify-between font-bold text-yellow-900">
                                <span>Total</span>
                                <span>₹{previewDeal.totalAmount}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-yellow-700 mt-2 italic">Waiting for seller to finalize the deal.</p>
                    </div>
                )}

                {/* DEAL CARD (Official) */}
                {currentDeal && (
                    <div className={`mb-6 p-4 rounded-xl border ${currentDeal.status === 'draft' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 shadow-lg'}`}>
                        <h3 className={`font-bold mb-2 flex items-center ${currentDeal.status === 'draft' ? 'text-indigo-900' : 'text-gray-900'}`}>
                            <TrendingUp size={16} className="mr-2" /> {currentDeal.status === 'draft' ? 'Draft Deal' : 'Formal Agreement'}
                        </h3>
                        <div className="space-y-2 text-sm text-gray-700">
                            {currentDeal.items.map((it: any, i: number) => (
                                <div key={i} className="flex justify-between">
                                    <span>{it.name} ({it.quantity})</span>
                                    <span className="font-semibold">₹{it.price}</span>
                                </div>
                            ))}
                            <div className="border-t border-indigo-200 pt-2 mt-2 flex justify-between font-bold">
                                <span>Total</span>
                                <span>₹{currentDeal.totalAmount}</span>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className={currentDeal.sellerSignature ? "text-green-600 font-bold" : "text-gray-400"}>
                                    {currentDeal.sellerSignature ? "✓ Seller Signed" : "○ Seller Pending"}
                                </span>
                                <span className={currentDeal.buyerSignature ? "text-green-600 font-bold" : "text-gray-400"}>
                                    {currentDeal.buyerSignature ? "✓ You Signed" : "○ You Pending"}
                                </span>
                            </div>

                            {currentDeal.status === 'draft' && !currentDeal.buyerSignature && (
                                <div className="flex space-x-2">
                                    <button onClick={handleSignDeal} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700">
                                        Accept & Sign
                                    </button>
                                    <button onClick={handleRejectDeal} className="flex-1 bg-red-100 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-200">
                                        Reject
                                    </button>
                                </div>
                            )}

                            {currentDeal.status === 'agreed' && (
                                <div className="bg-green-100 text-green-800 text-center py-2 rounded text-xs font-bold">
                                    🎉 Deal Finalized!
                                </div>
                            )}
                            {currentDeal.status === 'rejected' && (
                                <div className="bg-red-100 text-red-800 text-center py-2 rounded text-xs font-bold">
                                    ❌ Deal Rejected
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col">
                <div className="bg-white p-4 shadow-sm border-b flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-lg font-bold">Negotiation with {vendor?.name || `Vendor #${vendorId}`}</h2>
                        <p className="text-sm text-green-600 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            AI Mediator Active <span className="text-gray-400 text-xs ml-2">(Room: {roomId})</span>
                        </p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <select
                            value={myLanguage}
                            onChange={(e) => {
                                setMyLanguage(e.target.value);
                                socket?.emit('update_preference', {
                                    roomId: roomId,
                                    role: 'buyer',
                                    language: e.target.value
                                });
                            }}
                            className="text-sm border rounded-lg p-2 bg-gray-50"
                        >
                            <option value="hi">Hindi (हिंदी)</option>
                            <option value="ta">Tamil (தமிழ்)</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {aiGreeting && (
                        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-6 rounded-2xl shadow-xl flex gap-4 animate-in slide-in-from-top-4 duration-700">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0 text-2xl">🤖</div>
                            <div>
                                <h4 className="font-bold flex items-center gap-2 mb-1">
                                    AI Mediator
                                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-widest text-white/70">Assistant</span>
                                </h4>
                                <div className="text-lg leading-relaxed whitespace-pre-line">{aiGreeting}</div>
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.sender === 'buyer' ? 'bg-green-600 text-white rounded-br-none' :
                                msg.sender === 'ai_mediator' ? 'bg-purple-600 text-white rounded-xl border-2 border-purple-400' :
                                    'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                                }`}>
                                <div className={`text-xs opacity-75 mb-1 ${msg.sender === 'buyer' ? 'text-green-100' : 'text-gray-500'}`}>
                                    {msg.sender === 'buyer' ? 'You' : msg.senderName}
                                </div>

                                {msg.audioUrl && (
                                    <div className="mb-2 bg-black/10 p-2 rounded-lg flex items-center gap-2">
                                        <audio controls src={`http://localhost:3000${msg.audioUrl}`} className="h-8 w-48" />
                                    </div>
                                )}

                                <div className="text-lg">{msg.originalText}</div>

                                {msg.translatedText && msg.translatedText !== msg.originalText && (
                                    <div className={`mt-2 p-2 rounded text-sm ${msg.sender === 'buyer' ? 'bg-green-700/50 text-green-50' : 'bg-gray-100 text-gray-700'}`}>
                                        <span className="opacity-75 text-xs uppercase tracking-wider block mb-1">Translation</span>
                                        {msg.translatedText}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="bg-white p-4 border-t">
                    {phase === 'offer' && (
                        <div className="mb-4 bg-white p-6 rounded-2xl border-2 border-green-100 shadow-xl">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <TrendingUp className="text-green-600" />
                                Make your structured offer
                            </h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity (kg)</label>
                                    <input
                                        type="number"
                                        placeholder="50"
                                        className="w-full border rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none"
                                        value={structuredOffer?.quantity || ''}
                                        onChange={(e) => setStructuredOffer(prev => ({ ...prev!, quantity: parseInt(e.target.value) }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Your Price (₹/kg)</label>
                                    <input
                                        type="number"
                                        placeholder="20"
                                        className="w-full border rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none"
                                        value={structuredOffer?.price || ''}
                                        onChange={(e) => setStructuredOffer(prev => ({ ...prev!, price: parseInt(e.target.value) }))}
                                    />
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Purpose (optional)</label>
                                <input
                                    type="text"
                                    placeholder="Fresh stock"
                                    className="w-full border rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none"
                                    value={structuredOffer?.purpose || ''}
                                    onChange={(e) => setStructuredOffer(prev => ({ ...prev!, purpose: e.target.value }))}
                                />
                            </div>

                            {aiInsight && (
                                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-sm flex gap-3 animate-pulse">
                                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center shrink-0">🤖</div>
                                    <div>
                                        <div className="font-bold">AI Insight</div>
                                        {aiInsight}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    if (structuredOffer?.quantity && structuredOffer?.price) {
                                        console.log('📤 [BUYER] Emitting submit_offer:', {
                                            roomId,
                                            quantity: structuredOffer.quantity,
                                            price: structuredOffer.price,
                                            purpose: structuredOffer.purpose,
                                            language: myLanguage
                                        });
                                        socket?.emit('submit_offer', {
                                            roomId,
                                            quantity: structuredOffer.quantity,
                                            price: structuredOffer.price,
                                            purpose: structuredOffer.purpose,
                                            language: myLanguage
                                        });
                                    } else {
                                        console.warn('⚠️ [BUYER] Submit failed: Missing quantity or price');
                                    }
                                }}
                                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all"
                            >
                                Submit Offer
                            </button>
                        </div>
                    )}

                    {phase === 'seller_review' && (
                        <div className="mb-4 bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-xl animate-in zoom-in duration-500">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 animate-pulse">⌛</div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">Waiting for Seller</h3>
                                        <p className="text-xs text-gray-500">Your offer has been sent</p>
                                    </div>
                                </div>
                                <div className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${isTooLow ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                    Fairness Score: {isTooLow ? '🔴 Poor' : '🟢 Good'}
                                </div>
                            </div>

                            <div className="flex bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100 gap-8">
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Quantity</span>
                                    <span className="text-xl font-black text-gray-800">{structuredOffer?.quantity} kg</span>
                                </div>
                                <div className="border-l border-gray-200 pl-8">
                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Requested Price</span>
                                    <span className="text-xl font-black text-blue-600">₹{structuredOffer?.price}/kg</span>
                                </div>
                            </div>

                            {aiInsight && (
                                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl text-purple-900 text-sm flex gap-3 mb-4">
                                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center shrink-0 text-xs">🤖</div>
                                    <div>
                                        <div className="font-bold text-[10px] uppercase tracking-wider opacity-60">AI Evaluator</div>
                                        {aiInsight}
                                    </div>
                                </div>
                            )}

                            <p className="text-center text-[10px] text-gray-400 italic">
                                Tip: The seller can accept, counter, or reject this offer.
                            </p>
                        </div>
                    )}

                    {phase === 'buyer_counter_review' && (
                        <div className="mb-6 bg-gradient-to-br from-orange-50 to-yellow-50 p-6 rounded-2xl border-2 border-orange-200 shadow-xl">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                🔄 Seller Counter-Offered
                            </h3>
                            <p className="text-gray-700 mb-4">
                                The seller has reviewed your offer and proposed a counter-price. Review the AI's assessment below.
                            </p>

                            {aiInsight && (
                                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl text-purple-900 text-sm flex gap-3 mb-4">
                                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center shrink-0 text-xs">🤖</div>
                                    <div>
                                        <div className="font-bold text-[10px] uppercase tracking-wider opacity-60">AI Evaluator</div>
                                        {aiInsight}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4 mt-4">
                                <button
                                    onClick={() => {
                                        socket?.emit('buyer_decision', { roomId, decision: 'accept' });
                                        setPhase('chat');
                                    }}
                                    className="flex-1 bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all"
                                >
                                    ✅ Accept Counter-Offer
                                </button>
                                <button
                                    onClick={() => {
                                        socket?.emit('buyer_decision', { roomId, decision: 'reject' });
                                        setPhase('chat');
                                    }}
                                    className="flex-1 bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-all"
                                >
                                    ❌ Reject & Continue Chat
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === 'chat' && !isClosed && (
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={handleEndNegotiation}
                                    className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 bg-red-50 px-3 py-1 rounded-full border border-red-100 transition-all"
                                >
                                    🚪 End Negotiation
                                </button>
                            </div>
                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={() => isListening ? stopListening() : startListening()}
                                    className={`p-4 rounded-full transition-all ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-green-100 hover:bg-green-200 text-green-700'}`}
                                >
                                    {isListening ? <MicOff /> : <Mic />}
                                </button>
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Type or speak..."
                                    className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    onKeyDown={(e) => e.key === 'Enter' && uploadAndSend(inputText, null)}
                                />
                                <button
                                    onClick={() => uploadAndSend(inputText, null)}
                                    className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <Send />
                                </button>
                            </div>
                        </div>
                    )}

                    {isClosed && (
                        <div className="bg-gray-100 p-8 rounded-2xl border-2 border-dashed border-gray-300 text-center animate-in fade-in zoom-in duration-500">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 mx-auto mb-4 text-2xl">
                                {closureData?.reason === 'deal_success' ? '✅' : '🔒'}
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">
                                {closureData?.reason === 'deal_success' ? 'Negotiation Successful!' : 'Conversation Closed'}
                            </h3>
                            <p className="text-gray-600 mb-6 max-w-md mx-auto">
                                {closureData?.message || 'This negotiation has ended and the chat is now read-only for audit purposes.'}
                            </p>
                            <div className="flex gap-3 justify-center">
                                {closureData?.dealId && (
                                    <button
                                        onClick={() => window.location.href = `/deals/${closureData.dealId}`}
                                        className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-all"
                                    >
                                        View Deal Details
                                    </button>
                                )}
                                <button
                                    onClick={() => window.history.back()}
                                    className="bg-white text-gray-700 border border-gray-300 px-6 py-2 rounded-lg font-bold hover:bg-gray-50 transition-all"
                                >
                                    Back to Lobby
                                </button>
                            </div>
                        </div>
                    )}

                    {(phase === 'greeting' || phase === 'offer') && !aiGreeting && (
                        <div className="text-center p-4 text-gray-400 italic text-sm">
                            Connecting to AI Mediator...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NegotiationRoom;
