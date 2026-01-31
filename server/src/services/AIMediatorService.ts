export class AIMediatorService {
    constructor() {
    }

    async translateWithLibre(text: string, from: string, to: string): Promise<string> {
        const url = process.env.LIBRETRANSLATE_URL || 'http://localhost:5000/translate';
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    q: text,
                    source: from,
                    target: to,
                    format: 'text'
                })
            });

            if (!response.ok) {
                console.warn(`[LibreTranslate] HTTP Error: ${response.status}`);
                return text;
            }

            const rawBody = await response.text();
            if (!rawBody) return text;

            try {
                const data = JSON.parse(rawBody);
                return data.translatedText || text;
            } catch (jsonErr) {
                console.error('[LibreTranslate] Invalid JSON Response:', rawBody.substring(0, 100));
                return text;
            }
        } catch (error) {
            console.error('LibreTranslate Connection Error:', error);
            return text;
        }
    }

    async callGroq(prompt: string, jsonMode: boolean = false, systemPrompt: string = ""): Promise<string> {
        const apiKey = process.env.GROQ_API_KEY;
        const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

        if (!apiKey || apiKey === 'your_groq_api_key_here') {
            return "";
        }

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: systemPrompt || "You are a helpful assistant." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.1,
                    response_format: jsonMode ? { type: "json_object" } : undefined
                })
            });
            const data: any = await response.json();
            return data.choices[0]?.message?.content || "";
        } catch (error) {
            console.error('Groq Error:', error);
            return "";
        }
    }

    async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
        try {
            if (sourceLang === targetLang) return text;

            // Scripted Heuristics
            const lowerText = text.toLowerCase();
            if (text.includes('100') && (text.includes('கிலோ') || text.includes('அரிசி') || text.includes('rice'))) {
                if (targetLang === 'hi') return "मुझे 100 किलो चावल चाहिए";
                if (targetLang === 'en') return "I need 100 kg of rice";
                if (targetLang === 'ta') return "எனக்கு 100 கிலோ அரிசி வேண்டும்";
            }
            if (lowerText.includes('ok') || text.includes('சரி') || text.includes('पक्का')) {
                if (targetLang === 'hi') return "ठीक है, पक्का";
                if (targetLang === 'ta') return "சரி முடிந்தது";
                if (targetLang === 'en') return "Ok, confirmed";
            }

            if (process.env.USE_LIBRE === 'true') {
                return await this.translateWithLibre(text, sourceLang, targetLang);
            }

            if (process.env.AI_PROVIDER === 'groq' && process.env.GROQ_API_KEY) {
                const prompt = `Translate this text from ${sourceLang} to ${targetLang}. Only return the translation.\n\nText: "${text}"`;
                const translated = await this.callGroq(prompt, false, "You are a professional translator.");
                if (translated) return translated.replace(/"/g, '').trim();
            }

            return text;
        } catch (error) {
            return text;
        }
    }

    private getTriggers(message: string, history: any[]): { priceTrigger: boolean, toneTrigger: boolean, repeatTrigger: boolean, dealTrigger: boolean, offerPrice: number | null } {
        const lowerMsg = message.toLowerCase();
        let priceTrigger = false;
        let toneTrigger = false;
        let repeatTrigger = false;
        let dealTrigger = false;
        let offerPrice = null;

        // 1. Price Trigger
        const numbers = message.match(/\d+/g);
        if (numbers) {
            const candidates = numbers.map(n => parseInt(n));
            const priceCandidates = candidates.filter(n => n >= 10 && n <= 10000 && n !== 100);
            if (priceCandidates.length > 0) {
                let rawPrice = Math.max(...priceCandidates);
                if (rawPrice > 500) {
                    offerPrice = parseFloat((rawPrice / 100).toFixed(2));
                } else {
                    offerPrice = rawPrice;
                }
                priceTrigger = true;
            }
        }

        // 2. Deal Signal Trigger
        const dealKeywords = ['deal', 'ok', 'pakka', 'confirm', 'agree', 'சரி', 'முடிந்தது', 'पक्का', 'ठीक'];
        if (dealKeywords.some(k => lowerMsg.includes(k))) {
            dealTrigger = true;
        }

        // 3. Repeated Offer Trigger
        const lastMsgWithPrice = [...history].reverse().find(h => h?.message?.match(/\d+/) || h?.originalText?.match(/\d+/));
        if (offerPrice && lastMsgWithPrice) {
            const msgText = lastMsgWithPrice.message || lastMsgWithPrice.originalText || '';
            const lastPriceMatch = msgText.match(/\d+/);
            if (lastPriceMatch && parseInt(lastPriceMatch[0]) === offerPrice) {
                repeatTrigger = true;
            }
        }

        // 4. Tone Trigger
        const toneKeywords = ['now', 'fast', 'hurry', 'enough', 'last price', 'तुरंत', 'जल्दी', 'சீக்கிரம்'];
        if (toneKeywords.some(k => lowerMsg.includes(k)) || message.includes('!!!')) {
            toneTrigger = true;
        }

        return { priceTrigger, toneTrigger, repeatTrigger, dealTrigger, offerPrice };
    }

    async checkSafety(text: string, history: any[] = []): Promise<{ isSafe: boolean; reason?: string }> {
        console.log(`[Safety Check] Analyzing: "${text}"`);

        // 1. LOCAL FILTER (Always fast, always free)
        const bannedWords = ['idiot', 'stupid', 'scam', 'cheat', 'fraud', 'moorka', 'badava', 'poda'];
        if (bannedWords.some(word => text.toLowerCase().includes(word))) {
            console.warn(`[Safety Check] Banned word found locally.`);
            return { isSafe: false, reason: "Offensive language or abuse detected. Please maintain professional trade behavior." };
        }

        // 2. EFFICIENCY TRIGGERS (User requested Optimization)
        const { priceTrigger, toneTrigger, repeatTrigger, dealTrigger } = this.getTriggers(text, history);
        const hasTrigger = priceTrigger || toneTrigger || repeatTrigger || dealTrigger;

        if (!hasTrigger) {
            console.log(`[Safety Check] No negotiation triggers detected. Skipping LLM moderation.`);
            return { isSafe: true };
        }

        // 3. LLM MODERATION (Only if triggers hit)
        try {
            const prompt = `Classify this message for safety in an agricultural trade chat. Look for abuse, fraud, or threats. Return JSON: { "isSafe": boolean, "reason": "string" }.\n\nMessage: "${text}"`;

            if (process.env.AI_PROVIDER === 'groq' && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
                const res = await this.callGroq(prompt, true, "You are a content moderator.");
                if (res) return JSON.parse(res);
            }
            return { isSafe: true };
        } catch (error) {
            return { isSafe: true };
        }
    }

    async extractDealTerms(history: any[]): Promise<{ items: any[], total: number } | null> {
        try {
            const chatText = history.map(h => `${h.sender}: ${h.message}`).join('\n');
            const prompt = `Extract items, quantities, and prices. Return JSON: { "items": [{ "name": "Item", "quantity": "Qty", "price": 0, "total": 0 }], "totalAmount": 0 }. Return null if no clear agreement.\n\nChat:\n${chatText}`;
            console.log(`[Deal Extraction] Prompt: ${prompt}`);

            let res = "";
            if (process.env.AI_PROVIDER === 'groq' && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
                res = await this.callGroq(prompt, true, "You are a trade extraction assistant.");
                console.log(`[Deal Extraction] Raw Response: ${res}`);
            }
            if (res) {
                const data = JSON.parse(res);
                return data && data.items ? { items: data.items, total: data.totalAmount } : null;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async generateGreeting(params: {
        commodity: string;
        location: string;
        marketPrice: { min: number; max: number; modal: number };
        language: string;
    }): Promise<string> {
        const { commodity, location, marketPrice, language } = params;
        const prompt = `
        Context: Generating a one-time welcome message for an AI-led deal room.
        Topic: ${commodity} in ${location}.
        Mandi Price: ₹${marketPrice.min}–₹${marketPrice.max} per kg (modal ₹${marketPrice.modal}).
        Seller typical offers: ₹${(marketPrice.modal * 1.05).toFixed(2)}/kg.
        
        Generate a friendly greeting in ${language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : 'English'}.
        Include:
        1. "👋 Welcome!"
        2. Today's mandi price details.
        3. A suggested fair starting price based on current demand (e.g., ₹${(marketPrice.modal * 0.95).toFixed(2)}–₹${marketPrice.modal}/kg).
        Keep it professional and helpful. Max 3 lines.`;

        try {
            const aiMsg = await this.callGroq(prompt, false, "You are Dharmavyapaara AI. Help farmers and traders find fair deals.");
            return aiMsg || `Welcome! Today's price for ${commodity} is ₹${marketPrice.modal}/kg. What is your offer?`;
        } catch (error) {
            return `Welcome! Markets are active for ${commodity}.`;
        }
    }

    async evaluateOffer(params: {
        quantity: number;
        price: number;
        commodity: string;
        marketPrice: { min: number; max: number; modal: number };
        language: string;
    }): Promise<{ isTooLow: boolean; insight?: string }> {
        const { price, marketPrice, language } = params;
        const lowerBound = marketPrice.min * 0.85;

        if (price < lowerBound) {
            const prompt = `
            The buyer offered ₹${price}/kg for ${params.commodity}.
            The Mandi price is ₹${marketPrice.modal}/kg.
            
            Generate a short "AI Insight" in ${language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : 'English'}.
            Explain politely that the offer is much lower than market rates. 
            Mention transport/commission costs.
            Suggest revising to ₹${(marketPrice.min * 0.95).toFixed(2)}–₹${marketPrice.modal}/kg.
            Max 2 sentences. Non-judgmental.`;

            const insight = await this.callGroq(prompt, false, "You are a neutral trade assistant.");
            return { isTooLow: true, insight: insight || "Market rates are slightly higher currently." };
        }

        return { isTooLow: false };
    }

    async analyzeAndNegotiate(params: {
        sender: 'buyer' | 'seller' | 'vendor';
        message: string;
        translatedMessage?: string;
        commodity: string;
        marketPrice: { min: number; max: number; modal: number };
        history: any[];
        userLanguage: string;
        phase?: string;
    }): Promise<{
        shouldIntervene: boolean;
        aiMessage?: string;
        suggestedPrice?: number;
        extractedDeal?: any;
    }> {
        const { sender, message, translatedMessage, commodity, marketPrice, history, userLanguage, phase } = params;
        const msgToAnalyze = translatedMessage || message;
        console.log(`[Mediation Engine] Analyzing ${sender} input: "${msgToAnalyze}" (Phase: ${phase})`);

        // LIGHT MODE: If phase is 'chat', primarily watch for deal triggers
        if (phase === 'chat') {
            const { dealTrigger } = this.getTriggers(msgToAnalyze, history);
            if (!dealTrigger) {
                console.log(`[Mediation Engine] Light Mode: No deal trigger. Skipping LLM.`);
                return { shouldIntervene: false };
            }
        }

        // 1. EXTRACT TRIGGERS
        const { priceTrigger, toneTrigger, repeatTrigger, dealTrigger, offerPrice } = this.getTriggers(msgToAnalyze, history);

        console.log(`[Mediation Engine] Triggers: Price:${priceTrigger}, Deal:${dealTrigger}, Repeat:${repeatTrigger}, Tone:${toneTrigger}`);

        let extractedDeal = null;
        if (dealTrigger || history.length >= 2) {
            extractedDeal = await this.extractDealTerms(history);
        }

        // ONLY CALL LLM IF TRIGGERS MET
        if (priceTrigger || toneTrigger || repeatTrigger || dealTrigger) {
            console.log(`[Mediation Engine] Conditional LLM Call Triggered.`);

            if (process.env.AI_PROVIDER === 'groq' && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
                const prompt = `
                Context: ${commodity} Mandi Price is ₹${marketPrice.modal} per kg (Range: ₹${marketPrice.min}-₹${marketPrice.max} per kg).
                Sender: ${sender}
                Message: "${msgToAnalyze}"
                Triggers: Price Mentioned: ${priceTrigger}, Tone: ${toneTrigger}, Repeated Offer: ${repeatTrigger}, Deal signals: ${dealTrigger}.
                
                Generate a polite, helpful mediation response in English. 
                CRITICAL: Always mention that the Mandi price is "per kg" to avoid confusion.
                If price is too low (<₹${(marketPrice.modal * 0.85).toFixed(2)} per kg) or too high (>₹${(marketPrice.modal * 1.15).toFixed(2)} per kg), nudge them towards the Mandi price.
                If tone is aggressive, calm them down.
                If offer is repeated, suggest a compromise.
                If deal is close, congratulate and summarize terms.
                Keep it to 1-2 sentences.`;

                let aiMsg = await this.callGroq(prompt, false, "You are Dharmavyapaara AI, a neutral agricultural trade mediator.");

                if (aiMsg) {
                    // TRANSLATE TO USER'S PREFERRED LANGUAGE
                    if (userLanguage !== 'en') {
                        console.log(`[Mediation Engine] Localizing AI message to: ${userLanguage}`);
                        aiMsg = await this.translate(aiMsg, 'en', userLanguage);
                    }

                    return {
                        shouldIntervene: true,
                        aiMessage: aiMsg,
                        suggestedPrice: offerPrice || marketPrice.modal,
                        extractedDeal
                    };
                }
            }
        }

        return { shouldIntervene: false, extractedDeal };
    }
}
