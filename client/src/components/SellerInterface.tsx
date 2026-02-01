import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Phone, CheckCircle, Mic, MicOff, Send, AlertCircle, Clock } from 'lucide-react';

const SOCKET_URL = ''; // Use proxy

interface Message {
    id: string;
    originalText: string;
    translatedText: string;
    translations?: {
        buyer: string;
        seller: string;
    };
    sender: 'buyer' | 'vendor' | 'ai_mediator';
    senderName?: string;
    timestamp: Date;
    messageType?: 'text' | 'audio';
    audioUrl?: string;
    metadata?: any;
}

const SellerInterface: React.FC = () => {
    const { roomId } = useParams();
    const [searchParams] = useSearchParams();
    const item = searchParams.get('item');
    const location = searchParams.get('location');

    const [socket, setSocket] = useState<Socket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [dealStatus, setDealStatus] = useState<string | null>(null);
    const [myLanguage, setMyLanguage] = useState(
        searchParams.get('lang') || localStorage.getItem('myLang_seller') || 'en'
    );
    const [vendorName] = useState('Ramesh Kumar');

    // Deal Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [draftItems, setDraftItems] = useState<any[]>([]);
    const [draftTotal, setDraftTotal] = useState(0);

    // Audio and Warning State
    const [isListening, setIsListening] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<any>(null);

    const [messagesEndRef] = [useRef<HTMLDivElement>(null)];

    // AI-Led Deal Room State
    const [phase, setPhase] = useState<'greeting' | 'offer' | 'seller_review' | 'buyer_counter_review' | 'chat'>('greeting');
    const [structuredOffer, setStructuredOffer] = useState<{ quantity: number, price: number, purpose?: string } | null>(null);
    const [isTooLow, setIsTooLow] = useState(false);

    // Closure State
    const [isClosed, setIsClosed] = useState(false);
    const [closureData, setClosureData] = useState<{ reason: string, message: string, dealId?: string, conversationId?: string } | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!roomId) return;
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log(`🔌 [SELLER] Connected as socket: ${newSocket.id}`);
            const sellerId = roomId?.replace('room-', '').split('-')[0];
            console.log(`📡 [SELLER] Joining seller room: seller-${sellerId} and negotiation room: ${roomId}`);
            newSocket.emit('join_seller_room', sellerId);
            newSocket.emit('join_room', {
                roomId,
                role: 'seller',
                language: myLanguage
            });
        });

        newSocket.on('room_sync', (data: any) => {
            console.log('🏠 [SELLER] Room Sync Received:', data);
            if (data.phase) setPhase(data.phase);
            if (data.structuredOffer) setStructuredOffer(data.structuredOffer);
            if (data.isTooLow !== undefined) setIsTooLow(data.isTooLow);
            if (data.status && ['deal_success', 'deal_failed', 'abandoned'].includes(data.status)) {
                setIsClosed(true);
            }
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
            console.log('Deal Created:', deal);
            setDealStatus(deal);
        });

        newSocket.on('deal_updated', (deal: any) => {
            console.log('Deal Updated:', deal);
            setDealStatus(deal);
        });

        newSocket.on('deal_suggested', ({ deal }: { deal: any }) => {
            console.log('💡 AI Suggested Deal:', deal);
            if (deal && deal.items) {
                setDraftItems(deal.items);
                setDraftTotal(deal.totalAmount || 0);
            }
        });

        // AI-Led Deal Room Listeners
        newSocket.on('offer_submitted', (data: any) => {
            console.log('📬 [SELLER] Received offer_submitted event:', data);
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

    const handleDraftChange = (index: number, field: string, value: any) => {
        const newItems = [...draftItems];
        newItems[index] = { ...newItems[index], [field]: value };

        // Recalculate total
        if (field === 'price' || field === 'quantity') {
            const price = parseFloat(newItems[index].price) || 0;
            const qtyStr = String(newItems[index].quantity).replace(/[^\d.]/g, '');
            const qty = parseFloat(qtyStr) || 0;
            newItems[index].total = price * qty;
        }

        const newTotal = newItems.reduce((acc, item) => acc + (item.total || 0), 0);
        setDraftItems(newItems);
        setDraftTotal(newTotal);

        // Emit live preview to Buyer
        socket?.emit('preview_deal', {
            roomId,
            items: newItems,
            totalAmount: newTotal
        });
    };

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(_e => {
                // Silently fail if notification sound is missing or blocked
            });
        } catch (e) { }
    };

    // Web Speech + MediaRecorder
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
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
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
                        // handled by onresult usually, but fallback if needed
                    };
                }
            };

            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                if (mediaRecorderRef.current) {
                    const currentMimeType = mediaRecorderRef.current.mimeType;
                    mediaRecorderRef.current.stop();
                    mediaRecorderRef.current.onstop = () => {
                        const audioBlob = new Blob(audioChunksRef.current, { type: currentMimeType });
                        uploadAndSend(text, audioBlob);
                    };
                }
            };
            recognition.start();
        } catch (err) {
            console.error("Mic Error:", err);
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
            const extension = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
            formData.append('audio', audioBlob, `voice-message.${extension}`);
            try {
                const response = await fetch('http://localhost:3000/api/upload-audio', {
                    method: 'POST', body: formData
                });
                const data = await response.json();
                audioUrl = data.audioUrl;
            } catch (e) { console.error(e); }
        }
        sendMessage(text, audioUrl);
    };

    const sendMessage = (text?: string, audioUrl?: string) => {
        const msgText = text || inputText;
        if (socket && msgText.trim()) {
            console.log('📤 Seller sending message:', msgText);
            socket.emit('send_message', {
                roomId: roomId,
                text: msgText,
                audioUrl: audioUrl,
                sender: 'vendor',
                senderName: vendorName,
                language: myLanguage,
                targetLanguage: 'ta', // Default target, will be overridden by server
                commodity: item,
                location: location
            });
            setInputText('');
        }
    };

    const acceptDeal = () => {
        if (socket) {
            socket.emit('accept_deal', {
                roomId: roomId,
                acceptedBy: 'vendor'
            });
        }
    };

    // --- DEAL MANAGEMENT (Restored) ---
    const handleCreateDeal = () => {
        if (draftItems.length === 0) {
            const isRice = item?.toLowerCase().includes('rice');
            const unitPrice = isRice ? 35 : 22;
            const qty = 100;
            const initialItems = [{
                name: item || 'Rice',
                quantity: `${qty}kg`,
                price: unitPrice,
                total: unitPrice * qty
            }];
            setDraftItems(initialItems);
            setDraftTotal(unitPrice * qty);

            socket?.emit('preview_deal', {
                roomId,
                items: initialItems,
                totalAmount: unitPrice * qty
            });
        }
        setIsModalOpen(true);
    };

    const finalizeDeal = () => {
        const parts = roomId?.split('-');
        const vendorId = parts?.[1] || 'seller-1';
        const buyerId = parts?.[2] || 'buyer-1';

        const dealData = {
            roomId,
            items: draftItems,
            totalAmount: draftTotal,
            buyerId: buyerId,
            sellerId: vendorId
        };
        console.log('📤 Finalizing Deal:', dealData);
        socket?.emit('create_deal', dealData);
        setIsModalOpen(false);
    };

    const handleSignDeal = () => {
        if (!dealStatus) return;
        socket?.emit('update_deal_status', { dealId: (dealStatus as any)._id, action: 'sign_seller' });
    };

    return (
        <div className="flex h-screen bg-gray-50 flex-col md:flex-row">
            {warning && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 animate-bounce">
                    <AlertCircle className="w-5 h-5" />
                    {warning}
                </div>
            )}

            {/* Sidebar (Restored & Visible) */}
            <div className="w-full md:w-1/4 bg-white border-r p-4 overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Active Negotiations</h2>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 cursor-pointer">
                    <p className="font-semibold">{item || 'Commodity'}</p>
                    <p className="text-sm text-gray-600">Buyer: {messages.find(m => m.sender === 'buyer')?.senderName || 'Active Buyer'}</p>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full mt-2 inline-block">Active</span>
                </div>

                {/* Deal Actions Panel */}
                <div className="mt-8 border-t pt-4">
                    <h3 className="font-bold mb-2 text-gray-700">Deal Actions</h3>
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                        <button
                            onClick={handleCreateDeal}
                            className="w-full bg-indigo-600 text-white py-3 rounded mb-2 hover:bg-indigo-700 font-bold shadow-sm transition-colors"
                        >
                            Create Formal Deal (Demo)
                        </button>

                        {dealStatus && (
                            <div className="bg-white p-3 rounded border border-indigo-200 mt-2 shadow-sm">
                                <p className="font-bold text-sm text-indigo-900">Current Order</p>
                                <p className="text-xs mt-1 font-mono">Status: <span className="uppercase text-blue-600">{(dealStatus as any).status}</span></p>
                                <div className="my-2 border-t border-dashed border-gray-200"></div>
                                <p className="text-xs font-mono font-bold">Total: ₹{(dealStatus as any).totalAmount}</p>

                                {!(dealStatus as any).sellerSignature && (
                                    <button
                                        onClick={handleSignDeal}
                                        className="w-full mt-2 bg-green-600 text-white text-xs py-2 rounded font-bold hover:bg-green-700"
                                    >
                                        Sign & Finalize
                                    </button>
                                )}
                                {(dealStatus as any).sellerSignature && <p className="text-xs text-green-600 mt-2 font-bold flex items-center gap-1"><CheckCircle size={12} /> Signed by You</p>}
                                {(dealStatus as any).buyerSignature && <p className="text-xs text-green-600 font-bold flex items-center gap-1"><CheckCircle size={12} /> Signed by Buyer</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-[calc(100vh-200px)] md:h-screen">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-4 shadow-lg shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">🏪 Seller Dashboard</h1>
                            <p className="text-sm opacity-90">
                                Negotiating: {item} | Location: {location} <span className="opacity-50 text-xs ml-2">(Room: {roomId})</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full hidden md:flex">
                            <Phone size={16} />
                            <span className="text-sm font-semibold">AI Mediator Active</span>
                        </div>
                        <div className="flex gap-4 items-center ml-4">
                            <select
                                value={myLanguage}
                                onChange={(e) => {
                                    const newLang = e.target.value;
                                    setMyLanguage(newLang);
                                    localStorage.setItem('myLang_seller', newLang);
                                    socket?.emit('update_preference', {
                                        roomId: roomId,
                                        role: 'seller',
                                        language: newLang
                                    });
                                }}
                                className="text-sm border rounded-lg p-2 bg-orange-700 text-white border-orange-500 cursor-pointer"
                            >
                                <option value="hi">Hindi (हिंदी)</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'vendor' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 ${msg.sender === 'vendor'
                                ? 'bg-orange-600 text-white rounded-br-none shadow-md'
                                : msg.sender === 'ai_mediator'
                                    ? 'bg-blue-600 text-white rounded-bl-none shadow-lg border-2 border-blue-400'
                                    : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'
                                }`}>
                                <div className={`text-xs font-bold mb-1 flex items-center gap-1 ${msg.sender === 'vendor' ? 'text-orange-100' :
                                    msg.sender === 'ai_mediator' ? 'text-blue-100' :
                                        'text-green-600'
                                    }`}>
                                    {msg.sender === 'vendor' ? '🏪 You' :
                                        msg.sender === 'ai_mediator' ? '🤖 AI Mediator' :
                                            '👤 Buyer'}
                                </div>

                                {/* Audio Player */}
                                {msg.audioUrl && (
                                    <div className="mb-2 bg-black/10 p-2 rounded-lg flex items-center gap-2">
                                        <audio controls src={`http://localhost:3000${msg.audioUrl}`} className="h-8 w-48" />
                                    </div>
                                )}

                                <div className="text-base leading-relaxed">
                                    {msg.translations?.seller || msg.originalText}
                                </div>
                                {msg.originalText && (msg.translations?.seller || msg.originalText) !== msg.originalText && (
                                    <div className={`mt-2 p-2 rounded text-sm ${msg.sender === 'vendor' ? 'bg-orange-700/50 text-orange-50' :
                                        msg.sender === 'ai_mediator' ? 'bg-blue-700/50 text-blue-50' :
                                            'bg-gray-50 text-gray-600 border border-gray-100'
                                        }`}>
                                        <div className="flex items-center gap-1 opacity-75 text-[10px] uppercase tracking-wider mb-1">
                                            <span>Original</span>
                                        </div>
                                        {msg.originalText}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white p-4 border-t shrink-0">
                    {phase === 'seller_review' && structuredOffer && (
                        <div className="mb-4 bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-xl animate-in zoom-in duration-500">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900">New Offer Received</h3>
                                    <p className="text-sm text-gray-500">Buyer wants to start a deal</p>
                                </div>
                                <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest ${isTooLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    Fairness Score: {isTooLow ? '🔴 Poor' : '🟢 Good'}
                                </div>
                            </div>

                            <div className="flex bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100 gap-8">
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Quantity</span>
                                    <span className="text-2xl font-black text-gray-800">{structuredOffer.quantity} kg</span>
                                </div>
                                <div className="border-l border-gray-200 pl-8">
                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Offer Price</span>
                                    <span className="text-2xl font-black text-indigo-600">₹{structuredOffer.price}/kg</span>
                                </div>
                                {structuredOffer.purpose && (
                                    <div className="border-l border-gray-200 pl-8 flex-1">
                                        <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Purpose</span>
                                        <span className="text-sm text-gray-600 line-clamp-2 italic">"{structuredOffer.purpose}"</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => socket?.emit('seller_decision', { roomId, decision: 'accept' })}
                                    className="flex-1 bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95"
                                >
                                    Accept Offer
                                </button>
                                <button
                                    onClick={() => {
                                        const counter = prompt("Enter your counter price (₹/kg):", String(structuredOffer.price + 2));
                                        if (counter) {
                                            socket?.emit('seller_decision', { roomId, decision: 'counter', counterPrice: parseInt(counter) });
                                        }
                                    }}
                                    className="flex-1 bg-white border-2 border-indigo-600 text-indigo-600 py-4 rounded-xl font-bold hover:bg-indigo-50 transition-all"
                                >
                                    Counter Offer
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm("Are you sure you want to reject this offer?")) {
                                            socket?.emit('seller_decision', { roomId, decision: 'reject' });
                                        }
                                    }}
                                    className="px-6 bg-red-50 text-red-600 py-4 rounded-xl font-bold hover:bg-red-100 transition-all"
                                >
                                    Reject
                                </button>
                            </div>
                            {isTooLow && (
                                <p className="text-center text-xs text-red-500 mt-4 italic font-medium">
                                    💡 Tip: This offer is below market rates. A counter-offer between ₹18-₹21 is recommended.
                                </p>
                            )}
                        </div>
                    )}

                    {phase === 'chat' && (
                        <>
                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={() => isListening ? stopListening() : startListening()}
                                    className={`p-4 rounded-full transition-all shadow-sm ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200'}`}
                                >
                                    {isListening ? <MicOff /> : <Mic />}
                                </button>

                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendMessage(inputText)}
                                    placeholder="Type (Hindi)..."
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
                                />
                                <button
                                    onClick={() => sendMessage(inputText)}
                                    className="bg-orange-600 text-white p-3 rounded-xl hover:bg-orange-700 transition-colors shadow-sm"
                                >
                                    <Send />
                                </button>
                            </div>
                            <p className="text-[10px] text-center text-gray-400 mt-2">
                                Speaking triggers automatic recording and translation.
                            </p>
                        </>
                    )}

                    {phase === 'greeting' && (
                        <div className="text-center p-6 text-gray-400 italic text-sm animate-pulse">
                            Waiting for buyer to review market context and make an initial offer.
                        </div>
                    )}

                    {phase === 'offer' && (
                        <div className="text-center p-6 text-indigo-400 italic text-sm animate-pulse">
                            Buyer is currently drafting their structured offer...
                        </div>
                    )}

                    {phase === 'buyer_counter_review' && (
                        <div className="text-center p-6 text-orange-400 italic text-sm animate-pulse">
                            Waiting for buyer to review your counter-offer...
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
                            <div className="flex justify-center">
                                <button
                                    onClick={() => closureData?.conversationId && (window.location.href = `/history/${closureData.conversationId}`)}
                                    className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                                >
                                    <Clock size={18} />
                                    View Negotiation Record & Deal
                                </button>
                            </div>
                            <button
                                onClick={() => window.history.back()}
                                className="bg-white text-gray-700 border border-gray-300 px-6 py-2 rounded-lg font-bold hover:bg-gray-50 transition-all"
                            >
                                Back to Lobby
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {/* Deal Draft Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <CheckCircle className="w-6 h-6" />
                                Draft Formal Deal
                            </h2>
                            <p className="text-indigo-100 text-sm mt-1">Review items and prices before sending to buyer.</p>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            {draftItems.map((item, idx) => (
                                <div key={idx} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Item Name</label>
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => handleDraftChange(idx, 'name', e.target.value)}
                                                className="w-full bg-white border rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Quantity</label>
                                            <input
                                                type="text"
                                                value={item.quantity}
                                                onChange={(e) => handleDraftChange(idx, 'quantity', e.target.value)}
                                                className="w-full bg-white border rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Price (per kg)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2 text-gray-400 text-sm">₹</span>
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => handleDraftChange(idx, 'price', e.target.value)}
                                                    className="w-full bg-white border rounded-lg p-2 pl-6 text-sm focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Total</label>
                                            <div className="p-2 text-sm font-bold text-gray-700">₹{(item.total || 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex flex-col gap-3">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-gray-500 font-medium">Grand Total:</span>
                                <span className="text-2xl font-black text-indigo-600">₹{draftTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={finalizeDeal}
                                    className="flex-[2] bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
                                >
                                    Create Formal Deal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SellerInterface;
