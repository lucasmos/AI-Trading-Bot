# AI-Trading-Bot

## Overview

AI-Trading-Bot is an advanced algorithmic trading platform that leverages artificial intelligence to optimize trading strategies. The platform combines modern web technologies with sophisticated trading algorithms to provide an intuitive, powerful trading experience for both novice and experienced traders.

## Features

### AI-Powered Trading
- **Automated Trading**: Configure and deploy AI-driven trading strategies that operate 24/7
- **AI Performance Analysis**: Track and analyze AI model performance with detailed metrics and visualizations
- **Strategy Optimization**: Utilize machine learning to continuously refine trading parameters

### Trading Capabilities
- **MT5 Integration**: Seamless connection with MetaTrader 5 for executing trades
- **Volatility Trading**: Specialized tools for trading in volatile market conditions
- **Digit Analysis**: Pattern recognition for numerical trends in trading data
- **Technical Indicators**: Integration with various technical analysis tools via the technicalindicators library

### Portfolio Management
- **Trade History**: Comprehensive logs of all trading activities
- **Profit Tracking**: Real-time monitoring of trading performance
- **Profits Claiming**: Streamlined process for withdrawing trading profits

### User Experience
- **Responsive Interface**: Modern UI built with React and TailwindCSS
- **Secure Authentication**: Robust user authentication system
- **Customizable Settings**: Personalize your trading experience
- **Payment Processing**: Integrated payment solutions for account funding

## Recent Fixes and Improvements (August 2025)

### Volatility Trading Page Fixes

#### Issue 1: Profit/Loss Calculation Accuracy ✅
- **Problem**: Profit/loss values were inaccurate due to manual calculations instead of using Deriv API response data
- **Solution**: Updated trade monitoring to use `contractStatusData.profit` and `sell_price` directly from Deriv API
- **Impact**: Accurate P/L display, proper green/red badge colors based on actual profit/loss

#### Issue 2: Tick Data Recording and Multi-tick Support ✅ 
- **Problem**: Tick duration wasn't properly passed from UI to execution layer, causing incorrect trade durations
- **Solution**: 
  - Fixed `tickDuration` parameter passing in manual execution calls
  - Ensured tick duration is preserved through entire execution chain
  - Added proper tracking of entry/exit prices for multi-tick trades
- **Impact**: Correct handling of 1-10 tick duration trades with proper entry/exit price tracking

#### Issue 3: Badge Display Logic in Trade Tables ✅
- **Problem**: Inconsistent badge colors and states for open/profitable/losing trades
- **Solution**: 
  - Updated `CompactDerivTradeTable` to show "Open" (gray) for unsettled trades
  - Green badges for profits > 0
  - Red badges for losses < 0
  - "Break Even" for zero P/L trades
- **Impact**: Clear visual distinction between trade states, consistent UX across the platform

#### Additional Improvements
- **Database**: Ensured `derivSellPrice` field properly stores sell prices when trades settle
- **Testing**: Added comprehensive Jest tests for tick duration regression testing
- **Type Safety**: Improved TypeScript interfaces for trade execution options
- **Error Handling**: Better WebSocket error handling and pattern monitoring timeout management

## Technology Stack

### Frontend
- Next.js 15
- React 18
- TypeScript
- TailwindCSS
- Radix UI Components
- Recharts for data visualization

### Backend
- Next.js API Routes
- Prisma ORM
- NextAuth for authentication
- Firebase/Firestore

### AI/ML
- OpenAI integration
- HuggingFace inference
- Custom ML models via Genkit
- Technical indicators library

### Other
- WebSocket for real-time data
- MT5 connectivity
- Secure payment processing

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Database (configured with Prisma)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/ai-trading-bot.git
   cd ai-trading-bot
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. Set up the database
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Run the development server
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev`: Start development server with Turbopack
- `npm run build`: Build the application for production
- `npm run start`: Start the production server
- `npm run lint`: Run ESLint
- `npm run typecheck`: Check TypeScript types
- `npm run genkit:dev`: Start Genkit AI development server
- `npm run genkit:watch`: Start Genkit AI development server with watch mode

## Security

This application implements industry-standard security practices including:
- Secure authentication via NextAuth
- Encrypted password storage with bcrypt
- HTTPS for all communications
- Environment-based secrets management

## License

This project is licensed under the [LICENSE](LICENSE) file in the repository.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

© 2025 AI-Trading-Bot | Built with Next.js, React, and AI
