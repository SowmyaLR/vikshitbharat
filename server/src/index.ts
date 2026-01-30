import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { AIMediatorService } from './services/AIMediatorService';
import { PriceTruthEngine } from './services/PriceTruthEngine';
import connectDatabase from './config/database';
import { Item } from './models/Item';
import { Vendor } from './models/Vendor';
import { Conversation } from './models/Conversation';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Services
const aiMediator = new AIMediatorService();
const priceEngine = new PriceTruthEngine();

// Connect to Database
connectDatabase();

// API Endpoints
// API Endpoints
import { User } from './models/User';

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/api/vendors', async (req, res) => {
    try {
        const { location } = req.query;
        const query = location ? { 'location.mandiName': location } : {};

        const vendors = await Vendor.find(query)
            .populate('availableCommodities.itemId')
            .exec();

        // Transform to frontend format if needed, or update frontend to match new schema
        // For now, mapping to ensure compatibility
        const formattedVendors = vendors.map((v: any) => ({
            id: v._id,
            name: v.businessName, // Ensure consistency with seed data
            trustScore: v.trustScore.overall,
            confidenceLevel: v.trustScore.overall > 80 ? "High" : "Medium",
            availableCommodities: v.availableCommodities.map((c: any) => c.name),
            location: v.location,
            reputationSummary: v.reputationSummary,
            scores: {
                priceHonesty: v.trustScore.priceHonesty / 100,
                fulfillment: v.trustScore.fulfillment / 100,
                negotiation: v.trustScore.negotiation / 100,
                language: 0.85 // Default for now
            }
        }));

        res.json(formattedVendors);
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ error: 'Failed to fetch vendors' });
    }
});

app.get('/api/prices', (req, res) => {
    const { commodity, location } = req.query;
    const priceData = priceEngine.getCurrentPrices(commodity as string, location as string);
    res.json(priceData);
});

// Socket.io for Real-time Negotiation & Signaling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', async (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);

        // Fetch and emit chat history
        try {
            const conversation = await Conversation.findOne({ roomId });
            if (conversation && conversation.messages.length > 0) {
                // Map to frontend format
                const history = conversation.messages.map(msg => ({
                    id: (msg as any)._id || Date.now().toString(),
                    sender: msg.sender,
                    originalText: msg.originalText,
                    translatedText: msg.translatedText,
                    timestamp: msg.timestamp
                }));
                socket.emit('chat_history', history);
            }
        } catch (err) {
            console.error('Error fetching chat history:', err);
        }

        // Notify seller about new negotiation
        const vendorId = roomId.replace('room-', '');
        io.to(`seller-${vendorId}`).emit('new_negotiation_request', {
            roomId: roomId,
            buyerName: 'Buyer',
            item: 'Commodity',
            location: 'Location',
            timestamp: new Date()
        });
    });

    // Seller joins their notification room
    socket.on('join_seller_room', (sellerId: string) => {
        const sellerRoom = `seller-${sellerId}`;
        socket.join(sellerRoom);
        console.log(`Seller ${sellerId} joined notification room ${sellerRoom}`);
    });

    // WebRTC Signaling
    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', data);
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', data);
    });

    socket.on('ice_candidate', (data) => {
        socket.to(data.roomId).emit('ice_candidate', data);
    });

    // Voice Message Transcript & Negotiation Logic
    socket.on('voice_message_transcript', async (data) => {
        console.log('📨 Received voice_message_transcript:', data);

        // 1. Translate Message
        const translatedText = await aiMediator.translate(data.text, data.language, 'en');

        // 2. Find or Create Conversation in Database
        let conversation = await Conversation.findOne({ roomId: data.roomId });

        if (!conversation) {
            // New conversation initiated
            conversation = new Conversation({
                roomId: data.roomId,
                commodity: data.commodity || 'Wheat',
                location: {
                    mandiName: data.location || 'Azadpur Mandi',
                    state: 'Delhi'
                },
                status: 'active',
                messages: []
            });
            await conversation.save();
        }

        // 3. Save User Message to Database
        conversation.messages.push({
            sender: data.sender as any,
            senderName: data.sender === 'buyer' ? 'Buyer' : (data.vendorName || 'Vendor'),
            originalText: data.text,
            translatedText: translatedText,
            language: data.language,
            timestamp: new Date()
        });
        conversation.lastActivityAt = new Date();
        await conversation.save();

        // 4. Emit Message to Room (Real-time update)
        io.to(data.roomId).emit('new_message', {
            id: Date.now().toString(),
            originalText: data.text,
            translatedText: translatedText,
            sender: data.sender,
            timestamp: new Date()
        });

        // 5. AI Analysis (Only if buyer sent the message)
        if (data.sender === 'buyer') {
            const commodity = data.commodity || 'Wheat';
            const location = data.location || 'Delhi';
            const vendorName = data.vendorName || 'Ramesh Kumar';

            const marketPriceData = priceEngine.getCurrentPrices(commodity, location);

            // Get last few messages for context
            const history = conversation.messages.slice(-5).map(m => ({
                sender: m.sender,
                text: m.translatedText || m.originalText
            }));

            const negotiationResult = await aiMediator.analyzeAndNegotiate({
                buyerMessage: data.text,
                commodity: commodity,
                marketPrice: {
                    min: marketPriceData.minPrice,
                    max: marketPriceData.maxPrice,
                    modal: marketPriceData.modalPrice
                },
                vendorName: vendorName,
                negotiationHistory: history
            });

            console.log('🤖 AI Negotiation Result:', negotiationResult);

            // 6. Save AI Response to Database
            if (negotiationResult.aiResponse) {
                conversation.messages.push({
                    sender: 'ai_mediator',
                    senderName: 'AI Mediator',
                    originalText: negotiationResult.aiResponse,
                    translatedText: negotiationResult.aiResponse,
                    language: 'en',
                    metadata: {
                        suggestedPrice: negotiationResult.suggestedPrice,
                        dealStatus: negotiationResult.dealStatus as any,
                        aiAnalysis: JSON.stringify(negotiationResult)
                    }
                });
                conversation.lastActivityAt = new Date();
                await conversation.save();
            }

            // 7. Emit AI Response (Delayed for realism)
            setTimeout(() => {
                io.to(data.roomId).emit('new_message', {
                    id: (Date.now() + 1).toString(),
                    originalText: negotiationResult.aiResponse,
                    translatedText: negotiationResult.aiResponse,
                    sender: 'ai_mediator',
                    timestamp: new Date(),
                    metadata: {
                        suggestedPrice: negotiationResult.suggestedPrice,
                        dealStatus: negotiationResult.dealStatus
                    }
                });

                // Check if deal conditions are met
                if (negotiationResult.dealStatus === 'deal_reached') {
                    // Update conversation status
                    conversation.status = 'active'; // Or 'pending_confirmation'
                    conversation.save();

                    setTimeout(() => {
                        io.to(data.roomId).emit('deal_update', {
                            status: 'potential_deal',
                            price: negotiationResult.suggestedPrice,
                            message: `💡 AI suggests this is a fair deal at ₹${negotiationResult.suggestedPrice}/quintal. Waiting for seller confirmation...`
                        });
                    }, 1000);
                }
            }, 1000);
        }
    });

    // Seller accepts negotiation
    socket.on('accept_negotiation', (data) => {
        console.log('✅ Seller accepted negotiation:', data);
        io.to(data.roomId).emit('seller_joined', {
            sellerName: data.sellerName,
            message: `${data.sellerName} has joined the negotiation`
        });
    });

    // Deal acceptance by either party
    socket.on('accept_deal', async (data) => {
        console.log('🤝 Deal accepted by:', data.acceptedBy);

        // Update conversation status
        await Conversation.findOneAndUpdate(
            { roomId: data.roomId },
            {
                status: 'completed',
                completedAt: new Date()
            }
        );

        io.to(data.roomId).emit('deal_update', {
            status: 'deal_confirmed',
            acceptedBy: data.acceptedBy,
            message: `${data.acceptedBy === 'buyer' ? 'Buyer' : 'Seller'} has accepted the deal!`
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
