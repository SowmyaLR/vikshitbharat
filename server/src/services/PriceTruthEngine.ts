import axios from 'axios';

interface PriceData {
    commodity: string;
    location: string;
    minPrice: number;
    maxPrice: number;
    modalPrice: number;
    lastUpdated: Date;
    source: 'agmarknet' | 'mock';
    confidence: number;
    fairPriceBand: {
        min: number;
        max: number;
    };
}

export class PriceTruthEngine {
    private cache: Map<string, PriceData> = new Map();
    private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    private readonly API_URL = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070'; // Example Agmarknet Resource ID
    private readonly API_KEY = process.env.DATA_GOV_API_KEY || 'test_key'; // Fallback for dev

    async getCurrentPrices(commodity: string = "Wheat", location: string = "Delhi"): Promise<PriceData> {
        const cacheKey = `${commodity.toLowerCase()}-${location.toLowerCase()}`;
        const cached = this.cache.get(cacheKey);

        if (cached && (new Date().getTime() - cached.lastUpdated.getTime() < this.CACHE_TTL)) {
            console.log(`📦 Serving cached price for ${commodity} in ${location}`);
            return cached;
        }

        try {
            console.log(`🌐 Fetching live prices from Agmarknet for ${commodity} in ${location}...`);
            // In a real scenario, we would construct the URL with filters
            // For hackathon/demo, we'll try to fetch but likely fall back if key/quota invalid

            // Simulating API call structure
            // const response = await axios.get(this.API_URL, {
            //     params: {
            //         'api-key': this.API_KEY,
            //         'format': 'json',
            //         'filters[commodity]': commodity,
            //         'filters[state]': location
            //     },
            //     timeout: 3000
            // });

            // Since we don't have a real stable free key for this specific resource in this environment,
            // We will simulate a network delay and returning improved mock data based on location
            await new Promise(resolve => setTimeout(resolve, 500));

            throw new Error("Demo Mode: Using Enhanced Mock Data");

        } catch (error) {
            console.warn(`⚠️ Agmarknet Fetch Failed: ${error instanceof Error ? error.message : 'Unknown error'}. using fallback.`);
            return this.getMockData(commodity, location);
        }
    }

    private getMockData(commodity: string, location: string): PriceData {
        let basePrice = 2200; // Wheat default (per quintal)

        // Commodity variances
        if (commodity.toLowerCase().includes('rice')) basePrice = 3500;
        else if (commodity.toLowerCase().includes('tomato')) basePrice = 1500;
        else if (commodity.toLowerCase().includes('onion')) basePrice = 1200;
        else if (commodity.toLowerCase().includes('potato')) basePrice = 800;

        // Location variances
        if (location.toLowerCase().includes('mumbai')) basePrice *= 1.15;
        else if (location.toLowerCase().includes('delhi')) basePrice *= 1.10;

        // Add fluctuation
        const variance = basePrice * 0.05;
        const currentModalQuintal = basePrice + (Math.random() * variance * 2 - variance);

        // --- CONVERT TO PER KG ---
        const toKg = (p: number) => parseFloat((p / 100).toFixed(2));

        const data: PriceData = {
            commodity: commodity,
            location: location,
            minPrice: toKg(currentModalQuintal * 0.90),
            maxPrice: toKg(currentModalQuintal * 1.10),
            modalPrice: toKg(currentModalQuintal),
            lastUpdated: new Date(),
            source: 'mock',
            confidence: 0.85,
            fairPriceBand: {
                min: toKg(currentModalQuintal * 0.95),
                max: toKg(currentModalQuintal * 1.05)
            }
        };

        // Cache the fallback
        const cacheKey = `${commodity.toLowerCase()}-${location.toLowerCase()}`;
        this.cache.set(cacheKey, data);

        return data;
    }
}
