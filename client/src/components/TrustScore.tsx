import React from 'react';
import { Shield, Star, Award, MessageCircle } from 'lucide-react';

interface TrustScoreProps {
    score: number;
    breakdown?: {
        priceHonesty: number;
        fulfillment: number;
        negotiation: number;
        language: number;
    };
    size?: 'sm' | 'md' | 'lg';
}

const TrustScore: React.FC<TrustScoreProps> = ({ score, breakdown, size = 'md' }) => {
    const getColor = (s: number) => {
        if (s >= 80) return 'text-green-600';
        if (s >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getBgColor = (s: number) => {
        if (s >= 80) return 'bg-green-100';
        if (s >= 50) return 'bg-yellow-100';
        return 'bg-red-100';
    };

    const sizeClasses = {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-xl'
    };

    return (
        <div className={`flex flex-col gap-2 ${sizeClasses[size]}`}>
            <div className="flex items-center gap-2">
                <Shield className={`w-5 h-5 ${getColor(score)}`} />
                <span className={`font-bold ${getColor(score)}`}>{score}/100</span>
                <span className="text-gray-500 text-sm">Trust Score</span>
            </div>

            {breakdown && (
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className="flex items-center gap-1 p-1 bg-gray-50 rounded">
                        <Star className="w-3 h-3 text-purple-500" />
                        <span>Honesty: {Math.round(breakdown.priceHonesty * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-gray-50 rounded">
                        <Award className="w-3 h-3 text-blue-500" />
                        <span>Fulfillment: {Math.round(breakdown.fulfillment * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-gray-50 rounded">
                        <Shield className="w-3 h-3 text-orange-500" />
                        <span>Stability: {Math.round(breakdown.negotiation * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-gray-50 rounded">
                        <MessageCircle className="w-3 h-3 text-teal-500" />
                        <span>Language: {Math.round(breakdown.language * 100)}%</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrustScore;
