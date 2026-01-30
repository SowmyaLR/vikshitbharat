import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import TrustScore from './TrustScore';
import { MapPin, ArrowRight, ArrowLeft } from 'lucide-react';

interface Vendor {
    id: string;
    name: string;
    trustScore: number;
    confidenceLevel: string;
    availableCommodities: string[];
    location: { mandiName: string; state: string };
    reputationSummary: string;
    scores: {
        priceHonesty: number;
        fulfillment: number;
        negotiation: number;
        language: number;
    };
}

const VendorList: React.FC = () => {
    const [searchParams] = useSearchParams();
    const location = searchParams.get('location');
    const state = searchParams.get('state');

    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:3000/api/vendors')
            .then(res => res.json())
            .then(data => {
                // Filter vendors by location if specified
                const filtered = location
                    ? data.filter((v: Vendor) => v.location.mandiName === location)
                    : data;
                setVendors(filtered);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch vendors", err);
                setLoading(false);
            });
    }, [location]);

    if (loading) return <div className="p-8 text-center">Loading marketplace...</div>;

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <Link
                to="/"
                className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium"
            >
                <ArrowLeft className="w-4 h-4" />
                Change Location
            </Link>

            <div className="bg-gradient-to-r from-green-600 to-green-800 p-6 rounded-2xl text-white shadow-lg">
                <h1 className="text-3xl font-bold mb-2">
                    {location ? `Vendors at ${location}` : 'Find Trusted Vendors'}
                </h1>
                <p className="opacity-90">
                    {location
                        ? `AI-verified vendors in ${location}, ${state}`
                        : 'AI-verified trust scores for fair agricultural trading.'
                    }
                </p>
            </div>

            {vendors.length === 0 ? (
                <div className="bg-white rounded-xl shadow p-8 text-center">
                    <p className="text-gray-600 text-lg">No vendors found at this location.</p>
                    <Link
                        to="/"
                        className="mt-4 inline-block text-green-600 hover:text-green-700 font-medium"
                    >
                        Try a different location
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {vendors.map((vendor) => (
                        <div key={vendor.id} className="bg-white rounded-xl shadow border border-gray-100 p-5 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">{vendor.name}</h2>
                                    <div className="flex items-center text-gray-500 text-sm mt-1">
                                        <MapPin className="w-3 h-3 mr-1" />
                                        {vendor.location.mandiName}, {vendor.location.state}
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${vendor.confidenceLevel === 'High' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                    {vendor.confidenceLevel} Confidence
                                </span>
                            </div>

                            <div className="mb-4">
                                <TrustScore score={vendor.trustScore} breakdown={vendor.scores} />
                            </div>

                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-2 font-medium">Available Commodities:</p>
                                <div className="flex flex-wrap gap-2">
                                    {vendor.availableCommodities.map(c => (
                                        <span key={c} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-100">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded mb-4 italic">
                                "{vendor.reputationSummary}"
                            </p>

                            <Link
                                to={`/select-item/${vendor.id}`}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                Start Negotiation <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VendorList;
