# DharmaVyāpaara - Solution Architecture

## High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer - Progressive Web App"
        BuyerApp[Buyer Interface<br/>Vendor Marketplace + Voice]
        VendorApp[Vendor Interface<br/>Voice-First PWA]
    end
    
    subgraph "API Gateway & Load Balancer"
        Gateway[API Gateway<br/>Rate Limiting & Authentication]
    end
    
    subgraph "Core Application Services"
        VendorService[Vendor Marketplace Service<br/>Trust-Based Discovery & Filtering]
        SessionService[Session Manager<br/>Multi-Item Negotiations]
        MediatorService[AI Mediator Service<br/>Voice Translation & Trust Building]
        TrustService[Trust Scoring Engine<br/>4-Component Behavioral Scoring]
        PriceService[Price Truth Engine<br/>Market Data Processing]
    end
    
    subgraph "External AI Services"
        Groq[Groq API<br/>Llama-3.1-8b-instant<br/>Negotiation Analysis]
        LibreTranslate[LibreTranslate<br/>Self-Hosted Translation<br/>9+ Indian Languages]
    end
    
    subgraph "External Data Sources"
        AGMARKNET[AGMARKNET API<br/>Government Mandi Prices]
        SMS[SMS Gateway<br/>Deal Notifications]
    end
    
    subgraph "Data Persistence Layer"
        Redis[(Redis Cache<br/>Session State & Real-time Data)]
        MongoDB[(MongoDB<br/>Chat Logs & AI Metadata)]
        PostgreSQL[(PostgreSQL<br/>User Profiles & Trust Scores)]
        S3[(S3 Storage<br/>Voice Recordings)]
    end
    
    BuyerApp --> Gateway
    VendorApp --> Gateway
    
    Gateway --> VendorService
    Gateway --> SessionService
    Gateway --> MediatorService
    Gateway --> TrustService
    Gateway --> PriceService
    
    VendorService --> TrustService
    SessionService --> Redis
    SessionService --> MongoDB
    
    MediatorService --> Groq
    MediatorService --> LibreTranslate
    MediatorService --> S3
    
    PriceService --> AGMARKNET
    PriceService --> Redis
    
    TrustService --> PostgreSQL
    TrustService --> MongoDB
    
    SessionService -.WebRTC Voice.-> BuyerApp
    SessionService -.WebRTC Voice.-> VendorApp
    
    MediatorService --> SMS
```

## AI Mediation Flow

```mermaid
sequenceDiagram
    participant Buyer
    participant System
    participant AI Mediator
    participant Groq LLM
    participant LibreTranslate
    participant Vendor
    
    Buyer->>System: Voice Message (Hindi)
    System->>System: Speech-to-Text
    System->>LibreTranslate: Translate Hindi → English
    LibreTranslate-->>System: Translated Text
    
    System->>AI Mediator: Analyze Message + History
    AI Mediator->>AI Mediator: Check Triggers<br/>(Price/Tone/Deal/Repeat)
    
    alt Trigger Detected
        AI Mediator->>Groq LLM: Analyze Negotiation Context
        Groq LLM-->>AI Mediator: Mediation Response
        AI Mediator->>LibreTranslate: Translate to Tamil (Vendor)
        LibreTranslate-->>AI Mediator: Localized Response
        AI Mediator->>Vendor: AI Intervention + Translated Message
    else No Trigger
        AI Mediator->>Vendor: Direct Translation Only
    end
    
    Vendor->>System: Voice Response (Tamil)
    System->>LibreTranslate: Translate Tamil → Hindi
    LibreTranslate-->>System: Translated Response
    System->>Buyer: Translated Message
```

## Trust Scoring Architecture

```mermaid
graph LR
    subgraph "Transaction Data Collection"
        Deal[Completed Deal]
        Price[Price Deviation]
        Delivery[Delivery Performance]
        Negotiation[Negotiation Volatility]
        Language[Translation Disputes]
    end
    
    subgraph "Component Calculators"
        PHS[Price Honesty Score<br/>35% Weight]
        FRS[Fulfillment Reliability<br/>30% Weight]
        NSS[Negotiation Stability<br/>20% Weight]
        LRS[Language Reliability<br/>15% Weight]
    end
    
    subgraph "Trust Score Engine"
        Aggregator[Weighted Aggregation<br/>Moving Average]
        Confidence[Confidence Indicator<br/>Based on Transaction Count]
    end
    
    subgraph "Output"
        TrustScore[Overall Trust Score<br/>0-100]
        Breakdown[Component Breakdown]
        Display[Visual Display<br/>Colors/Stars/Progress]
    end
    
    Deal --> Price
    Deal --> Delivery
    Deal --> Negotiation
    Deal --> Language
    
    Price --> PHS
    Delivery --> FRS
    Negotiation --> NSS
    Language --> LRS
    
    PHS --> Aggregator
    FRS --> Aggregator
    NSS --> Aggregator
    LRS --> Aggregator
    
    Aggregator --> TrustScore
    Aggregator --> Confidence
    
    TrustScore --> Breakdown
    Breakdown --> Display
    Confidence --> Display
```

## Data Flow Architecture

```mermaid
graph TD
    subgraph "Input Layer"
        Voice[Voice Input<br/>9+ Languages]
        Text[Text Input<br/>Fallback Mode]
    end
    
    subgraph "Processing Pipeline"
        STT[Speech-to-Text<br/>Web Speech API]
        Translation[Translation Layer<br/>LibreTranslate]
        Safety[Safety Check<br/>Local Filter + LLM]
        Mediation[Mediation Engine<br/>Trigger-Based LLM]
        Extraction[Deal Extraction<br/>Structured JSON]
    end
    
    subgraph "Storage & Analytics"
        ChatLog[Chat History<br/>MongoDB]
        TrustUpdate[Trust Score Update<br/>PostgreSQL]
        VoiceArchive[Voice Archive<br/>S3]
        Analytics[Behavioral Analytics<br/>Trust Patterns]
    end
    
    subgraph "Output Layer"
        VoiceOut[Voice Output<br/>Text-to-Speech]
        Notification[SMS/Push Notification]
        DealSummary[Deal Summary<br/>Multilingual Receipt]
    end
    
    Voice --> STT
    Text --> Translation
    STT --> Translation
    
    Translation --> Safety
    Safety --> Mediation
    Mediation --> Extraction
    
    Translation --> ChatLog
    Mediation --> ChatLog
    Extraction --> TrustUpdate
    Voice --> VoiceArchive
    
    ChatLog --> Analytics
    TrustUpdate --> Analytics
    
    Mediation --> VoiceOut
    Extraction --> Notification
    Extraction --> DealSummary
```

## Technology Stack Details

### Frontend
- **Framework**: React 19 with TypeScript
- **State Management**: Zustand
- **Real-time**: Socket.io Client, WebRTC (simple-peer)
- **Voice**: Web Audio API, MediaRecorder
- **Offline**: IndexedDB (Dexie.js), Service Workers
- **UI**: Tailwind CSS, Responsive PWA

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Real-time**: Socket.io Server
- **Authentication**: JWT
- **File Upload**: Multer

### AI & Translation
- **LLM**: Groq API (Llama-3.1-8b-instant)
- **Translation**: LibreTranslate (Self-hosted)
- **Speech**: Web Speech API (Browser-native)

### Data Storage
- **Session Cache**: Redis
- **Chat Logs**: MongoDB
- **User Data**: PostgreSQL (proposed)
- **Voice Files**: AWS S3 / Local Storage

### External APIs
- **Price Data**: AGMARKNET (data.gov.in)
- **Notifications**: SMS Gateway
- **Maps**: GPS/Location Services

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        Auth[JWT Authentication<br/>Phone-based Login]
        Encrypt[End-to-End Encryption<br/>WebRTC DTLS-SRTP]
        Privacy[Privacy Protection<br/>Anonymized Analytics]
        Validation[Input Validation<br/>Safety Filters]
    end
    
    subgraph "Data Protection"
        PII[PII Minimization<br/>90-day Retention]
        Consent[Explicit Consent<br/>Data Sharing]
        Audit[Audit Trail<br/>Immutable Logs]
    end
    
    Auth --> Encrypt
    Encrypt --> Privacy
    Privacy --> Validation
    
    Validation --> PII
    PII --> Consent
    Consent --> Audit
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        LB[Load Balancer<br/>Nginx/AWS ALB]
        
        subgraph "Application Tier"
            App1[App Server 1]
            App2[App Server 2]
            App3[App Server N]
        end
        
        subgraph "AI Services"
            Groq[Groq API<br/>External]
            Libre[LibreTranslate<br/>Docker Container]
        end
        
        subgraph "Data Tier"
            RedisCluster[Redis Cluster<br/>Session Cache]
            MongoReplica[MongoDB Replica Set<br/>Chat Logs]
            PostgresHA[PostgreSQL HA<br/>User Data]
            S3Bucket[S3 Bucket<br/>Voice Files]
        end
    end
    
    LB --> App1
    LB --> App2
    LB --> App3
    
    App1 --> Groq
    App2 --> Groq
    App3 --> Groq
    
    App1 --> Libre
    App2 --> Libre
    App3 --> Libre
    
    App1 --> RedisCluster
    App2 --> RedisCluster
    App3 --> RedisCluster
    
    App1 --> MongoReplica
    App2 --> MongoReplica
    App3 --> MongoReplica
    
    App1 --> PostgresHA
    App2 --> PostgresHA
    App3 --> PostgresHA
    
    App1 --> S3Bucket
    App2 --> S3Bucket
    App3 --> S3Bucket
```

## Key Architectural Decisions

### 1. State-Machine Driven Mediation
- **Decision**: Use trigger-based LLM activation instead of processing every message
- **Rationale**: Reduces API costs by 70%, improves latency, maintains responsiveness
- **Implementation**: Regex/keyword detection for price mentions, tone shifts, deal signals

### 2. Separation of Extraction and Mediation
- **Decision**: Split deal extraction (JSON) from response generation
- **Rationale**: Reduces hallucination, ensures database accuracy matches AI congratulations
- **Implementation**: Two separate LLM calls with different prompts and validation

### 3. Self-Hosted Translation
- **Decision**: Deploy LibreTranslate instead of using cloud translation APIs
- **Rationale**: Cost control, data privacy, offline capability, no vendor lock-in
- **Implementation**: Docker container with language models, fallback to scripted heuristics

### 4. Behavioral Trust Scoring
- **Decision**: Calculate trust from actual transaction behavior, not user ratings
- **Rationale**: Objective, manipulation-resistant, culturally neutral
- **Implementation**: 4-component weighted formula with moving averages

### 5. Progressive Web App
- **Decision**: Build PWA instead of native mobile apps
- **Rationale**: Universal accessibility, no app store friction, instant updates
- **Implementation**: Service workers, IndexedDB, responsive design

## Scalability Considerations

- **Horizontal Scaling**: Stateless application servers behind load balancer
- **Caching Strategy**: Redis for session data, CDN for static assets
- **Database Sharding**: MongoDB sharded by location, PostgreSQL read replicas
- **Async Processing**: Queue-based architecture for non-critical operations
- **CDN**: CloudFront/Cloudflare for global voice file delivery
