import React from 'react';
import { Shield, Star, MessageCircle } from 'lucide-react';

interface TrustScoreProps {
    score: number;
    totalDeals?: number;
    breakdown?: {
        priceHonesty: number;
        negotiation: number;
        languageReliability: number;
    };
    size?: 'sm' | 'md' | 'lg';
}

const TrustScore: React.FC<TrustScoreProps> = ({ score, totalDeals = 0, breakdown, size = 'md' }) => {
    const getColor = (s: number) => {
        if (s >= 80) return 'text-green-600';
        if (s >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getConfidence = (deals: number) => {
        if (deals >= 20) return { label: 'High Volume', color: 'bg-green-100 text-green-700' };
        if (deals >= 5) return { label: 'Verified', color: 'bg-blue-100 text-blue-700' };
        return { label: 'New Trader', color: 'bg-gray-100 text-gray-700' };
    };

    const sizeClasses = {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-xl'
    };

    const confidence = getConfidence(totalDeals);

    return (
        <div className={`flex flex-col gap-2 ${sizeClasses[size]}`}>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <Shield className={`w-5 h-5 ${getColor(score)}`} />
                    <span className={`font-bold ${getColor(score)}`}>{Math.round(score)}/100</span>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${confidence.color}`}>
                    {confidence.label}
                </div>
            </div>

            {breakdown && (
                <div className="grid grid-cols-2 gap-2 mt-1 text-[10px]">
                    <div className="flex items-center gap-1.5 p-1.5 bg-gray-50/80 rounded border border-gray-100">
                        <Star className="w-3 h-3 text-purple-500" />
                        <span className="text-gray-600">Honesty: <b className="text-gray-900">{Math.round(breakdown.priceHonesty)}</b></span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 bg-gray-50/80 rounded border border-gray-100">
                        <Shield className="w-3 h-3 text-orange-500" />
                        <span className="text-gray-600">Stability: <b className="text-gray-900">{Math.round(breakdown.negotiation)}</b></span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 bg-gray-50/80 rounded border border-gray-100">
                        <MessageCircle className="w-3 h-3 text-teal-500" />
                        <span className="text-gray-600">Language: <b className="text-gray-900">{Math.round(breakdown.languageReliability)}</b></span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrustScore;
