# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Essential Commands

### Development
```bash
npm run dev          # Start dev server with Turbopack on port 9002
npm run build        # Production build (runs prisma generate first)
npm run start        # Start production server
npm run lint         # ESLint with Next.js rules
npm run typecheck    # TypeScript type checking
```

### Testing
```bash
npm test                           # Run all Jest tests
npm run test:watch                 # Run tests in watch mode
npm run test:coverage              # Generate coverage report
npm test -- src/utils/__tests__/  # Run specific test directory
npm test -- --updateSnapshot       # Update snapshots after schema changes
```

### Database (Prisma)
```bash
npx prisma generate        # Generate Prisma client (after schema changes)
npx prisma db push         # Push schema changes to database (dev)
npx prisma migrate dev     # Create migration for schema changes
npx prisma migrate reset   # Reset database and apply all migrations
npx prisma studio          # Open Prisma Studio GUI for database
```

### AI Development (Genkit)
```bash
npm run genkit:dev        # Start Genkit AI development server
npm run genkit:watch      # Start Genkit with file watching
```

## Architecture & Key Components

### Data Flow
```
1. Market Data Stream
   Deriv WebSocket → src/services/deriv-tick-stream.ts
   ↓
2. AI Analysis
   src/ai/genkit.ts (Gemini primary) 
   → fallback to src/ai/deepseek-service.ts
   → Strategy flows in src/ai/flows/
   ↓
3. Trade Execution
   src/services/trade-monitor.ts → MT5 integration
   ↓
4. Persistence
   Next.js API Routes → Prisma → PostgreSQL
   (fallback: localStorage for trade history)
   ↓
5. Real-time UI
   Server Components → WebSocket updates → React 18 UI
```

### Critical Files
- **AI Strategy Config**: `src/config/ai-strategies.ts`
- **Trading Instruments**: `src/config/instruments.ts`
- **Trade Monitoring**: `src/services/trade-monitor.ts`
- **Auth Flow**: `src/contexts/auth-context.tsx` → `/api/auth/verify`
- **Database Schema**: `prisma/schema.prisma`
- **Main Trading UI**: `src/app/page.tsx`

## Project Patterns & Conventions

### File Structure
- **Feature-first** organization under `src/app/`
- Shared components in `src/components/`
- AI/ML logic isolated in `src/ai/`
- Services (WebSocket, monitoring) in `src/services/`
- Database access through `src/lib/db/`

### State Management
- Server components preferred for data fetching
- Client state via React Context (`src/contexts/`)
- Real-time updates through WebSocket streams
- TanStack Query for client-side data fetching

### AI Service Pattern
```typescript
// Dual AI with automatic fallback (src/ai/genkit.ts)
try {
  result = await geminiModel.generate(prompt);
} catch {
  result = await deepSeekService.generate(prompt); // Auto-fallback
}
```

### Database-First with Fallback
```typescript
// Trade storage pattern (src/app/page.tsx)
try {
  await fetch('/api/trades', { method: 'POST', body: trade });
} catch {
  localStorage.setItem('trades_backup', JSON.stringify(trades));
}
```

### Error Handling Pattern
```typescript
// Early return pattern (src/lib/utils.ts style)
if (error) {
  console.error('Error:', error);
  return { error: 'Failed to process' };
}
// Continue with success path
```

## Integration Points & Environment Variables

### Required Environment Variables
```bash
DATABASE_URL              # PostgreSQL connection string
NEXTAUTH_SECRET          # Auth encryption key
DERIV_APP_ID            # Deriv API WebSocket credentials
GOOGLE_AI_KEY           # Gemini AI API access
DEEPSEEK_API_KEY        # DeepSeek AI fallback API
```

### External Services
- **Deriv API**: WebSocket for market data (`src/services/deriv-tick-stream.ts`)
- **MT5**: Trade execution via integration
- **Firebase/Firestore**: User authentication & data
- **Google AI (Gemini)**: Primary AI model
- **DeepSeek AI**: Fallback AI model
- **PostgreSQL**: Primary database via Prisma

### User Settings Storage
- MT5 credentials stored in `UserSettings` table
- Deriv account tokens in `derivRealApiToken`/`derivDemoApiToken`
- Account selection via `selectedDerivAccountType`

## Key Development Workflows

### Initial Setup
```bash
git clone <repo>
cp .env.example .env.local    # Configure environment variables
npm install
npx prisma generate           # Generate Prisma client
npx prisma db push           # Apply schema to database
npm run dev                  # Start on port 9002
```

### Adding New AI Strategy
1. Define strategy in `src/config/ai-strategies.ts`
2. Create flow in `src/ai/flows/[strategy-name].ts`
3. Add to `src/ai/genkit.ts` flow registry
4. Test with `npm run genkit:watch`
5. Update `src/services/trade-monitor.ts` for execution

### Database Schema Changes
```bash
# Edit prisma/schema.prisma
npx prisma migrate dev --name describe_change  # Create migration
npx prisma generate                            # Update client
# Update affected API routes and components
```

### Implementing Trade Features
1. Update `src/services/trade-monitor.ts` for logic
2. Add API endpoint in `src/app/api/trades/`
3. Update UI in `src/app/page.tsx` or trade components
4. Write tests:
   - Unit: `src/lib/__tests__/`
   - Integration: `src/__tests__/integration/`
   - CSV exports: `src/utils/__tests__/csv-*.test.ts`
5. Run tests: `npm test`

### User Authentication Flow
1. Firebase auth initiated → `src/contexts/auth-context.tsx`
2. Calls `/api/auth/verify` to check/create Prisma User
3. User record auto-created if not exists
4. Session stored via NextAuth
5. User ID available throughout app

### CSV Export Testing
```bash
# Test CSV generation for trade history
npm test -- src/utils/__tests__/csv-generation.test.ts

# Update snapshots after field changes
npm test -- --updateSnapshot

# Full integration test
npm test -- src/__tests__/integration/csv-download-integration.test.ts
```

## Testing Strategy

### Test Structure
- **Unit Tests**: Component logic, utilities, services
- **Integration Tests**: End-to-end workflows, API calls
- **Snapshot Tests**: CSV format regression prevention
- **Performance Tests**: 1000+ record handling validation

### CSV Export Validation
- Tests verify cents→dollars conversion (values ≥100 divided by 100)
- RFC 4180 compliance (proper escaping of commas, quotes)
- 14-column trade history format
- 12-column profit table format

### Running Tests
```bash
npm test                    # All tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
npm test [file-pattern]    # Specific tests
```

## Common Issues & Solutions

### Port Conflicts
Dev server runs on port 9002 (not default 3000). Check `package.json` scripts.

### Database Connection
If Prisma commands fail, verify `DATABASE_URL` in `.env` and PostgreSQL is running.

### AI Service Failures
System automatically falls back from Gemini to DeepSeek. Check both API keys if issues persist.

### Trade History Not Showing
1. Check database connection
2. Verify user authentication
3. Check localStorage backup: `localStorage.getItem('trades_[userId]')`
4. Use refresh button in trade history page

### WebSocket Disconnections
Deriv tick stream auto-reconnects. Check `DERIV_APP_ID` if persistent issues.

## Performance Considerations
- WebSocket connections are reused efficiently
- AI services have built-in error boundaries and fallbacks
- Database queries optimized with proper indexes (see schema)
- CSV exports handle 1000+ records in <1 second
- React Server Components reduce client bundle size
