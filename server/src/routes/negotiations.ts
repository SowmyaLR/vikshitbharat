import express from 'express';
import { Negotiation } from '../models/Negotiation';

const router = express.Router();

// Get all negotiations for a user (buyer or vendor)
router.get('/user/:userId/negotiations', async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.query; // 'buyer' or 'vendor'

        const query = role === 'buyer'
            ? { 'buyer.id': userId }
            : { 'vendor.id': userId };

        const negotiations = await Negotiation.find(query)
            .sort({ lastActivityAt: -1 })
            .limit(50);

        res.json(negotiations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch negotiations' });
    }
});

// Get a specific negotiation by roomId
router.get('/negotiation/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const negotiation = await Negotiation.findOne({ roomId });

        if (!negotiation) {
            return res.status(404).json({ error: 'Negotiation not found' });
        }

        res.json(negotiation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch negotiation' });
    }
});

// Create a new negotiation session
router.post('/negotiation', async (req, res) => {
    try {
        const negotiation = new Negotiation(req.body);
        await negotiation.save();
        res.status(201).json(negotiation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create negotiation' });
    }
});

// Add a message to a negotiation
router.post('/negotiation/:roomId/message', async (req, res) => {
    try {
        const { roomId } = req.params;
        const negotiation = await Negotiation.findOne({ roomId });

        if (!negotiation) {
            return res.status(404).json({ error: 'Negotiation not found' });
        }

        await negotiation.addMessage(req.body);
        res.json(negotiation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add message' });
    }
});

// Update deal status
router.patch('/negotiation/:roomId/status', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { status, dealData } = req.body;

        const negotiation = await Negotiation.findOne({ roomId });

        if (!negotiation) {
            return res.status(404).json({ error: 'Negotiation not found' });
        }

        await negotiation.updateDealStatus(status, dealData);
        res.json(negotiation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Get negotiation analytics
router.get('/analytics/negotiations', async (req, res) => {
    try {
        const { commodity, location, startDate, endDate } = req.query;

        const query: any = {};
        if (commodity) query.commodity = commodity;
        if (location) query['location.mandiName'] = location;
        if (startDate || endDate) {
            query.startedAt = {};
            if (startDate) query.startedAt.$gte = new Date(startDate as string);
            if (endDate) query.startedAt.$lte = new Date(endDate as string);
        }

        const negotiations = await Negotiation.find(query);

        // Calculate analytics
        const analytics = {
            total: negotiations.length,
            completed: negotiations.filter(n => n.status === 'deal_reached').length,
            active: negotiations.filter(n => n.status === 'active').length,
            rejected: negotiations.filter(n => n.status === 'rejected').length,
            averageMessages: negotiations.reduce((sum, n) => sum + n.messages.length, 0) / negotiations.length,
            averagePrice: negotiations
                .filter(n => n.finalDeal?.agreedPrice)
                .reduce((sum, n) => sum + (n.finalDeal?.agreedPrice || 0), 0) /
                negotiations.filter(n => n.finalDeal?.agreedPrice).length
        };

        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

export default router;
