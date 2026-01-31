const mongoose = require('mongoose');

const mongoUri = 'mongodb://localhost:27017/dharmavyapaara';

async function checkDb() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to DB');

        const items = await mongoose.connection.db.collection('items').find().toArray();
        console.log('\n--- ITEMS ---');
        items.forEach(i => console.log(`${i.name}: unit=${i.unit}, category=${i.category}`));

        const vendors = await mongoose.connection.db.collection('vendors').find().toArray();
        console.log('\n--- VENDORS ---');
        vendors.forEach(v => {
            console.log(`Vendor: ${v.businessName}`);
            v.availableCommodities.forEach(c => {
                console.log(`  - ${c.name}: ₹${c.pricePerQuintal}/quintal, stock=${c.currentStock}`);
            });
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDb();
