import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, Search } from 'lucide-react';

interface MandiLocation {
    state: string;
    district: string;
    mandiName: string;
}

const LocationSelector: React.FC = () => {
    const navigate = useNavigate();
    const [selectedState, setSelectedState] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Mock location data - in production, this would come from an API
    const locations: MandiLocation[] = [
        { state: 'Delhi', district: 'North Delhi', mandiName: 'Azadpur Mandi' },
        { state: 'Delhi', district: 'South Delhi', mandiName: 'Okhla Mandi' },
        { state: 'Maharashtra', district: 'Mumbai', mandiName: 'Vashi APMC' },
        { state: 'Karnataka', district: 'Bangalore', mandiName: 'Yeshwanthpur Mandi' },
        { state: 'Tamil Nadu', district: 'Chennai', mandiName: 'Koyambedu Market' },
    ];

    const filteredLocations = locations.filter(loc => {
        const matchesState = !selectedState || loc.state === selectedState;
        const matchesSearch = !searchQuery ||
            loc.mandiName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            loc.district.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesState && matchesSearch;
    });

    const states = Array.from(new Set(locations.map(l => l.state)));

    const handleLocationSelect = (location: MandiLocation) => {
        navigate(`/vendors?location=${encodeURIComponent(location.mandiName)}&state=${encodeURIComponent(location.state)}`);
    };

    return (
        <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-green-50 to-blue-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-3">
                        <MapPin className="w-10 h-10 text-green-600" />
                        Select Your Mandi Location
                    </h1>
                    <p className="text-gray-600 text-lg">
                        Find trusted vendors in your local agricultural market
                    </p>
                </div>

                {/* Search and Filter */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search mandi or district..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>

                        {/* State Filter */}
                        <select
                            value={selectedState}
                            onChange={(e) => setSelectedState(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="">All States</option>
                            {states.map(state => (
                                <option key={state} value={state}>{state}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Location Cards */}
                <div className="grid md:grid-cols-2 gap-4">
                    {filteredLocations.map((location, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleLocationSelect(location)}
                            className="bg-white rounded-xl shadow hover:shadow-lg transition-all p-6 text-left group border-2 border-transparent hover:border-green-500"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MapPin className="w-5 h-5 text-green-600" />
                                        <h3 className="font-bold text-lg text-gray-800">{location.mandiName}</h3>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">{location.district}</p>
                                    <p className="text-xs text-gray-500">{location.state}</p>
                                </div>
                                <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </button>
                    ))}
                </div>

                {filteredLocations.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No mandis found matching your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationSelector;
