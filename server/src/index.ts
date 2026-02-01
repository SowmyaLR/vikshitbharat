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

        // Ensure we query using ObjectId if the string is valid, otherwise use the string
        const queryId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        // Find associated Vendor records if this user is a seller
        const vendors = await Vendor.find({ userId: queryId });
        const vendorIds = vendors.map(v => v._id);

        const conversations = await Conversation.find({
            $or: [
                { 'buyer.id': queryId },
                { 'vendor.id': queryId }, // Direct match (if buyerId was used)
                { 'vendor.id': { $in: vendorIds } } // Match by Vendor documents
            ],
            $or: [
                { status: { $in: ['deal_success', 'deal_failed', 'abandoned'] } },
                { closureReason: { $exists: true } }
            ]
        })
            .sort({ closedAt: -1, updatedAt: -1 })
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
        const payloadData = typeof data === 'object' ? data : {};
        const buyerName = payloadData.buyerName || 'Buyer';
        const buyerLocation = payloadData.location || 'Azadpur Mandi';
        const commodityRaw = payloadData.commodity || 'Wheat';

        console.log(`[SOCKET] User ${socket.id} joining room: ${roomId}`);
        socket.join(roomId);
        console.log(`🔌 Socket ${socket.id} joined room: ${roomId} as ${buyerName}`);

        const parts = roomId.split('-');
        const vId = parts[1];
        const bId = parts[2];

        try {
            // Build the setOnInsert object dynamicially to include IDs if valid
            const setOnInsert: any = {
                roomId,
                commodity: commodityRaw,
                location: { mandiName: buyerLocation, state: 'Delhi' },
                status: 'deal_room',
                negotiationPhase: 'greeting'
            };

            if (vId && mongoose.Types.ObjectId.isValid(vId)) {
                setOnInsert.vendor = { id: vId };
            }
            if (bId && mongoose.Types.ObjectId.isValid(bId)) {
                setOnInsert.buyer = { id: bId, name: buyerName };
            } else {
                setOnInsert.buyer = { name: buyerName };
            }

            let conversation = await Conversation.findOneAndUpdate(
                { roomId },
                { $setOnInsert: setOnInsert },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            let needsUpdate = false;
            if (!conversation.commodity) {
                conversation.commodity = commodityRaw;
                needsUpdate = true;
            }

            if (typeof data === 'object') {
                if (vId && mongoose.Types.ObjectId.isValid(vId)) {
                    if (!conversation.vendor?.id) {
                        (conversation as any).vendor = { ...conversation.vendor, id: vId };
                        needsUpdate = true;
                    }
                }
                if (bId && mongoose.Types.ObjectId.isValid(bId)) {
                    if (!conversation.buyer?.id) {
                        (conversation as any).buyer = { ...conversation.buyer, id: bId };
                        needsUpdate = true;
                    }
                }

                if (!conversation.buyer?.name || conversation.buyer.name === 'Buyer') {
                    (conversation as any).buyer = { ...conversation.buyer, name: buyerName };
                    needsUpdate = true;
                }
                if (data.commodity && conversation.commodity === 'Wheat' && data.commodity !== 'Wheat') {
                    conversation.commodity = data.commodity;
                    needsUpdate = true;
                }

                if (data.language && data.role === 'buyer') {
                    if (conversation.buyerLanguage !== data.language) {
                        conversation.buyerLanguage = data.language;
                        needsUpdate = true;
                    }
                } else if (data.language && (data.role === 'seller' || data.role === 'vendor')) {
                    if (conversation.sellerLanguage !== data.language) {
                        conversation.sellerLanguage = data.language;
                        needsUpdate = true;
                    }
                }
            }

            if (needsUpdate) {
                console.log(`📝 [JOIN_ROOM] Updating details for ${roomId}: BuyerLang=${conversation.buyerLanguage}, SellerLang=${conversation.sellerLanguage}`);
                await conversation.save();
            }

            // TRIGGER GREETING IF IN GREETING PHASE
            if ((conversation as any).negotiationPhase === 'greeting') {
                console.log(`🤖 Triggering AI Greeting for room: ${roomId}`);
                const commodity = conversation.commodity || 'Wheat';
                const location = conversation.location?.mandiName || buyerLocation;
                const marketPriceData = await priceEngine.getCurrentPrices(commodity, location);

                conversation.marketData = {
                    minPrice: marketPriceData.minPrice,
                    maxPrice: marketPriceData.maxPrice,
                    modalPrice: marketPriceData.modalPrice,
                    priceDate: new Date()
                };

                const buyerLang = conversation.buyerLanguage || 'en';
                const sellerLang = conversation.sellerLanguage || 'en';

                const greeting = await aiMediator.generateGreeting({
                    commodity: commodity,
                    location: location,
                    marketPrice: {
                        min: marketPriceData.minPrice,
                        max: marketPriceData.maxPrice,
                        modal: marketPriceData.modalPrice
                    },
                    language: 'en' // English base
                });

                const greetingBuyer = await aiMediator.translate(greeting, 'en', buyerLang);
                const greetingSeller = await aiMediator.translate(greeting, 'en', sellerLang);

                (conversation as any).aiGreeting = greetingBuyer; // Store for buyer specifically
                (conversation as any).negotiationPhase = 'offer';

                // Also push to chat history so it's persistent and bidirectional
                conversation.messages.push({
                    sender: 'ai_mediator',
                    senderName: 'AI Mediator',
                    originalText: greeting,
                    translations: {
                        buyer: greetingBuyer,
                        seller: greetingSeller
                    },
                    messageType: 'text',
                    spokenLanguage: 'en',
                    timestamp: new Date()
                } as any);

                await conversation.save();

                socket.emit('ai_greeting', { text: greetingBuyer });
            }

            // UNIFIED ROOM SYNC
            const userRole = data.role || 'buyer';
            const userLang = data.language || (userRole === 'buyer' ? conversation.buyerLanguage : conversation.sellerLanguage) || 'en';

            let syncedGreeting = (conversation as any).aiGreeting;
            let syncedInsight = (conversation as any).aiInsight;

            if (syncedGreeting) {
                syncedGreeting = await aiMediator.translate(syncedGreeting, 'en', userLang);
            }
            if (syncedInsight) {
                syncedInsight = await aiMediator.translate(syncedInsight, 'en', userLang);
            }

            socket.emit('room_sync', {
                phase: (conversation as any).negotiationPhase,
                aiGreeting: syncedGreeting,
                aiInsight: syncedInsight,
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
                    translations: (msg as any).translations || {
                        buyer: msg.sender === 'vendor' ? msg.translatedText : msg.originalText,
                        seller: msg.sender === 'buyer' ? msg.translatedText : msg.originalText
                    },
                    timestamp: msg.timestamp,
                    messageType: (msg as any).messageType || 'text',
                    audioUrl: (msg as any).audioUrl
                }));
                socket.emit('chat_history', history);
            }

            // Notification logic
            const rawVendorId = roomId.replace('room-', '');
            const vendorId = rawVendorId.split('-')[0];
            const payload = {
                roomId,
                buyerName: buyerName,
                item: conversation?.commodity || 'Wheat',
                location: buyerLocation,
                timestamp: new Date()
            };

            if (!vendorId.match(/^[0-9a-fA-F]{24}$/)) {
                io.to(`seller-${vendorId}`).emit('new_negotiation_request', payload);
            } else {
                const vendor = await Vendor.findById(vendorId);
                if (vendor) {
                    const ownerRoom = vendor.userId ? `seller-${vendor.userId.toString()}` : null;
                    const publicRoom = `seller-${vendorId}`;
                    if (ownerRoom) io.to(ownerRoom).emit('new_negotiation_request', payload);
                    io.to(publicRoom).emit('new_negotiation_request', payload);
                }
            }
        } catch (err) {
            console.error('Error handling join_room:', err);
        }
    });

    socket.on('join_seller_room', (sellerId: string) => {
        socket.join(`seller-${sellerId}`);
    });

    // Unified Message Handler
    socket.on('update_preference', async (data) => {
        try {
            const role = data.role === 'buyer' ? 'buyer' : 'seller';
            const newLang = data.language;

            const conversation = await Conversation.findOne({ roomId: data.roomId });
            if (!conversation) return;

            // Update preference
            if (role === 'buyer') {
                conversation.buyerLanguage = newLang;
            } else {
                conversation.sellerLanguage = newLang;
            }

            console.log(`🗣️ Updated ${role} language to ${newLang} for room ${data.roomId}. Starting history re-translation...`);

            // Re-translate history for the updated role
            for (let i = 0; i < conversation.messages.length; i++) {
                const msg = conversation.messages[i];
                if (!msg.translations) msg.translations = { buyer: '', seller: '' };

                // Only translate if not already in that language or if translation is missing
                const currentTranslation = role === 'buyer' ? msg.translations.buyer : msg.translations.seller;

                if (!currentTranslation || currentTranslation === msg.originalText) {
                    const translated = await aiMediator.translate(msg.originalText, msg.spokenLanguage || 'en', newLang);
                    if (role === 'buyer') {
                        msg.translations.buyer = translated;
                    } else {
                        msg.translations.seller = translated;
                    }
                }
            }

            await conversation.save();

            // Emit updated history to the user who changed their preference
            const updatedHistory = conversation.messages.map(msg => ({
                id: (msg as any)._id || Date.now().toString(),
                sender: msg.sender,
                senderName: msg.senderName,
                originalText: msg.originalText,
                translations: (msg as any).translations,
                timestamp: msg.timestamp,
                messageType: (msg as any).messageType || 'text',
                audioUrl: (msg as any).audioUrl
            }));

            socket.emit('chat_history', updatedHistory);
            console.log(`✅ History re-translated and sent for ${role} in ${newLang}`);

        } catch (err) {
            console.error('Error updating language preference and re-translating:', err);
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

        // Determine translations for both parties
        const buyerLang = conversation.buyerLanguage || 'en';
        const sellerLang = conversation.sellerLanguage || 'en';

        const translatedForBuyer = await aiMediator.translate(data.text, data.language, buyerLang);
        const translatedForSeller = await aiMediator.translate(data.text, data.language, sellerLang);

        // 3. Save to DB
        conversation.messages.push({
            sender: data.sender,
            senderName: data.senderName || (data.sender === 'buyer' ? 'Buyer' : 'Seller'),
            // @ts-ignore
            messageType: data.audioUrl ? 'audio' : 'text',
            audioUrl: data.audioUrl,
            originalText: data.text,
            translatedText: data.sender === 'buyer' ? translatedForSeller : translatedForBuyer, // Legacy support
            translations: {
                buyer: translatedForBuyer,
                seller: translatedForSeller
            },
            spokenLanguage: data.language,
            timestamp: new Date()
        } as any);
        conversation.lastActivityAt = new Date();

        await conversation.save();

        // 4. Emit to Room
        io.to(data.roomId).emit('new_message', {
            id: Date.now().toString(),
            sender: data.sender,
            senderName: data.senderName,
            originalText: data.text,
            translatedText: data.sender === 'buyer' ? translatedForSeller : translatedForBuyer, // Legacy
            translations: {
                buyer: translatedForBuyer,
                seller: translatedForSeller
            },
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
            translatedMessage: data.sender === 'buyer' ? translatedForSeller : translatedForBuyer,
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

            // Translate AI Message for both roles
            const aiTranslatedBuyer = await aiMediator.translate(negotiationResult.aiMessage, 'en', buyerLang);
            const aiTranslatedSeller = await aiMediator.translate(negotiationResult.aiMessage, 'en', sellerLang);

            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: negotiationResult.aiMessage,
                translations: {
                    buyer: aiTranslatedBuyer,
                    seller: aiTranslatedSeller
                },
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
                    translations: {
                        buyer: aiTranslatedBuyer,
                        seller: aiTranslatedSeller
                    },
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
                    conversationId: conversation._id.toString(),
                    reason: 'deal_success',
                    message: '✅ Deal finalized! This conversation is now closed.',
                    dealId: newDeal._id.toString()
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
            language: 'en' // Generate in English first for bidirectional translation
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

        const buyerLang = conversation.buyerLanguage || 'en';
        const sellerLang = conversation.sellerLanguage || 'en';

        // Translate the initial offer status message
        const initialOfferText = `📋 Initial Offer: ₹${price}/kg for ${quantity}kg${purpose ? ` (${purpose})` : ''}`;
        const initialOfferBuyer = await aiMediator.translate(initialOfferText, 'en', buyerLang);
        const initialOfferSeller = await aiMediator.translate(initialOfferText, 'en', sellerLang);

        // Add buyer's offer as a message to chat
        conversation.messages.push({
            sender: 'buyer',
            senderName: 'Buyer',
            originalText: initialOfferText,
            translations: {
                buyer: initialOfferBuyer,
                seller: initialOfferSeller
            },
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
            const insightBuyer = await aiMediator.translate(evaluation.insight, 'en', buyerLang);
            const insightSeller = await aiMediator.translate(evaluation.insight, 'en', sellerLang);

            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: evaluation.insight,
                translations: {
                    buyer: insightBuyer,
                    seller: insightSeller
                },
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date()
            } as any);
        }

        await conversation.save();

        // 3. Emit Insight to Participants
        if (evaluation.isTooLow && evaluation.insight) {
            const insightBuyer = await aiMediator.translate(evaluation.insight, 'en', buyerLang);
            const insightSeller = await aiMediator.translate(evaluation.insight, 'en', sellerLang);

            // Emit role-specific insights (legacy support for simple ai_insight event)
            socket.emit('ai_insight', { insight: insightBuyer });
            // The seller-side logic usually displays the ai_insight message from the chat list now.
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
            const buyerLang = conversation.buyerLanguage || 'en';
            const sellerLang = conversation.sellerLanguage || 'en';
            const acceptBuyer = await aiMediator.translate(acceptMsg, 'en', buyerLang);
            const acceptSeller = await aiMediator.translate(acceptMsg, 'en', sellerLang);

            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: acceptMsg,
                translations: {
                    buyer: acceptBuyer,
                    seller: acceptSeller
                },
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
                language: 'en' // Generate in neutral English first
            });

            // Add counter-offer message to chat
            const counterMessage = `🔄 Seller counter-offered: ₹${counterPrice}/kg (Original: ₹${originalOffer?.price}/kg)`;
            const buyerLang = conversation.buyerLanguage || 'en';
            const sellerLang = conversation.sellerLanguage || 'en';
            const counterBuyer = await aiMediator.translate(counterMessage, 'en', buyerLang);
            const counterSeller = await aiMediator.translate(counterMessage, 'en', sellerLang);

            conversation.messages.push({
                sender: 'vendor',
                senderName: 'Seller',
                originalText: counterMessage,
                translations: {
                    buyer: counterBuyer,
                    seller: counterSeller
                },
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
                const insightBuyer = await aiMediator.translate(counterEvaluation.insight, 'en', buyerLang);
                const insightSeller = await aiMediator.translate(counterEvaluation.insight, 'en', sellerLang);

                conversation.messages.push({
                    sender: 'ai_mediator',
                    senderName: 'AI Mediator',
                    originalText: counterEvaluation.insight,
                    translations: {
                        buyer: insightBuyer,
                        seller: insightSeller
                    },
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
            const buyerLang = conversation.buyerLanguage || 'en';
            const sellerLang = conversation.sellerLanguage || 'en';
            const rejectBuyer = await aiMediator.translate(rejectMsg, 'en', buyerLang);
            const rejectSeller = await aiMediator.translate(rejectMsg, 'en', sellerLang);

            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: rejectMsg,
                translations: {
                    buyer: rejectBuyer,
                    seller: rejectSeller
                },
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date()
            } as any);

            io.to(roomId).emit('conversation_closed', {
                conversationId: conversation._id.toString(),
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
            const m = msg as any;
            io.to(roomId).emit('new_message', {
                id: m._id || Date.now().toString(),
                sender: m.sender,
                senderName: m.senderName,
                originalText: m.originalText,
                translations: m.translations,
                timestamp: m.timestamp,
                messageType: m.messageType || 'text',
                audioUrl: m.audioUrl,
                metadata: m.metadata
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
        const buyerLang = conversation.buyerLanguage || 'en';
        const sellerLang = conversation.sellerLanguage || 'en';
        const endBuyer = await aiMediator.translate(endMsg, 'en', buyerLang);
        const endSeller = await aiMediator.translate(endMsg, 'en', sellerLang);

        conversation.messages.push({
            sender: 'ai_mediator',
            senderName: 'AI Mediator',
            originalText: endMsg,
            translations: {
                buyer: endBuyer,
                seller: endSeller
            },
            // @ts-ignore
            messageType: 'text',
            spokenLanguage: 'en',
            timestamp: new Date()
        } as any);

        await conversation.save();

        io.to(roomId).emit('conversation_closed', {
            conversationId: conversation._id.toString(),
            reason: 'mutually_ended',
            message: '🤝 Negotiation ended manually.'
        });

        io.to(roomId).emit('new_message', {
            id: Date.now().toString(),
            sender: 'ai_mediator',
            senderName: 'AI Mediator',
            originalText: endMsg,
            translations: {
                buyer: endBuyer,
                seller: endSeller
            },
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
            const buyerLang = conversation.buyerLanguage || 'en';
            const sellerLang = conversation.sellerLanguage || 'en';
            const acceptBuyer = await aiMediator.translate(acceptMsg, 'en', buyerLang);
            const acceptSeller = await aiMediator.translate(acceptMsg, 'en', sellerLang);

            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: acceptMsg,
                translations: {
                    buyer: acceptBuyer,
                    seller: acceptSeller
                },
                // @ts-ignore
                messageType: 'text',
                spokenLanguage: 'en',
                timestamp: new Date()
            } as any);
        } else if (decision === 'reject') {
            (conversation as any).negotiationPhase = 'chat';
            conversation.status = 'active';

            const rejectMsg = `🔄 Buyer rejected the counter-offer. Continuing with open negotiation.`;
            const buyerLang = conversation.buyerLanguage || 'en';
            const sellerLang = conversation.sellerLanguage || 'en';
            const rejectBuyer = await aiMediator.translate(rejectMsg, 'en', buyerLang);
            const rejectSeller = await aiMediator.translate(rejectMsg, 'en', sellerLang);

            conversation.messages.push({
                sender: 'ai_mediator',
                senderName: 'AI Mediator',
                originalText: rejectMsg,
                translations: {
                    buyer: rejectBuyer,
                    seller: rejectSeller
                },
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
                translations: (msg as any).translations,
                timestamp: msg.timestamp,
                messageType: (msg as any).messageType || 'text',
                audioUrl: (msg as any).audioUrl
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
