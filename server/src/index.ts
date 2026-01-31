import express from 'express';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AIMediatorService } from './services/AIMediatorService';
import { PriceTruthEngine } from './services/PriceTruthEngine';
import connectDatabase from './config/database';
import { Item } from './models/Item';
import { Vendor } from './models/Vendor';
import { Conversation } from './models/Conversation';
import { Deal } from './models/Deal';
import { User } from './models/User';
import { trustScoringService } from './services/TrustScoringService';

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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = process.env.PORT || 3000;

// Services
const aiMediator = new AIMediatorService();
const priceEngine = new PriceTruthEngine();

// Connect to Database
connectDatabase();

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// API Endpoints

app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
    }
    const audioUrl = `/uploads/${req.file.filename}`;
    res.json({ audioUrl });
});

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

        const formattedVendors = vendors.map((v: any) => ({
            id: v._id,
            name: v.businessName,
            trustScore: v.trustScore,
            totalDeals: v.totalDeals || 0,
            availableCommodities: v.availableCommodities.map((c: any) => c.name),
            location: v.location,
            reputationSummary: v.reputationSummary
        }));

        res.json(formattedVendors);
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ error: 'Failed to fetch vendors' });
    }
});

app.get('/api/prices', async (req, res) => {
    const { commodity, location } = req.query;
    const priceData = await priceEngine.getCurrentPrices(commodity as string, location as string);
    res.json(priceData);
});

app.get('/api/conversations/vendor/:vendorId', async (req, res) => {
    try {
        const { vendorId } = req.params;
        // Search conversation by roomId prefix
        const conversations = await Conversation.find({
            roomId: new RegExp(`^room-${vendorId}-`),
            status: { $in: ['active', 'pending', 'deal_room'] } // Only active/pending
        })
            .sort({ lastActivityAt: -1 })
            .limit(10);
        res.json(conversations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// GET /api/conversations/history/:userId - List closed conversations
app.get('/api/conversations/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const conversations = await Conversation.find({
            $or: [
                { 'buyer.id': userId },
                { 'vendor.id': userId }
            ],
            status: { $in: ['deal_success', 'deal_failed', 'abandoned'] }
        })
            .sort({ closedAt: -1 })
            .limit(50);
        res.json(conversations);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// GET /api/conversations/:id/history - Get specific conversation (read-only)
app.get('/api/conversations/:id/history', async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id)
            .populate('finalDealId');
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch conversation details' });
    }
});

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', async (data) => {
        const roomId = typeof data === 'string' ? data : data.roomId;
        const buyerName = typeof data === 'object' ? (data.buyerName || 'Buyer') : 'Buyer';
        const buyerLocation = typeof data === 'object' ? (data.location || 'Azadpur Mandi') : 'Azadpur Mandi';
        const commodityRaw = typeof data === 'object' ? (data.commodity || 'Wheat') : 'Wheat';

        console.log(`[SOCKET] User ${socket.id} joining room: ${roomId}`);
        socket.join(roomId);
        console.log(`🔌 Socket ${socket.id} joined room: ${roomId} as ${buyerName}`);

        let conversation;
        try {
            // Use findOneAndUpdate with upsert to prevent race conditions (E11000)
            conversation = await Conversation.findOneAndUpdate(
                { roomId },
                {
                    $setOnInsert: {
                        roomId,
                        commodity: commodityRaw,
                        location: { mandiName: buyerLocation, state: 'Delhi' },
                        buyer: { name: buyerName },
                        status: 'deal_room',
                        negotiationPhase: 'greeting'
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // Parallel updates: if it's an existing room, verify details
            let needsUpdate = false;
            if (!conversation.commodity) {
                conversation.commodity = commodityRaw;
                needsUpdate = true;
            }

            if (typeof data === 'object') {
                if (!conversation.buyer?.name || conversation.buyer.name === 'Buyer') {
                    (conversation as any).buyer = { ...conversation.buyer, name: buyerName };
                    needsUpdate = true;
                }
                if (data.commodity && conversation.commodity === 'Wheat' && data.commodity !== 'Wheat') {
                    conversation.commodity = data.commodity;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await conversation.save();
            }

            // TRIGGER GREETING IF IN GREETING PHASE
            if ((conversation as any).negotiationPhase === 'greeting') {
                console.log(`🤖 Triggering AI Greeting for room: ${roomId}`);
                const commodity = conversation.commodity || 'Wheat';
                const location = conversation.location?.mandiName || buyerLocation;
                const marketPriceData = await priceEngine.getCurrentPrices(commodity, location);

                // Persist market data
                conversation.marketData = {
                    minPrice: marketPriceData.minPrice,
                    maxPrice: marketPriceData.maxPrice,
                    modalPrice: marketPriceData.modalPrice,
                    priceDate: new Date()
                };

                const greeting = await aiMediator.generateGreeting({
                    commodity: commodity,
                    location: location,
                    marketPrice: {
                        min: marketPriceData.minPrice,
                        max: marketPriceData.maxPrice,
                        modal: marketPriceData.modalPrice
                    },
                    language: conversation.buyerLanguage || 'en'
                });

                // Persist Greeting
                (conversation as any).aiGreeting = greeting;
                (conversation as any).negotiationPhase = 'offer';
                await conversation.save();

                socket.emit('ai_greeting', { text: greeting });
            }

            // UNIFIED ROOM SYNC (always emit on join/rejoin)
            console.log(`[ROOM_SYNC] Emitting phase: ${(conversation as any).negotiationPhase} for room: ${roomId}`);
            socket.emit('room_sync', {
                phase: (conversation as any).negotiationPhase,
                aiGreeting: (conversation as any).aiGreeting,
                aiInsight: (conversation as any).aiInsight,
                isTooLow: (conversation as any).isOfferTooLow,
                structuredOffer: (conversation as any).structuredOffer
            });

            if (conversation && conversation.messages.length > 0) {
                const history = conversation.messages.map(msg => ({
                    id: (msg as any)._id || Date.now().toString(),
                    sender: msg.sender,
                    senderName: msg.senderName,
                    originalText: msg.originalText,
                    translatedText: msg.translatedText,
                    timestamp: msg.timestamp,
                    messageType: (msg as any).messageType || 'text',
                    audioUrl: (msg as any).audioUrl
                }));
                socket.emit('chat_history', history);
            }
        } catch (err) {
            console.error('Error handling join_room:', err);
        }

        const rawVendorId = roomId.replace('room-', '');
        const vendorId = rawVendorId.split('-')[0];

        try {
            const payload = {
                roomId,
                buyerName: buyerName,
                item: conversation?.commodity || 'Wheat',
                location: buyerLocation,
                timestamp: new Date()
            };

            // Check if vendorId is valid ObjectId
            if (!vendorId.match(/^[0-9a-fA-F]{24}$/)) {
                io.to(`seller-${vendorId}`).emit('new_negotiation_request', payload);
                return;
            }

            const vendor = await Vendor.findById(vendorId);
            if (vendor) {
                // Emit to both UserID (Owner) and VendorID (Public) to ensure delivery
                const ownerRoom = vendor.userId ? `seller-${vendor.userId.toString()}` : null;
                const publicRoom = `seller-${vendorId}`;

                console.log(`🔔 Emitting to Owner: ${ownerRoom} AND Public: ${publicRoom} for Room: ${roomId}`);

                const payload = {
                    roomId,
                    buyerName: 'Buyer',
                    item: (conversation as any)?.commodity || 'Wheat', // Use 'conversation' (now in scope)
                    location: (conversation as any)?.location?.mandiName || 'Unknown',
                    timestamp: new Date()
                };

                if (ownerRoom) io.to(ownerRoom).emit('new_negotiation_request', payload);
                io.to(publicRoom).emit('new_negotiation_request', payload);
            } else {
                console.warn(`Could not find vendor or userId for vendorId: ${vendorId}`);
            }
        } catch (err) {
            console.error('Error looking up vendor for notification:', err);
        }
    });

    socket.on('join_seller_room', (sellerId: string) => {
        socket.join(`seller-${sellerId}`);
    });

    // Unified Message Handler
    socket.on('update_preference', async (data) => {
        try {
            const update = data.role === 'buyer'
                ? { buyerLanguage: data.language }
                : { sellerLanguage: data.language };

            await Conversation.findOneAndUpdate(
                { roomId: data.roomId },
                { $set: update },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`🗣️ Updated ${data.role} language to ${data.language} for room ${data.roomId}`);
        } catch (err) {
            console.error('Error updating language preference:', err);
        }
    });

    socket.on('send_message', async (data) => {
        console.log('📨 Received message:', data);

        // 1. Fetch Conversation (needed for history-based triggers and translation)
        let conversation = await Conversation.findOne({ roomId: data.roomId });
        const history = conversation ? conversation.messages : [];

        // 2. Safety Check (AI Moderation) - Only during structured negotiation
        const currentPhase = conversation ? (conversation as any).negotiationPhase : 'greeting';

        // Skip AI safety checks during free chat phase (only check banned words locally)
        if (currentPhase !== 'chat') {
            const safetyCheck = await aiMediator.checkSafety(data.text, history);
            if (!safetyCheck.isSafe) {
                console.warn(`🚫 Blocked unsafe message from ${data.sender}: ${data.text}`);
                socket.emit('moderation_warning', {
                    reason: safetyCheck.reason || "Message blocked due to policy violation."
                });
                return;
            }
        } else {
            // Light check: only banned words during chat phase
            const bannedWords = ['idiot', 'stupid', 'scam', 'cheat', 'fraud', 'moorka', 'badava', 'poda'];
            if (bannedWords.some(word => data.text.toLowerCase().includes(word))) {
                console.warn(`🚫 Blocked banned word during chat from ${data.sender}`);
                socket.emit('moderation_warning', {
                    reason: "Offensive language detected. Please maintain professional behavior."
                });
                return;
            }
        }

        if (!conversation) {
            // If conversation doesn't exist, create it with initial preferences
            conversation = new Conversation({
                roomId: data.roomId,
                commodity: data.commodity || 'Wheat',
                location: { mandiName: data.location || 'Azadpur Mandi', state: 'Delhi' },
                status: 'active',
                buyerLanguage: data.sender === 'buyer' ? data.language : (data.targetLanguage || 'en'),
                sellerLanguage: data.sender !== 'buyer' ? data.language : 'en',
                messages: []
            });
            await conversation.save();
        }

        // Determine Target Language based on Role
        // If sender is Buyer, target is Seller's language.
        // If sender is Seller, target is Buyer's language.
        const targetLang = data.sender === 'buyer'
            ? (conversation.sellerLanguage || 'en')
            : (conversation.buyerLanguage || 'en');

        const translatedText = await aiMediator.translate(data.text, data.language, targetLang);

        // 3. Save to DB
        conversation.messages.push({
            sender: data.sender,
            senderName: data.senderName || (data.sender === 'buyer' ? 'Buyer' : 'Seller'),
            // @ts-ignore
            messageType: data.audioUrl ? 'audio' : 'text',
            audioUrl: data.audioUrl,
            originalText: data.text,
            translatedText: translatedText,
            spokenLanguage: data.language,
            targetLanguage: targetLang,
            timestamp: new Date()
        } as any);
        conversation.lastActivityAt = new Date();

        // Update sender's language preference if changed
        if (data.sender === 'buyer') conversation.buyerLanguage = data.language;
        if (data.sender === 'seller' || data.sender === 'vendor') conversation.sellerLanguage = data.language;

        await conversation.save();

        // 4. Emit to Room
        io.to(data.roomId).emit('new_message', {
            id: Date.now().toString(),
            sender: data.sender,
            senderName: data.senderName,
            originalText: data.text,
            translatedText: translatedText,
            audioUrl: data.audioUrl,
            timestamp: new Date()
        });

        // Background Task: Language Reliability (LRS) trigger for disputes
        const lowerMsg = data.text.toLowerCase();
        const disputeKeywords = ['wrong translation', 'misunderstood', 'fraud', 'cheat', 'not correct', 'गलत', 'धोखा'];
        // Background Task: Language Reliability (LRS) trigger for disputes
        if (disputeKeywords.some(k => lowerMsg.includes(k))) {
            const parts = data.roomId.split('-');
            const vendorId = parts[1];
            if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
                trustScoringService.triggerDisputeUpdate(vendorId);
            }
        }

        // 5. AI Negotiation (Mediator)
        // Checks both Buyer and Seller messages
        const commodity = conversation.commodity || 'Wheat'; // Source of Truth
        const location = conversation.location?.mandiName || data.location || 'Delhi';

        // Fetch real market data
        const marketPriceData = await priceEngine.getCurrentPrices(commodity, location);
        console.log(`[DEBUG] Market Price Fetch for ${commodity} in ${location}:`, marketPriceData);

        const medHistory = conversation.messages.slice(-5).map(m => ({
            sender: m.sender,
            message: m.translatedText || m.originalText
        }));

        const negotiationResult = await aiMediator.analyzeAndNegotiate({
            sender: data.sender,
            message: data.text,
            translatedMessage: translatedText,
            commodity: commodity,
            marketPrice: {
                min: marketPriceData.minPrice,
                max: marketPriceData.maxPrice,
                modal: marketPriceData.modalPrice
            },
            history: medHistory,
            userLanguage: data.sender === 'buyer' ? conversation.buyerLanguage : conversation.sellerLanguage,
            phase: (conversation as any).negotiationPhase
        });

        if (negotiationResult.shouldIntervene && negotiationResult.aiMessage) {
            console.log('🤖 AI Intervening:', negotiationResult.aiMessage);

            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: negotiationResult.aiMessage,
                translatedText: negotiationResult.aiMessage, // AI speaks English/Common
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date(),
                metadata: {
                    suggestedPrice: negotiationResult.suggestedPrice
                }
            } as any);
            await conversation.save();

            // Delay for realism
            setTimeout(() => {
                io.to(data.roomId).emit('new_message', {
                    id: (Date.now() + 1).toString(),
                    sender: 'ai_mediator',
                    senderName: 'AI Mediator',
                    originalText: negotiationResult.aiMessage,
                    translatedText: negotiationResult.aiMessage,
                    timestamp: new Date(),
                    metadata: {
                        suggestedPrice: negotiationResult.suggestedPrice
                    }
                });
            }, 1000);
        }

        // 6. Emit Deal Updates if AI found something
        if (negotiationResult.extractedDeal) {
            console.log('📜 AI Extracted Deal:', negotiationResult.extractedDeal);
            io.to(data.roomId).emit('deal_suggested', {
                deal: negotiationResult.extractedDeal
            });
        }
    });

    // --- DEAL MANAGEMENT ---
    socket.on('preview_deal', (data) => {
        // Broadcast the live draft to the other party (Buyer)
        socket.to(data.roomId).emit('deal_preview', data);
        console.log(`[Deal] Preview update for room ${data.roomId}`);
    });

    socket.on('create_deal', async (dealData: any) => {
        try {
            // dealData: { roomId, items, totalAmount, buyerId, sellerId }
            const newDeal = new Deal(dealData);
            await newDeal.save();

            // Success Path: Close Conversation
            const conversation = await Conversation.findOne({ roomId: dealData.roomId });
            if (conversation) {
                conversation.status = 'deal_success';
                (conversation as any).closedAt = new Date();
                (conversation as any).closureReason = 'deal_created';
                (conversation as any).finalDealId = newDeal._id;
                await conversation.save();

                io.to(dealData.roomId).emit('conversation_closed', {
                    reason: 'deal_success',
                    message: '✅ Deal finalized! This conversation is now closed.',
                    dealId: newDeal._id
                });
            }

            io.to(dealData.roomId).emit('deal_created', newDeal);
            console.log(`✅ [Deal] Created: ${newDeal._id}. Triggering background trust updates.`);

            // Background Task: Update Trust Scores (Recalculate all 3 on Deal)
            // Extract vendor ID safely from roomId (Format: room-vendorId-buyerId-timestamp)
            try {
                const parts = dealData.roomId.split('-');
                if (parts.length >= 2) {
                    const vendorId = parts[1];
                    if (mongoose.Types.ObjectId.isValid(vendorId)) {
                        // Run in background without awaiting to keep UI responsive
                        trustScoringService.updateScoresOnDeal(dealData.roomId, vendorId).catch(err =>
                            console.error('[TrustScore] Background update failed:', err)
                        );
                    } else {
                        console.warn(`[TrustScore] Invalid VendorId in roomId: ${vendorId}`);
                    }
                }
            } catch (calcError) {
                console.error('[TrustScore] Error initiating background calculation:', calcError);
            }
        } catch (err) {
            console.error("Error creating deal:", err);
        }
    });

    socket.on('update_deal_status', async ({ dealId, action, address }) => {
        try {
            const deal = await Deal.findById(dealId);
            if (!deal) return;

            if (action === 'sign_buyer') {
                deal.buyerSignature = true;
                if (address) deal.buyerAddress = address;
            } else if (action === 'sign_seller') {
                deal.sellerSignature = true;
            } else if (action === 'reject') {
                deal.status = 'rejected';
            } else if (action === 'close') {
                deal.status = 'closed';
            } else if (action === 'fail_delivery') {
                deal.status = 'delivery_failed';
            }

            // Check for Agreement
            if (deal.buyerSignature && deal.sellerSignature && deal.status === 'draft') {
                deal.status = 'agreed';
                deal.agreedDate = new Date();
            }

            await deal.save();
            if (deal.roomId) {
                io.to(deal.roomId).emit('deal_updated', deal);
            }
            console.log(`[Deal] Updated ${dealId}: ${action} -> ${deal.status}`);
        } catch (err) {
            console.error("Error updating deal:", err);
        }
    });
    // -----------------------
    // --- AI-LED DEAL ROOM EVENTS ---

    socket.on('submit_offer', async (data) => {
        const { roomId, quantity, price, purpose, language } = data;
        console.log(`[OFFER_SUBMIT] Received from ${socket.id} for Room: ${roomId}`, data);

        let conversation = await Conversation.findOne({ roomId });
        if (!conversation) {
            console.error(`[OFFER_SUBMIT] ERROR: No conversation found for room ${roomId}`);
            return;
        }

        console.log(`📊 Processing Offer for ${roomId}: ${quantity}kg @ ₹${price}`);

        // 1. Silent Evaluation
        const commodity = conversation.commodity || 'Wheat';
        const marketPriceData = await priceEngine.getCurrentPrices(commodity, conversation.location?.mandiName || 'Delhi');

        const evaluation = await aiMediator.evaluateOffer({
            quantity,
            price,
            commodity,
            marketPrice: {
                min: marketPriceData.minPrice,
                max: marketPriceData.maxPrice,
                modal: marketPriceData.modalPrice
            },
            language: language || 'en'
        });

        // 2. Save Offer to DB
        (conversation as any).structuredOffer = {
            quantity,
            price,
            purpose,
            timestamp: new Date()
        };
        (conversation as any).negotiationPhase = 'seller_review';
        (conversation as any).aiInsight = evaluation.insight;
        (conversation as any).isOfferTooLow = evaluation.isTooLow;

        // Add buyer's offer as a message to chat
        conversation.messages.push({
            sender: 'buyer',
            senderName: 'Buyer',
            originalText: `📋 Initial Offer: ₹${price}/kg for ${quantity}kg${purpose ? ` (${purpose})` : ''}`,
            translatedText: `📋 Initial Offer: ₹${price}/kg for ${quantity}kg${purpose ? ` (${purpose})` : ''}`,
            // @ts-ignore
            messageType: 'text',
            spokenLanguage: 'en',
            timestamp: new Date(),
            metadata: {
                offerType: 'initial',
                quantity,
                price,
                purpose
            }
        } as any);

        // Add AI insight as a message if offer is too low
        if (evaluation.isTooLow && evaluation.insight) {
            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: evaluation.insight,
                translatedText: evaluation.insight,
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date()
            } as any);
        }

        await conversation.save();

        // 3. Emit Insight to Buyer if Too Low
        if (evaluation.isTooLow && evaluation.insight) {
            io.to(roomId).emit('ai_insight', { insight: evaluation.insight });
        }

        // 4. Notify All participants in room
        console.log(`[OFFER_SUBMIT] Emitting offer_submitted to room: ${roomId}`);
        io.to(roomId).emit('offer_submitted', {
            offer: (conversation as any).structuredOffer,
            isTooLow: evaluation.isTooLow,
            phase: 'seller_review'
        });
    });

    socket.on('seller_decision', async (data) => {
        const { roomId, decision, counterPrice } = data;
        let conversation = await Conversation.findOne({ roomId });
        if (!conversation) return;

        console.log(`⚖️ Seller Decision for ${roomId}: ${decision} ${counterPrice ? `(Counter: ₹${counterPrice})` : ''}`);

        if (decision === 'accept') {
            conversation.status = 'active';
            (conversation as any).negotiationPhase = 'chat';

            // Add acceptance message to chat
            const acceptMsg = `✅ Seller accepted your offer of ₹${(conversation as any).structuredOffer?.price}/kg for ${(conversation as any).structuredOffer?.quantity}kg.`;
            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: acceptMsg,
                translatedText: acceptMsg,
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date()
            } as any);

        } else if (decision === 'counter') {
            (conversation as any).negotiationPhase = 'buyer_counter_review';
            (conversation as any).counterOffer = { price: counterPrice };

            // Evaluate counter-offer with AI
            const commodity = conversation.commodity || 'Wheat';
            const marketPriceData = await priceEngine.getCurrentPrices(commodity, conversation.location?.mandiName || 'Delhi');

            const originalOffer = (conversation as any).structuredOffer;
            const counterEvaluation = await aiMediator.evaluateOffer({
                quantity: originalOffer?.quantity || 100,
                price: counterPrice,
                commodity,
                marketPrice: {
                    min: marketPriceData.minPrice,
                    max: marketPriceData.maxPrice,
                    modal: marketPriceData.modalPrice
                },
                language: conversation.buyerLanguage || 'en'
            });

            // Add counter-offer message to chat
            const counterMessage = `🔄 Seller counter-offered: ₹${counterPrice}/kg (Original: ₹${originalOffer?.price}/kg)`;
            conversation.messages.push({
                sender: 'vendor',
                senderName: 'Seller',
                originalText: counterMessage,
                translatedText: counterMessage,
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date(),
                metadata: {
                    counterPrice,
                    originalPrice: originalOffer?.price
                }
            } as any);

            // Add AI insight if exists
            if (counterEvaluation.insight) {
                conversation.messages.push({
                    sender: 'ai_mediator',
                    senderName: 'AI Mediator',
                    originalText: counterEvaluation.insight,
                    translatedText: counterEvaluation.insight,
                    // @ts-ignore
                    messageType: 'text',
                    spokenLanguage: 'en',
                    timestamp: new Date()
                } as any);
            }

            // Background Task: Update Negotiation Stability (NSS) on Counter-Offer
            if (counterPrice) {
                const parts = roomId.split('-');
                const vendorId = parts[1];
                if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
                    trustScoringService.updateNSSOnCounter(roomId, vendorId, counterPrice);
                }
            }

        } else if (decision === 'reject') {
            conversation.status = 'deal_failed';
            (conversation as any).closedAt = new Date();
            (conversation as any).closureReason = 'seller_rejected';

            // Add rejection message
            const rejectMsg = `❌ Seller rejected the offer of ₹${(conversation as any).structuredOffer?.price}/kg. This negotiation is closed.`;
            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: rejectMsg,
                translatedText: rejectMsg,
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date()
            } as any);

            io.to(roomId).emit('conversation_closed', {
                reason: 'deal_failed',
                message: '❌ Seller declined the offer. Conversation closed.'
            });
        }

        await conversation.save();

        // Emit decision update
        io.to(roomId).emit('decision_update', {
            decision,
            counterPrice,
            phase: (conversation as any).negotiationPhase,
            status: conversation.status
        });

        // Emit new messages to chat
        const recentMessages = conversation.messages.slice(-3);
        recentMessages.forEach((msg) => {
            io.to(roomId).emit('new_message', {
                id: (msg as any)._id || Date.now().toString(),
                sender: msg.sender,
                senderName: msg.senderName,
                originalText: msg.originalText,
                translatedText: msg.translatedText,
                timestamp: msg.timestamp,
                metadata: (msg as any).metadata
            });
        });
    });

    socket.on('end_negotiation', async (data) => {
        const { roomId, userId } = data;
        let conversation = await Conversation.findOne({ roomId });
        if (!conversation) return;

        console.log(`🚪 Manual End Negotiation for ${roomId} by ${userId}`);

        conversation.status = 'deal_failed';
        (conversation as any).closedAt = new Date();
        (conversation as any).closureReason = 'mutually_ended';
        (conversation as any).endedBy = userId;

        const endMsg = `🤝 This negotiation was ended manually. Conversation is now closed for audit.`;
        conversation.messages.push({
            sender: 'ai_mediator',
            senderName: 'AI Mediator',
            originalText: endMsg,
            translatedText: endMsg,
            // @ts-ignore
            messageType: 'text',
            spokenLanguage: 'en',
            timestamp: new Date()
        } as any);

        await conversation.save();

        io.to(roomId).emit('conversation_closed', {
            reason: 'mutually_ended',
            message: '🤝 Negotiation ended manually.'
        });

        io.to(roomId).emit('new_message', {
            id: Date.now().toString(),
            sender: 'ai_mediator',
            senderName: 'AI Mediator',
            originalText: endMsg,
            translatedText: endMsg,
            timestamp: new Date()
        });
    });

    socket.on('buyer_decision', async (data) => {
        const { roomId, decision } = data;
        let conversation = await Conversation.findOne({ roomId });
        if (!conversation) return;

        console.log(`💰 Buyer Decision for ${roomId}: ${decision}`);

        if (decision === 'accept') {
            conversation.status = 'active';
            (conversation as any).negotiationPhase = 'chat';

            const acceptMsg = `✅ Buyer accepted the counter-offer. Deal finalized! Free chat is now open.`;
            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: acceptMsg,
                translatedText: acceptMsg,
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date()
            } as any);
        } else if (decision === 'reject') {
            (conversation as any).negotiationPhase = 'chat';
            conversation.status = 'active';

            const rejectMsg = `🔄 Buyer rejected the counter-offer. Continuing with open negotiation.`;
            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: rejectMsg,
                translatedText: rejectMsg,
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date()
            } as any);
        }

        await conversation.save();

        // Emit decision update
        io.to(roomId).emit('decision_update', {
            decision,
            phase: (conversation as any).negotiationPhase,
            status: conversation.status
        });

        // Emit new messages to chat
        const recentMessages = conversation.messages.slice(-1);
        recentMessages.forEach((msg) => {
            io.to(roomId).emit('new_message', {
                id: (msg as any)._id || Date.now().toString(),
                sender: msg.sender,
                senderName: msg.senderName,
                originalText: msg.originalText,
                translatedText: msg.translatedText,
                timestamp: msg.timestamp
            });
        });
    });
    // -----------------------

    // Automatic Closure Check (STALE CONVERSATIONS)
    // Runs every hour
    setInterval(async () => {
        console.log('⏰ Running automatic closure check for stale conversations...');
        try {
            const now = new Date();
            const activeConversations = await Conversation.find({ status: 'active' });

            for (const conv of activeConversations) {
                const autoCloseHours = (conv as any).autoCloseHours || 24;
                const cutoffTime = new Date(Date.now() - autoCloseHours * 60 * 60 * 1000);

                if (conv.lastActivityAt < cutoffTime) {
                    console.log(`🔒 Auto-closing stale conversation: ${conv.roomId}`);
                    conv.status = 'abandoned';
                    (conv as any).closedAt = now;
                    (conv as any).closureReason = 'timeout_stale';
                    await conv.save();

                    io.to(conv.roomId).emit('conversation_closed', {
                        reason: 'abandoned',
                        message: '⏰ Conversation closed due to inactivity.'
                    });
                }
            }
        } catch (err) {
            console.error('Error in automatic closure job:', err);
        }
    }, 60 * 60 * 1000); // 1 hour

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
