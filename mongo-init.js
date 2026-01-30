// MongoDB initialization script
db = db.getSiblingDB('dharmavyapaara');

// Create collections
db.createCollection('users');
db.createCollection('vendors');
db.createCollection('locations');
db.createCollection('items');
db.createCollection('conversations');
db.createCollection('deals');

// Create indexes
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { sparse: true, unique: true });
db.vendors.createIndex({ userId: 1 });
db.vendors.createIndex({ 'location.mandiName': 1 });
db.conversations.createIndex({ roomId: 1 }, { unique: true });
db.conversations.createIndex({ 'buyer.id': 1 });
db.conversations.createIndex({ 'vendor.id': 1 });
db.deals.createIndex({ conversationId: 1 });
db.deals.createIndex({ buyerId: 1 });
db.deals.createIndex({ vendorId: 1 });

print('Database initialized successfully!');
