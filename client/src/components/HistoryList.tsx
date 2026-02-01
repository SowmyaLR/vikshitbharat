
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MessageSquare, ArrowRight } from 'lucide-react';

interface NegotiationHistory {
    _id: string;
    roomId: string;
    commodity: string;
    buyer: { name: string };
    vendor?: { name: string };
    closedAt: string;
    status: string;
    closureReason?: string;
}

const HistoryList: React.FC = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState<NegotiationHistory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            navigate('/login');
            return;
        }

        fetch(`/api/conversations/history/${userId}`)
            .then(res => res.json())
            .then(data => {
                setHistory(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch history list", err);
                setLoading(false);
            });
    }, [navigate]);

    if (loading) return <div className="p-8 text-center">Loading audit history...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Clock className="text-blue-600" size={32} />
                        Negotiation Audit Trail
                    </h1>
                    <p className="text-gray-500 mt-2">View all your past negotiations and their outcomes for transparency.</p>
                </div>
            </div>

            {history.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
                    <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-800">No past negotiations</h3>
                    <p className="text-gray-500 mt-1">Your closed negotiation records will appear here.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {history.map((item) => (
                        <div
                            key={item._id}
                            onClick={() => navigate(`/history/${item._id}`)}
                            className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                        >
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.status === 'deal_success' ? 'bg-green-100 text-green-700' :
                                            item.status === 'deal_failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {item.status.replace('_', ' ')}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-mono">{item.roomId}</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                        Negotiation for {item.commodity}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                            Closed: {new Date(item.closedAt).toLocaleDateString()}
                                        </span>
                                        {item.closureReason && (
                                            <span className="flex items-center gap-1 italic">
                                                Reason: {item.closureReason.replace('_', ' ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center text-blue-600 font-bold group-hover:translate-x-1 transition-transform">
                                    View Audit <ArrowRight size={18} className="ml-1" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HistoryList;
