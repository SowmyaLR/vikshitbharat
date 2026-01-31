import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft } from 'lucide-react';

interface Vendor {
    id: string;
    name: string;
    location: { mandiName: string; state: string };
    availableCommodities: string[];
}

const VendorLobby: React.FC = () => {
    const { vendorId } = useParams();
    const navigate = useNavigate();
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    React.useEffect(() => {
        fetch('http://localhost:3000/api/vendors')
            .then(res => res.json())
            .then((vendors: Vendor[]) => {
                const found = vendors.find(v => v.id === vendorId);
                if (found) setVendor(found);
            });
    }, [vendorId]);

    const toggleItem = (item: string) => {
        setSelectedItems(prev =>
            prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
        );
    };

    const handleStartNegotiation = () => {
        if (selectedItems.length > 0) {
            // Generate a unique Room ID for this session
            // Format: room-{vendorId}-{buyerId}-{timestamp}
            const buyerId = localStorage.getItem('userId') || 'anon';
            const timestamp = Date.now();
            const uniqueRoomId = `room-${vendorId}-${buyerId}-${timestamp}`;

            navigate(`/negotiate/${uniqueRoomId}?items=${selectedItems.join(',')}&location=${vendor?.location.mandiName}&vendorId=${vendorId}`);
        }
    };

    if (!vendor) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-8">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
                >
                    <ArrowLeft size={20} />
                    Back to Vendors
                </button>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">
                            Negotiation Lobby
                        </h1>
                        <p className="text-gray-600">
                            Negotiating with <span className="font-semibold text-green-600">{vendor.name}</span>
                        </p>
                        <p className="text-sm text-gray-500">
                            {vendor.location.mandiName}, {vendor.location.state}
                        </p>
                    </div>

                    <div className="space-y-4 mb-8">
                        <h3 className="font-semibold text-lg">Select items to negotiate:</h3>
                        {vendor.availableCommodities.map((item) => (
                            <div
                                key={item}
                                onClick={() => toggleItem(item)}
                                className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${selectedItems.includes(item)
                                    ? 'border-green-600 bg-green-50 shadow-md'
                                    : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <ShoppingCart
                                            size={32}
                                            className={selectedItems.includes(item) ? 'text-green-600' : 'text-gray-400'}
                                        />
                                        <div>
                                            <h3 className="text-xl font-semibold text-gray-800">{item}</h3>
                                            <p className="text-sm text-gray-500">Available for negotiation</p>
                                        </div>
                                    </div>
                                    {selectedItems.includes(item) && (
                                        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleStartNegotiation}
                        disabled={selectedItems.length === 0}
                        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${selectedItems.length > 0
                            ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {selectedItems.length > 0 ? `Start Negotiation (${selectedItems.length} Items)` : 'Select items to continue'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VendorLobby;
