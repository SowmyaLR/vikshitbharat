import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, CheckCircle2, XCircle, Clock } from 'lucide-react';

const SOCKET_URL = ''; // Use proxy

const ConversationHistory: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [conversation, setConversation] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/conversations/${id}/history`)
            .then(res => res.json())
            .then(data => {
                setConversation(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch history", err);
                setLoading(false);
            });
    }, [id]);

    if (loading) return <div className="flex items-center justify-center h-screen">Loading history...</div>;
    if (!conversation) return <div className="p-8 text-center text-red-500">History not found.</div>;

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'deal_success': return { icon: <CheckCircle2 className="text-green-500" />, label: 'Success', color: 'bg-green-100 text-green-700' };
            case 'deal_failed': return { icon: <XCircle className="text-red-500" />, label: 'Failed', color: 'bg-red-100 text-red-700' };
            case 'abandoned': return { icon: <Clock className="text-gray-500" />, label: 'Abandoned', color: 'bg-gray-100 text-gray-700' };
            default: return { icon: <Lock className="text-blue-500" />, label: 'Closed', color: 'bg-blue-100 text-blue-700' };
        }
    };

    const statusInfo = getStatusInfo(conversation.status);

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft />
                    </button>
                    <div className="flex flex-col items-center">
                        <h1 className="font-bold text-gray-900">Negotiation Audit</h1>
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">{conversation.roomId}</span>
                    </div>
                    <div className={`px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${statusInfo.color}`}>
                        {statusInfo.icon} {statusInfo.label}
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 mt-8">
                {/* Closure Summary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Deal Outcome</h2>
                        <p className="text-sm text-gray-500">
                            Closed on {new Date(conversation.closedAt || conversation.updatedAt).toLocaleString()}
                        </p>
                        <p className="mt-2 text-gray-700 font-medium">
                            Reason: <span className="capitalize">{conversation.closureReason?.replace(/_/g, ' ') || 'Process completed'}</span>
                        </p>
                    </div>
                </div>

                {/* Offer Summary */}
                {
                    conversation.structuredOffer && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border mb-6">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Last Structured Offer</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <span className="text-xs text-gray-400 block mb-1">Quantity</span>
                                    <span className="text-xl font-bold">{conversation.structuredOffer.quantity} kg</span>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <span className="text-xs text-gray-400 block mb-1">Price</span>
                                    <span className="text-xl font-bold text-blue-600">₹{conversation.structuredOffer.price}/kg</span>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Chat History */}
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase">Message Transcript (Read-Only)</span>
                    </div>
                    <div className="p-6 space-y-4">
                        {conversation.messages.map((msg: any, idx: number) => (
                            <div key={idx} className={`flex ${msg.sender === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-4 rounded-2xl ${msg.sender === 'buyer'
                                    ? 'bg-green-600 text-white rounded-tr-none'
                                    : msg.sender === 'ai_mediator'
                                        ? 'bg-purple-50 text-purple-900 border border-purple-100'
                                        : 'bg-white text-gray-800 border-2 border-gray-100 rounded-tl-none'
                                    }`}>
                                    <div className="text-[10px] font-bold uppercase opacity-60 mb-1">
                                        {msg.senderName || msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{msg.originalText}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                    <Lock className="w-3 h-3" />
                    <span>This audit trail is preserved for transparency and trust scoring.</span>
                </div>
            </main >
        </div >
    );
};

export default ConversationHistory;
