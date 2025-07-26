# AI Trading Bot - Development Guide for AI Assistants

## Project Overview
AI Trading Bot is a Next.js-based algorithmic trading platform that combines AI-driven strategies with technical analysis. The platform integrates with MT5 for trade execution and uses multiple AI services for strategy optimization.

## Core Architecture

### Key Components
- **AI Services** (`src/ai/`): Dual AI system using Gemini (primary) and DeepSeek (fallback) for strategy generation
- **Trading Services** (`src/services/`): 
  - `deriv-tick-stream.ts` - Real-time market data
  - `trade-monitor.ts` - Trade execution and monitoring
  - `news.ts` - Market news integration
- **Database** (`prisma/schema.prisma`): PostgreSQL with Prisma ORM for user data, trades, and AI strategy tracking
- **Authentication** (`src/app/auth/`): NextAuth implementation with multiple provider support

### Data Flow
1. Market data streams from Deriv API → `deriv-tick-stream.ts`
2. AI models analyze data using `genkit.ts` and `deepseek-service.ts`
3. Trade decisions flow through `trade-monitor.ts` → MT5 integration
4. Results stored in PostgreSQL via Prisma

## Development Workflows

### Setup
```bash
npm install
npx prisma generate  # Generate Prisma client
npx prisma db push   # Apply schema changes
```

### Key Commands
- `npm run dev` - Development server with hot reload
- `npm run build` - Production build
- `npm run test` - Run Jest tests
- `npm run migrate` - Run database migrations

## Project Conventions

### File Structure
- Feature-first organization under `src/app/`
- Shared components in `src/components/`
- AI/ML logic isolated in `src/ai/`
- Database access through `src/lib/db/`

### State Management
- Server components preferred for data fetching
- Client state via React Context (see `src/contexts/`)
- Real-time updates through WebSocket streams

### AI Strategy Implementation
1. Define strategy in `src/config/ai-strategies.ts`
2. Implement AI flow in `src/ai/flows/`
3. Add monitoring in `src/services/trade-monitor.ts`

### Error Handling
- Use `src/lib/utils.ts` error utilities
- AI service fallbacks defined in `src/ai/genkit.ts`
- Trading errors handled by `trade-monitor.ts`

## Integration Points

### External Services
- MT5 Trading Platform
- Deriv API (WebSocket)
- Google AI (Gemini)
- DeepSeek AI
- Firebase/Firestore

### Environment Variables
Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection
- `NEXTAUTH_SECRET` - Auth encryption key
- `DERIV_APP_ID` - Deriv API credentials
- `GOOGLE_AI_KEY` - Gemini API access
- `DEEPSEEK_API_KEY` - DeepSeek API access

## Performance Considerations
- Use WebSocket connections efficiently
- Implement proper error boundaries for AI services
- Monitor database query performance
- Cache trading data appropriately
