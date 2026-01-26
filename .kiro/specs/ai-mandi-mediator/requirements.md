# Requirements Document

## Introduction

The DharmaVyāpaara is a voice-first, multilingual digital mediator for Indian agricultural markets that enables buyers to negotiate multiple items in a single session while building trust through AI intervention. The system focuses on real-time voice translation, trust-building communication, and future-oriented relationship advice to create lasting business partnerships between vendors and buyers. 

## Glossary

- **AI_Mediator**: The core AI system that facilitates negotiations between vendors and buyers
- **Fair_Deal_Mode**: A temporary negotiation session where vendor and buyer interact through AI mediation
- **Price_Truth_Engine**: AI component that provides real-time fair price ranges using government and crowd-sourced data
- **Cultural_Negotiation_Intelligence**: AI system that provides emotion-aware translation preserving cultural context and tone
- **Exploitation_Detector**: AI component that identifies unfair bargaining tactics and price manipulation
- **Mandi_Reputation_Passport**: Advanced trust scoring system that tracks vendor reliability using behavioral data
- **Vendor_Trust_Score**: Composite score (0-100) based on Price Honesty, Fulfillment Reliability, Negotiation Stability, and Language Reliability
- **Price_Honesty_Score (PHS)**: Component measuring how close vendor prices are to fair market rates (35% weight)
- **Fulfillment_Reliability_Score (FRS)**: Component tracking delivery performance and timeliness (30% weight)
- **Negotiation_Stability_Score (NSS)**: Component evaluating predictable behavior during negotiations (20% weight)
- **Language_Reliability_Score (LRS)**: Component measuring translation-related dispute frequency (15% weight)
- **Confidence_Indicator**: Shows reliability of trust score based on transaction history volume
- **Vendor**: Agricultural producer selling goods in the mandi (minimal tech literacy)
- **Buyer**: Purchaser of agricultural goods (higher tech comfort level)
- **Negotiation_Room**: Digital space where Fair Deal Mode sessions occur
- **Deal_Summary**: Language-neutral receipt generated after successful negotiations

## Requirements

### Requirement 1: Vendor Marketplace and Selection

**User Story:** As a buyer, I want to browse available vendors sorted by trust score and select the most reliable one for my needs, so that I can make informed decisions before starting negotiations.

#### Acceptance Criteria

1. WHEN a buyer opens the application, THE AI_Mediator SHALL display a list of available vendors sorted by Vendor Trust Score (highest first)
2. THE vendor list SHALL show for each vendor: Trust Score, Confidence Indicator, available commodities, current location, and brief reputation summary
3. WHEN a buyer selects a vendor, THE AI_Mediator SHALL display detailed trust score breakdown (PHS, FRS, NSS, LRS components)
4. WHEN a buyer confirms vendor selection, THE AI_Mediator SHALL initiate a multi-item negotiation session with the chosen vendor
5. THE AI_Mediator SHALL allow buyers to filter vendors by commodity type, location, and minimum trust score threshold

### Requirement 2: Multi-Item Session Management

**User Story:** As a buyer, I want to negotiate multiple items in a single session with my selected vendor, so that I can efficiently purchase everything I need in one conversation.

#### Acceptance Criteria

1. WHEN a buyer selects a vendor, THE AI_Mediator SHALL create a unique multi-item negotiation session
2. WHEN the vendor accepts the session request, THE AI_Mediator SHALL add both parties to the active Negotiation_Room
3. WHEN both parties are connected, THE AI_Mediator SHALL allow adding multiple commodities to the negotiation basket
4. WHEN items are added to the session, THE AI_Mediator SHALL provide real-time price data for each commodity
5. WHEN negotiations are complete, THE AI_Mediator SHALL generate a comprehensive deal summary for all items

### Requirement 3: Real-Time Price Transparency

**User Story:** As a market participant, I want access to current fair price information, so that I can make informed decisions during negotiations.

#### Acceptance Criteria

1. THE Price_Truth_Engine SHALL display current government mandi prices for the specific commodity and location
2. WHEN price data is requested, THE Price_Truth_Engine SHALL show fair price bands with minimum, maximum, and average values
3. WHEN crowd-reported prices are available, THE Price_Truth_Engine SHALL integrate them with government data using weighted algorithms
4. WHEN price data is older than 24 hours, THE Price_Truth_Engine SHALL flag it as potentially outdated
5. THE Price_Truth_Engine SHALL update price information every 30 minutes during active market hours

### Requirement 4: Voice-First Multilingual Communication

**User Story:** As a market participant, I want to speak in my native language and have the AI understand and translate everything in real-time, so that language barriers never prevent fair negotiations.

#### Acceptance Criteria

1. THE AI_Mediator SHALL accept voice input in Hindi, English, Tamil, Telugu, Marathi, Gujarati, Punjabi, Bengali, Kannada, and regional dialects
2. WHEN either party speaks, THE AI_Mediator SHALL provide real-time voice translation to the other party's preferred language
3. WHEN negotiations become tense, THE AI_Mediator SHALL intervene with calming voice prompts and trust-building suggestions
4. THE AI_Mediator SHALL detect emotional tone and adjust translation to maintain respectful communication
5. WHEN technical terms are used, THE AI_Mediator SHALL provide simple explanations in both languages

### Requirement 5: AI Trust Building and Negotiation Intervention

**User Story:** As a market participant, I want the AI to actively help build trust and guide negotiations, so that both parties feel confident and secure in the deal.

#### Acceptance Criteria

1. WHEN negotiations begin, THE AI_Mediator SHALL introduce both parties and highlight their positive reputation points
2. WHEN disagreements arise, THE AI_Mediator SHALL suggest compromise solutions and explain benefits to both parties
3. WHEN prices seem unfair, THE AI_Mediator SHALL provide market context and suggest fair alternatives
4. THE AI_Mediator SHALL share success stories and testimonials to build confidence during negotiations
5. WHEN deals are completed, THE AI_Mediator SHALL provide future market insights and relationship-building advice

### Requirement 6: Future-Oriented Feedback and Relationship Building

**User Story:** As a market participant, I want insights about future opportunities and relationship building, so that I can develop long-term business partnerships.

#### Acceptance Criteria

1. WHEN deals are completed, THE AI_Mediator SHALL provide personalized advice on future market opportunities
2. THE AI_Mediator SHALL suggest seasonal planning and crop recommendations based on successful negotiations
3. WHEN trust scores improve, THE AI_Mediator SHALL unlock access to premium buyers/vendors and better deals
4. THE AI_Mediator SHALL provide feedback on negotiation skills and suggest improvements for future deals
5. THE AI_Mediator SHALL connect successful trading partners for future collaboration opportunities

### Requirement 7: Deal Documentation and Receipts

**User Story:** As a market participant, I want a clear record of our negotiated agreement, so that both parties have proof of the deal terms.

#### Acceptance Criteria

1. WHEN a deal is agreed upon, THE AI_Mediator SHALL generate a Deal_Summary in both parties' languages
2. THE Deal_Summary SHALL include commodity type, quantity, agreed price, date, time, and session ID
3. WHEN the Deal_Summary is created, THE AI_Mediator SHALL send it to both parties via SMS and app notification
4. THE Deal_Summary SHALL use simple, clear language and visual symbols for key information
5. THE AI_Mediator SHALL store Deal_Summary data for 90 days for dispute resolution

### Requirement 8: Advanced Vendor Trust Scoring System

**User Story:** As a buyer, I want to see a comprehensive trust score for vendors based on their actual behavior, so that I can make informed decisions about who to trade with based on objective data rather than opinions.

#### Acceptance Criteria

1. THE Mandi_Reputation_Passport SHALL calculate a composite Vendor Trust Score (0-100) using four weighted components:
   - Price Honesty Score (35% weight): Measures how close vendor prices are to AI fair-price bands
   - Fulfillment Reliability Score (30% weight): Tracks delivery of promised quantities on time
   - Negotiation Stability Score (20% weight): Evaluates predictable behavior during negotiations
   - Language Reliability Score (15% weight): Measures disputes caused by translation issues

2. WHEN calculating Price Honesty Score, THE system SHALL:
   - Compare vendor_price to fair_price midpoint and calculate deviation percentage
   - Assign transaction_score = max(0, 1 - deviation)
   - Average scores over last N transactions to get PHS (0-1 range)
   - Penalize both extreme undercutting AND overpricing

3. WHEN calculating Fulfillment Reliability Score, THE system SHALL:
   - Track quantity_score = delivered_qty / promised_qty
   - Apply time_score = 1.0 for on-time delivery, 0.7 for late delivery
   - Calculate transaction_score = min(1, quantity_score) × time_score
   - Average all transaction scores to get FRS

4. WHEN calculating Negotiation Stability Score, THE system SHALL:
   - Monitor price volatility during negotiations (standard deviation / mean price)
   - Track abandoned deals and sudden unexplained price drops
   - Calculate NSS = max(0, 1 - price_volatility)
   - Reward consistent, predictable negotiation behavior

5. WHEN calculating Language Reliability Score, THE system SHALL:
   - Assign transaction_score = 0.5 if disputes occurred due to language/translation issues
   - Assign transaction_score = 1.0 for smooth multilingual transactions
   - Average scores to get LRS supporting the multilingual mandi theme

6. THE final Trust Score SHALL be calculated as:
   Trust Score = 100 × (0.35×PHS + 0.30×FRS + 0.20×NSS + 0.15×LRS)
   Rounded to nearest integer

7. THE system SHALL display a Confidence Indicator alongside the trust score:
   - Low confidence: <10 transactions
   - Medium confidence: 10-30 transactions  
   - High confidence: >30 transactions
   This prevents unfair penalization of new vendors

8. THE trust score display SHALL use clear visual indicators (colors, stars, progress bars) and be easily understood by users with minimal tech literacy

### Requirement 9: Location-Based Market Intelligence

**User Story:** As a vendor, I want pricing and market information specific to my location, so that negotiations reflect local market conditions.

#### Acceptance Criteria

1. WHEN the application starts, THE AI_Mediator SHALL detect the user's mandi location using GPS
2. THE Price_Truth_Engine SHALL prioritize pricing data from the same mandi and nearby markets
3. WHEN local data is insufficient, THE Price_Truth_Engine SHALL use regional data with appropriate disclaimers
4. THE AI_Mediator SHALL display market trends and seasonal patterns relevant to the current location
5. WHEN location services are unavailable, THE AI_Mediator SHALL allow manual mandi selection from a comprehensive list

### Requirement 10: Offline Capability and Data Sync

**User Story:** As a user in areas with poor connectivity, I want basic functionality to work offline, so that negotiations can continue despite network issues.

#### Acceptance Criteria

1. THE AI_Mediator SHALL cache recent price data for offline access during active sessions
2. WHEN connectivity is lost during a session, THE AI_Mediator SHALL continue with cached data and sync when reconnected
3. THE AI_Mediator SHALL store incomplete sessions locally and resume when connectivity returns
4. WHEN offline mode is active, THE AI_Mediator SHALL clearly indicate limited functionality to users
5. THE AI_Mediator SHALL prioritize essential features (translation, basic price info) during offline operation

### Requirement 11: Rapid Implementation Core Features

**User Story:** As a developer with limited time, I want to focus on the most essential features that demonstrate the AI mediation concept, so that a working prototype can be completed in 2 hours.

#### Acceptance Criteria

1. THE AI_Mediator SHALL prioritize voice input/output, real-time translation, and basic price display as core features
2. THE AI_Mediator SHALL use simple mock data for price information to avoid complex API integrations
3. THE AI_Mediator SHALL implement basic trust-building phrases and intervention prompts without complex AI models
4. THE AI_Mediator SHALL focus on single-session multi-item negotiations without persistent storage requirements
5. THE AI_Mediator SHALL demonstrate the concept with 2-3 supported languages (Hindi, English, Tamil) for rapid development

### Requirement 12: Security and Privacy Protection

**User Story:** As a market participant, I want my personal and business information protected, so that I can negotiate safely without privacy concerns.

#### Acceptance Criteria

1. THE AI_Mediator SHALL encrypt all communication between vendor and buyer during sessions
2. THE AI_Mediator SHALL not store personal identifying information beyond session requirements
3. WHEN sessions end, THE AI_Mediator SHALL purge temporary data while preserving anonymized deal statistics
4. THE AI_Mediator SHALL require explicit consent before sharing any deal information with third parties
5. THE AI_Mediator SHALL implement secure authentication without requiring complex passwords from vendors