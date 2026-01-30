import mongoose from 'mongoose';
import { User } from '../models/User';
import { Vendor } from '../models/Vendor';
import { Location } from '../models/Location';
import { Item } from '../models/Item';
import connectDatabase from '../config/database';

async function seedDatabase() {
    try {
        await connectDatabase();

        console.log('🌱 Seeding database...');

        // Clear existing data
        await User.deleteMany({});
        await Vendor.deleteMany({});
        await Location.deleteMany({});
        await Item.deleteMany({});

        // Create Locations
        const locations = await Location.insertMany([
            {
                state: 'Delhi',
                district: 'North Delhi',
                mandiName: 'Azadpur Mandi',
                address: 'Azadpur, Delhi',
                pincode: '110033',
                isActive: true
            },
            {
                state: 'Delhi',
                district: 'South Delhi',
                mandiName: 'Okhla Mandi',
                address: 'Okhla, Delhi',
                pincode: '110025',
                isActive: true
            },
            {
                state: 'Maharashtra',
                district: 'Mumbai',
                mandiName: 'Vashi APMC',
                address: 'Vashi, Navi Mumbai',
                pincode: '400703',
                isActive: true
            }
        ]);

        console.log(`✅ Created ${locations.length} locations`);

        // Create Items
        const items = await Item.insertMany([
            { name: 'Wheat', category: 'grain', unit: 'quintal', description: 'High quality wheat' },
            { name: 'Rice', category: 'grain', unit: 'quintal', description: 'Premium basmati rice' },
            { name: 'Tomato', category: 'vegetable', unit: 'quintal', description: 'Fresh tomatoes' },
            { name: 'Onion', category: 'vegetable', unit: 'quintal', description: 'Red onions' },
            { name: 'Potato', category: 'vegetable', unit: 'quintal', description: 'Fresh potatoes' }
        ]);

        console.log(`✅ Created ${items.length} items`);

        // Create Buyers
        const buyers = await User.insertMany([
            {
                name: 'Rajesh Farmer',
                phone: '9876543210',
                email: 'rajesh@example.com',
                role: 'buyer',
                location: {
                    state: 'Delhi',
                    district: 'North Delhi',
                    mandiName: 'Azadpur Mandi'
                },
                preferredLanguage: 'hi',
                isVerified: true
            },
            {
                name: 'Priya Agro',
                phone: '9876543211',
                email: 'priya@example.com',
                role: 'buyer',
                location: {
                    state: 'Delhi',
                    district: 'South Delhi',
                    mandiName: 'Okhla Mandi'
                },
                preferredLanguage: 'hi',
                isVerified: true
            }
        ]);

        console.log(`✅ Created ${buyers.length} buyers`);

        // Create Sellers
        const sellers = await User.insertMany([
            {
                name: 'Ramesh Kumar',
                phone: '9876543212',
                email: 'ramesh@example.com',
                role: 'seller',
                location: {
                    state: 'Delhi',
                    district: 'North Delhi',
                    mandiName: 'Azadpur Mandi'
                },
                preferredLanguage: 'ta',
                isVerified: true
            },
            {
                name: 'Suresh Traders',
                phone: '9876543213',
                email: 'suresh@example.com',
                role: 'seller',
                location: {
                    state: 'Maharashtra',
                    district: 'Mumbai',
                    mandiName: 'Vashi APMC'
                },
                preferredLanguage: 'mr',
                isVerified: true
            }
        ]);

        console.log(`✅ Created ${sellers.length} sellers`);

        // Create Vendors
        const vendors = await Vendor.insertMany([
            {
                userId: sellers[0]._id,
                businessName: 'Ramesh Kumar Trading',
                location: {
                    state: 'Delhi',
                    district: 'North Delhi',
                    mandiName: 'Azadpur Mandi'
                },
                trustScore: {
                    overall: 85,
                    priceHonesty: 90,
                    fulfillment: 80,
                    negotiation: 85
                },
                availableCommodities: [
                    {
                        itemId: items[0]._id,
                        name: 'Wheat',
                        currentStock: 500,
                        pricePerQuintal: 2200
                    },
                    {
                        itemId: items[1]._id,
                        name: 'Rice',
                        currentStock: 300,
                        pricePerQuintal: 3500
                    }
                ],
                reputationSummary: 'Consistent pricing, reliable delivery',
                totalDeals: 150,
                isActive: true
            },
            {
                userId: sellers[1]._id,
                businessName: 'Suresh Traders',
                location: {
                    state: 'Maharashtra',
                    district: 'Mumbai',
                    mandiName: 'Vashi APMC'
                },
                trustScore: {
                    overall: 78,
                    priceHonesty: 75,
                    fulfillment: 80,
                    negotiation: 80
                },
                availableCommodities: [
                    {
                        itemId: items[2]._id,
                        name: 'Tomato',
                        currentStock: 200,
                        pricePerQuintal: 1500
                    },
                    {
                        itemId: items[3]._id,
                        name: 'Onion',
                        currentStock: 400,
                        pricePerQuintal: 1200
                    }
                ],
                reputationSummary: 'Good quality vegetables, fair prices',
                totalDeals: 95,
                isActive: true
            }
        ]);

        console.log(`✅ Created ${vendors.length} vendors`);

        console.log('🎉 Database seeded successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Locations: ${locations.length}`);
        console.log(`   - Items: ${items.length}`);
        console.log(`   - Buyers: ${buyers.length}`);
        console.log(`   - Sellers: ${sellers.length}`);
        console.log(`   - Vendors: ${vendors.length}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
