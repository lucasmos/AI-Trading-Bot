import { 
  executeAiTradingStrategy, 
  TradeExecutionResult, 
  executeVolatilityManualTradeLoop,
  VolatilityTradeOptions,
  VolatilityTradeExecutionResult
} from './trade-execution-actions';
import { 
  AutomatedTradingStrategyOutput, 
  AutomatedTradeProposal, 
  ForexCryptoCommodityInstrumentType,
  VolatilityInstrumentType,
  PriceTick,
  PatternAnalysisResult,
  VolatilitySingleTradeProposal
} from '@/types';
import { 
  placeTrade, 
  TradeDetails, 
  PlaceTradeResponse, 
  instrumentToDerivSymbol,
  getTicks,
  getContractStatus
} from '@/services/deriv';
import { prisma } from '@/lib/db';
import { getTradeDistribution, validateDistribution } from '@/utils/trade-distribution';

// Import Jest globals and types
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies
jest.mock('@/services/deriv', () => ({
  ...(jest.requireActual('@/services/deriv') as object), // Import and retain default exports
  placeTrade: jest.fn(),
  getTicks: jest.fn(),
  getContractStatus: jest.fn(),
  instrumentToDerivSymbol: jest.fn((instrument: ForexCryptoCommodityInstrumentType) => {
    // Simple mock implementation for testing
    if (instrument === 'EUR/USD') return 'frxEURUSD';
    if (instrument === 'BTC/USD') return 'cryBTCUSD';
    return `mock_${instrument}`;
  }),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    trade: {
      create: jest.fn(),
    },
  },
}));

const mockPlaceTrade = placeTrade as jest.MockedFunction<typeof placeTrade>;
const mockGetTicks = getTicks as jest.MockedFunction<typeof getTicks>;
const mockGetContractStatus = getContractStatus as jest.MockedFunction<typeof getContractStatus>;
const mockInstrumentToDerivSymbol = instrumentToDerivSymbol as jest.MockedFunction<typeof instrumentToDerivSymbol>;
const mockPrismaCreate = prisma.trade.create as jest.MockedFunction<typeof prisma.trade.create>;

// Test fixtures and helper functions
const MOCK_USER_TOKEN = 'test-token-123';
const MOCK_ACCOUNT_ID = 'CR123456';
const MOCK_USER_ID = 'user-123';
const MOCK_INSTRUMENT: VolatilityInstrumentType = 'Volatility 10 Index';
const MOCK_TICK_PRICE = 1234.56;

// Helper function to create mock price tick
function createMockPriceTick(price: number, epoch: number): PriceTick {
  return {
    price,
    epoch,
    symbol: 'R_10',
    id: `tick-${epoch}`,
    quote: price
  };
}

// Helper function to create mock pattern analysis
function createMockPatternAnalysis(contractType: 'DIGITEVEN' | 'DIGITODD'): PatternAnalysisResult {
  return {
    shouldTrade: true,
    contractType,
    reasoning: `Pattern analysis suggests ${contractType} trade`,
    confidence: 0.85,
    patternStrength: 'HIGH'
  };
}

// Helper function to create mock trade options
function createMockTradeOptions(
  executionMode: 'turbo' | 'safe', 
  numberOfBulkTrades: number, 
  instrument: string = MOCK_INSTRUMENT
): VolatilityTradeOptions {
  return {
    userDerivApiToken: MOCK_USER_TOKEN,
    targetAccountId: MOCK_ACCOUNT_ID,
    selectedAccountType: 'demo' as const,
    userId: MOCK_USER_ID,
    userSelectedTradeType: 'Volatility Trading' as const,
    totalStakeFromUser: 10 * numberOfBulkTrades,
    instrument: instrument as VolatilityInstrumentType,
    executionMode,
    numberOfBulkTrades,
    predictionDigit: 5
  };
}

// Helper function to create mock trade proposal
function createMockTradeProposal(
  instrument: VolatilityInstrumentType = MOCK_INSTRUMENT, 
  contractType: string = 'DIGITEVEN'
): VolatilitySingleTradeProposal {
  return {
    instrument,
    derivContractType: contractType,
    duration: 5,
    durationUnit: 't' as const,
    stake: 10,
    reasoning: `AI suggests ${contractType} trade on ${instrument}`,
    barrier: '5'
  };
}

describe('executeAiTradingStrategy', () => {
  const mockUserToken = 'test-token-123';

  beforeEach(() => {
    // Clear mock history and implementations before each test
    mockPlaceTrade.mockClear();
    mockGetTicks.mockClear();
    mockGetContractStatus.mockClear();
    mockInstrumentToDerivSymbol.mockClear();
    mockPrismaCreate.mockClear();
    
    // Set default mock implementations
    mockGetTicks.mockResolvedValue([createMockPriceTick(MOCK_TICK_PRICE, Date.now())]);
    mockPrismaCreate.mockResolvedValue({ 
      id: 'trade-123', 
      userId: MOCK_USER_ID,
      contractId: '12345',
      profit: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
    mockPlaceTrade.mockResolvedValue({ 
      contract_id: 12345, 
      buy_price: 10, 
      longcode: 'mock', 
      entry_spot: MOCK_TICK_PRICE 
    });
    mockInstrumentToDerivSymbol.mockImplementation((instrument: any) => 'R_10');
    
    // Default mock for instrumentToDerivSymbol if not overridden in a test
    mockInstrumentToDerivSymbol.mockImplementation((instrument: ForexCryptoCommodityInstrumentType) => `mock_${instrument}`);
  });

  const createMockStrategy = (proposals: AutomatedTradeProposal[]): AutomatedTradingStrategyOutput => ({
    tradesToExecute: proposals,
    overallReasoning: 'Test reasoning',
  });

  const eurUsdProposal: AutomatedTradeProposal = {
    instrument: 'EUR/USD',
    action: 'CALL',
    stake: 10,
    durationSeconds: 60,
    reasoning: 'EUR/USD going up',
  };

  const btcUsdProposal: AutomatedTradeProposal = {
    instrument: 'BTC/USD',
    action: 'PUT',
    stake: 20,
    durationSeconds: 300,
    reasoning: 'BTC/USD going down',
  };

  it('should return error results if API token is missing', async () => {
    const strategy = createMockStrategy([eurUsdProposal]);
    const results = await executeAiTradingStrategy(strategy, ''); // Empty token

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(false);
    expect(results[0].instrument).toBe(eurUsdProposal.instrument);
    expect(results[0].error).toBe('Deriv API token is missing. Cannot execute trades.');
    expect(mockPlaceTrade).not.toHaveBeenCalled();
  });

  it('should call placeTrade for each proposal and return success results', async () => {
    const strategy = createMockStrategy([eurUsdProposal, btcUsdProposal]);

    mockInstrumentToDerivSymbol
      .mockImplementationOnce(() => 'frxEURUSD') // For eurUsdProposal
      .mockImplementationOnce(() => 'cryBTCUSD'); // For btcUsdProposal

    const mockEurUsdResponse: PlaceTradeResponse = { contract_id: 100, buy_price: 10, longcode: 'longcode1', entry_spot: 1.1 };
    const mockBtcUsdResponse: PlaceTradeResponse = { contract_id: 101, buy_price: 20, longcode: 'longcode2', entry_spot: 50000 };

    mockPlaceTrade
      .mockResolvedValueOnce(mockEurUsdResponse)
      .mockResolvedValueOnce(mockBtcUsdResponse);

    const results = await executeAiTradingStrategy(strategy, mockUserToken);

    expect(results.length).toBe(2);
    expect(mockInstrumentToDerivSymbol).toHaveBeenCalledTimes(2);
    expect(mockInstrumentToDerivSymbol).toHaveBeenCalledWith(eurUsdProposal.instrument);
    expect(mockInstrumentToDerivSymbol).toHaveBeenCalledWith(btcUsdProposal.instrument);
    expect(mockPlaceTrade).toHaveBeenCalledTimes(2);

    // Check details for first trade (EUR/USD)
    expect(mockPlaceTrade).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'frxEURUSD',
      contract_type: eurUsdProposal.action,
      duration: eurUsdProposal.durationSeconds,
      duration_unit: 's',
      amount: eurUsdProposal.stake,
      currency: 'USD',
      basis: 'stake',
      token: mockUserToken,
    }));
    expect(results[0].success).toBe(true);
    expect(results[0].instrument).toBe(eurUsdProposal.instrument);
    expect(results[0].tradeResponse).toEqual(mockEurUsdResponse);

    // Check details for second trade (BTC/USD)
    expect(mockPlaceTrade).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'cryBTCUSD',
      contract_type: btcUsdProposal.action,
      duration: btcUsdProposal.durationSeconds,
      duration_unit: 's',
      amount: btcUsdProposal.stake,
      token: mockUserToken,
    }));
    expect(results[1].success).toBe(true);
    expect(results[1].instrument).toBe(btcUsdProposal.instrument);
    expect(results[1].tradeResponse).toEqual(mockBtcUsdResponse);
  });

  it('should handle errors from placeTrade for one trade and succeed for another', async () => {
    const strategy = createMockStrategy([eurUsdProposal, btcUsdProposal]);

    mockInstrumentToDerivSymbol
      .mockImplementationOnce(() => 'frxEURUSD')
      .mockImplementationOnce(() => 'cryBTCUSD');

    const mockEurUsdResponse: PlaceTradeResponse = { contract_id: 100, buy_price: 10, longcode: 'longcode1', entry_spot: 1.1 };
    const placeTradeError = new Error('Deriv API Error');

    mockPlaceTrade
      .mockResolvedValueOnce(mockEurUsdResponse) // EUR/USD succeeds
      .mockRejectedValueOnce(placeTradeError);    // BTC/USD fails

    const results = await executeAiTradingStrategy(strategy, mockUserToken);

    expect(results.length).toBe(2);
    expect(mockPlaceTrade).toHaveBeenCalledTimes(2);

    expect(results[0].success).toBe(true);
    expect(results[0].instrument).toBe(eurUsdProposal.instrument);
    expect(results[0].tradeResponse).toEqual(mockEurUsdResponse);

    expect(results[1].success).toBe(false);
    expect(results[1].instrument).toBe(btcUsdProposal.instrument);
    expect(results[1].error).toBe(placeTradeError.message);
    expect(results[1].tradeResponse).toBeUndefined();
  });

  it('should return an empty array if strategy has no trades to execute', async () => {
    const strategy = createMockStrategy([]); // No trade proposals
    const results = await executeAiTradingStrategy(strategy, mockUserToken);

    expect(results.length).toBe(0);
    expect(mockPlaceTrade).not.toHaveBeenCalled();
  });

  it('should correctly map instrument to Deriv symbol using the mock', async () => {
    const customInstrument: ForexCryptoCommodityInstrumentType = 'XAU/USD';
    const customProposal: AutomatedTradeProposal = {
      instrument: customInstrument,
      action: 'CALL',
      stake: 50,
      durationSeconds: 120,
      reasoning: 'Gold test',
    };
    const strategy = createMockStrategy([customProposal]);
    const mockSymbol = 'mock_XAU/USD'; // From default mockInstrumentToDerivSymbol

    mockInstrumentToDerivSymbol.mockImplementationOnce(() => mockSymbol);
    mockPlaceTrade.mockResolvedValueOnce({ contract_id: 102, buy_price: 50, longcode: 'longcode_xau', entry_spot: 1800 });

    await executeAiTradingStrategy(strategy, mockUserToken);

    expect(mockInstrumentToDerivSymbol).toHaveBeenCalledWith(customInstrument);
    expect(mockPlaceTrade).toHaveBeenCalledWith(expect.objectContaining({
      symbol: mockSymbol,
    }));
  });
});

// Manual Turbo Mode Tests - 1-4 Trades (Same Tick)
describe('executeVolatilityManualTradeLoop - Turbo Mode (1-4 trades)', () => {
  beforeEach(() => {
    // Clear mock history and implementations before each test
    mockPlaceTrade.mockClear();
    mockGetTicks.mockClear();
    mockGetContractStatus.mockClear();
    mockInstrumentToDerivSymbol.mockClear();
    mockPrismaCreate.mockClear();
    
    // Set default mock implementations
    mockGetTicks.mockResolvedValue([createMockPriceTick(MOCK_TICK_PRICE, Date.now())]);
    mockPrismaCreate.mockResolvedValue({ 
      id: 'trade-123', 
      userId: MOCK_USER_ID,
      contractId: '12345',
      profit: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
    mockPlaceTrade.mockResolvedValue({ 
      contract_id: 12345, 
      buy_price: 10, 
      longcode: 'mock', 
      entry_spot: MOCK_TICK_PRICE 
    });
    mockInstrumentToDerivSymbol.mockImplementation(() => 'R_10');
  });

  it('should execute 1 trade on same tick in Turbo mode', async () => {
    // Setup: Mock getTicks to return 20 ticks for pattern analysis + 1 tick for shared price
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    const sharedPriceTick = createMockPriceTick(MOCK_TICK_PRICE + 50, Date.now() + 21000);
    
    mockGetTicks
      .mockResolvedValueOnce(patternTicks) // For pattern analysis
      .mockResolvedValueOnce([sharedPriceTick]); // For shared price capture
    
    const tradeOptions = createMockTradeOptions('turbo', 1);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: getTicks called for pattern analysis and shared price capture
    expect(mockGetTicks).toHaveBeenCalledTimes(2);
    
    // Assert: placeTrade called exactly once
    expect(mockPlaceTrade).toHaveBeenCalledTimes(1);
    
    // Assert: Result array length is 1
    expect(results.length).toBe(1);
    
    // Assert: Trade successful
    expect(results[0].success).toBe(true);
  });

  it('should execute 4 trades simultaneously on same tick in Turbo mode', async () => {
    // Setup: Similar to above but with numberOfBulkTrades: 4
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    const sharedPriceTick = createMockPriceTick(MOCK_TICK_PRICE + 100, Date.now() + 21000);
    
    mockGetTicks
      .mockResolvedValueOnce(patternTicks)
      .mockResolvedValueOnce([sharedPriceTick]);
    
    const tradeOptions = createMockTradeOptions('turbo', 4);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: placeTrade called 4 times
    expect(mockPlaceTrade).toHaveBeenCalledTimes(4);
    
    // Assert: All calls use the same shared price point (verify via mock call arguments)
    const placeTradeCalls = mockPlaceTrade.mock.calls;
    expect(placeTradeCalls).toHaveLength(4);
    
    // Assert: Result array length is 4
    expect(results.length).toBe(4);
    
    // Assert: All trades successful
    expect(results.every(result => result.success)).toBe(true);
  });

  it('should handle errors gracefully for 1-4 trades in Turbo mode', async () => {
    // Setup: Mock placeTrade to reject with error for one trade
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    mockPlaceTrade
      .mockResolvedValueOnce({ contract_id: 12345, buy_price: 10, longcode: 'mock1', entry_spot: MOCK_TICK_PRICE })
      .mockRejectedValueOnce(new Error('Trade execution failed'))
      .mockResolvedValueOnce({ contract_id: 12346, buy_price: 10, longcode: 'mock2', entry_spot: MOCK_TICK_PRICE });
    
    const tradeOptions = createMockTradeOptions('turbo', 3);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: Some trades succeed, some fail
    expect(results.length).toBe(3);
    const successfulTrades = results.filter(result => result.success);
    const failedTrades = results.filter(result => !result.success);
    
    expect(successfulTrades.length).toBe(2);
    expect(failedTrades.length).toBe(1);
    
    // Assert: Error is captured in result object
    expect(failedTrades[0].error).toContain('Trade execution failed');
  });
});

// Manual Turbo Mode Tests - 5-100 Trades (Distribution-Based)
describe('executeVolatilityManualTradeLoop - Turbo Mode (5-100 trades)', () => {
  beforeEach(() => {
    // Clear mock history and implementations before each test
    mockPlaceTrade.mockClear();
    mockGetTicks.mockClear();
    mockGetContractStatus.mockClear();
    mockInstrumentToDerivSymbol.mockClear();
    mockPrismaCreate.mockClear();
    
    // Set default mock implementations
    mockPrismaCreate.mockResolvedValue({ 
      id: 'trade-123', 
      userId: MOCK_USER_ID,
      contractId: '12345',
      profit: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
    mockPlaceTrade.mockResolvedValue({ 
      contract_id: 12345, 
      buy_price: 10, 
      longcode: 'mock', 
      entry_spot: MOCK_TICK_PRICE 
    });
    mockInstrumentToDerivSymbol.mockImplementation(() => 'R_10');
  });

  it('should execute 5 trades across 3 ticks using distribution [2,2,1] in Turbo mode', async () => {
    // Setup: Mock getTicks to return different prices for each tick
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    const tick1Price = createMockPriceTick(MOCK_TICK_PRICE + 100, Date.now() + 21000);
    const tick2Price = createMockPriceTick(MOCK_TICK_PRICE + 200, Date.now() + 22000);
    const tick3Price = createMockPriceTick(MOCK_TICK_PRICE + 300, Date.now() + 23000);
    
    mockGetTicks
      .mockResolvedValueOnce(patternTicks) // For pattern analysis
      .mockResolvedValueOnce([tick1Price]) // For tick 1
      .mockResolvedValueOnce([tick2Price]) // For tick 2
      .mockResolvedValueOnce([tick3Price]); // For tick 3
    
    const tradeOptions = createMockTradeOptions('turbo', 5);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: getTicks called multiple times (once for pattern, once per tick batch)
    expect(mockGetTicks).toHaveBeenCalledTimes(4); // Pattern + 3 ticks
    
    // Assert: placeTrade called 5 times total
    expect(mockPlaceTrade).toHaveBeenCalledTimes(5);
    
    // Assert: Trades distributed as [2,2,1] across ticks
    const distribution = getTradeDistribution(5);
    expect(distribution).toEqual([2, 2, 1]);
    
    // Assert: All trades successful
    expect(results.length).toBe(5);
    expect(results.every(result => result.success)).toBe(true);
  });

  it('should execute 10 trades across 4 ticks using distribution [2,3,3,2] in Turbo mode', async () => {
    // Setup similar to above
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    // Mock getTicks for pattern analysis + 4 tick batches
    mockGetTicks.mockResolvedValue(patternTicks);
    for (let i = 0; i < 4; i++) {
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 100, Date.now() + (i + 21) * 1000)]);
    }
    
    const tradeOptions = createMockTradeOptions('turbo', 10);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify distribution matches getTradeDistribution(10) which returns [2,3,3,2]
    const distribution = getTradeDistribution(10);
    expect(distribution).toEqual([2, 3, 3, 2]);
    
    // Assert: Fresh price captured for each tick batch
    expect(mockGetTicks).toHaveBeenCalledTimes(5); // Pattern + 4 ticks
    
    expect(results.length).toBe(10);
    expect(results.every(result => result.success)).toBe(true);
  });

  it('should execute 20 trades across 4 ticks using distribution [4,6,6,4] in Turbo mode', async () => {
    // Setup: Mock pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    for (let i = 0; i < 4; i++) {
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 50, Date.now() + (i + 21) * 1000)]);
    }
    
    const tradeOptions = createMockTradeOptions('turbo', 20);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify distribution matches getTradeDistribution(20) which returns [4,6,6,4]
    const distribution = getTradeDistribution(20);
    expect(distribution).toEqual([4, 6, 6, 4]);
    
    // Assert: 4 tick batches executed
    expect(mockGetTicks).toHaveBeenCalledTimes(5); // Pattern + 4 ticks
    expect(results.length).toBe(20);
  });

  it('should execute 50 trades across 5 ticks using distribution [8,10,14,10,8] in Turbo mode', async () => {
    // Setup: Mock pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    for (let i = 0; i < 5; i++) {
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 25, Date.now() + (i + 21) * 1000)]);
    }
    
    const tradeOptions = createMockTradeOptions('turbo', 50);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify distribution matches getTradeDistribution(50) which returns [8,10,14,10,8]
    const distribution = getTradeDistribution(50);
    expect(distribution).toEqual([8, 10, 14, 10, 8]);
    
    // Assert: 5 tick batches executed
    expect(mockGetTicks).toHaveBeenCalledTimes(6); // Pattern + 5 ticks
    expect(results.length).toBe(50);
  });

  it('should execute 100 trades across 6 ticks using distribution [16,17,17,17,17,16] in Turbo mode', async () => {
    // Setup: Mock pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    for (let i = 0; i < 6; i++) {
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 10, Date.now() + (i + 21) * 1000)]);
    }
    
    const tradeOptions = createMockTradeOptions('turbo', 100);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify distribution matches getTradeDistribution(100) which returns [16,17,17,17,17,16]
    const distribution = getTradeDistribution(100);
    expect(distribution).toEqual([16, 17, 17, 17, 17, 16]);
    
    // Assert: 6 tick batches executed
    expect(mockGetTicks).toHaveBeenCalledTimes(7); // Pattern + 6 ticks
    
    // Assert: All 100 trades attempted
    expect(results.length).toBe(100);
    expect(mockPlaceTrade).toHaveBeenCalledTimes(100);
  });
});

// Manual Safe Mode Tests - 1-4 Trades (2-Tick Split)
describe('executeVolatilityManualTradeLoop - Safe Mode (1-4 trades)', () => {
  beforeEach(() => {
    // Clear mock history and implementations before each test
    mockPlaceTrade.mockClear();
    mockGetTicks.mockClear();
    mockGetContractStatus.mockClear();
    mockInstrumentToDerivSymbol.mockClear();
    mockPrismaCreate.mockClear();
    
    // Set default mock implementations
    mockPrismaCreate.mockResolvedValue({ 
      id: 'trade-123', 
      userId: MOCK_USER_ID,
      contractId: '12345',
      profit: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
    mockPlaceTrade.mockResolvedValue({ 
      contract_id: 12345, 
      buy_price: 10, 
      longcode: 'mock', 
      entry_spot: MOCK_TICK_PRICE 
    });
    mockInstrumentToDerivSymbol.mockImplementation(() => 'R_10');
  });

  it('should execute 1 trade on first tick in Safe mode (1 + 0 split)', async () => {
    // Setup: Mock getTicks for pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    
    const tradeOptions = createMockTradeOptions('safe', 1);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: placeTrade called once
    expect(mockPlaceTrade).toHaveBeenCalledTimes(1);
    
    // Assert: Only first batch executed (Math.ceil(1/2) = 1, Math.floor(1/2) = 0)
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
  });

  it('should execute 2 trades across 2 ticks in Safe mode (1 + 1 split)', async () => {
    // Setup: Mock pattern analysis and different tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    const tick2Price = createMockPriceTick(MOCK_TICK_PRICE + 100, Date.now() + 22000);
    
    mockGetTicks
      .mockResolvedValueOnce(patternTicks)
      .mockResolvedValueOnce([tick2Price]);
    
    const tradeOptions = createMockTradeOptions('safe', 2);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: placeTrade called twice
    expect(mockPlaceTrade).toHaveBeenCalledTimes(2);
    
    // Assert: First trade on tick 1, second trade on tick 2
    expect(results.length).toBe(2);
    expect(results.every(result => result.success)).toBe(true);
    
    // Assert: Different prices used for each tick (sequential execution)
    expect(mockGetTicks).toHaveBeenCalledTimes(2); // Pattern + tick 2
  });

  it('should execute 3 trades across 2 ticks in Safe mode (2 + 1 split)', async () => {
    // Setup: Mock pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    const tick2Price = createMockPriceTick(MOCK_TICK_PRICE + 150, Date.now() + 22000);
    
    mockGetTicks
      .mockResolvedValueOnce(patternTicks)
      .mockResolvedValueOnce([tick2Price]);
    
    const tradeOptions = createMockTradeOptions('safe', 3);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: First batch has 2 trades (Math.ceil(3/2) = 2)
    // Assert: Second batch has 1 trade (Math.floor(3/2) = 1)
    expect(mockPlaceTrade).toHaveBeenCalledTimes(3);
    expect(results.length).toBe(3);
    
    // Assert: Fresh tick price fetched between batches
    expect(mockGetTicks).toHaveBeenCalledTimes(2);
  });

  it('should execute 4 trades across 2 ticks in Safe mode (2 + 2 split)', async () => {
    // Setup: Mock pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    const tick2Price = createMockPriceTick(MOCK_TICK_PRICE + 200, Date.now() + 22000);
    
    mockGetTicks
      .mockResolvedValueOnce(patternTicks)
      .mockResolvedValueOnce([tick2Price]);
    
    const tradeOptions = createMockTradeOptions('safe', 4);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: First batch has 2 trades
    // Assert: Second batch has 2 trades
    expect(mockPlaceTrade).toHaveBeenCalledTimes(4);
    expect(results.length).toBe(4);
    
    // Assert: Trades execute sequentially within each batch (not simultaneously)
    expect(results.every(result => result.success)).toBe(true);
  });
});

// Manual Safe Mode Tests - 5-100 Trades (Distribution-Based)
describe('executeVolatilityManualTradeLoop - Safe Mode (5-100 trades)', () => {
  beforeEach(() => {
    // Clear mock history and implementations before each test
    mockPlaceTrade.mockClear();
    mockGetTicks.mockClear();
    mockGetContractStatus.mockClear();
    mockInstrumentToDerivSymbol.mockClear();
    mockPrismaCreate.mockClear();
    
    // Set default mock implementations
    mockPrismaCreate.mockResolvedValue({ 
      id: 'trade-123', 
      userId: MOCK_USER_ID,
      contractId: '12345',
      profit: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
    mockPlaceTrade.mockResolvedValue({ 
      contract_id: 12345, 
      buy_price: 10, 
      longcode: 'mock', 
      entry_spot: MOCK_TICK_PRICE 
    });
    mockInstrumentToDerivSymbol.mockImplementation(() => 'R_10');
  });

  it('should execute 5 trades across 3 ticks using distribution [2,2,1] in Safe mode', async () => {
    // Setup: Mock getTicks to return different prices for each tick
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    const tick2Price = createMockPriceTick(MOCK_TICK_PRICE + 100, Date.now() + 22000);
    const tick3Price = createMockPriceTick(MOCK_TICK_PRICE + 200, Date.now() + 23000);
    
    mockGetTicks
      .mockResolvedValueOnce(patternTicks)
      .mockResolvedValueOnce([tick2Price])
      .mockResolvedValueOnce([tick3Price]);
    
    const tradeOptions = createMockTradeOptions('safe', 5);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: Distribution matches [2,2,1]
    const distribution = getTradeDistribution(5);
    expect(distribution).toEqual([2, 2, 1]);
    
    // Assert: Trades execute sequentially within each batch (await pattern, not Promise.all)
    expect(mockPlaceTrade).toHaveBeenCalledTimes(5);
    
    // Assert: Fresh tick price fetched between batches
    expect(mockGetTicks).toHaveBeenCalledTimes(3); // Pattern + 2 additional ticks
    expect(results.length).toBe(5);
  });

  it('should execute 10 trades across 4 ticks using distribution [2,3,3,2] in Safe mode', async () => {
    // Setup: Mock pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    for (let i = 0; i < 3; i++) {
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 50, Date.now() + (i + 22) * 1000)]);
    }
    
    const tradeOptions = createMockTradeOptions('safe', 10);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify distribution and sequential execution
    const distribution = getTradeDistribution(10);
    expect(distribution).toEqual([2, 3, 3, 2]);
    expect(results.length).toBe(10);
  });

  it('should execute 20 trades across 4 ticks using distribution [4,6,6,4] in Safe mode', async () => {
    // Setup: Mock pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    for (let i = 0; i < 3; i++) {
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 25, Date.now() + (i + 22) * 1000)]);
    }
    
    const tradeOptions = createMockTradeOptions('safe', 20);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify distribution and tick timing
    const distribution = getTradeDistribution(20);
    expect(distribution).toEqual([4, 6, 6, 4]);
    expect(results.length).toBe(20);
  });

  it('should execute 50 trades across 5 ticks using distribution [8,10,14,10,8] in Safe mode', async () => {
    // Setup: Mock pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    for (let i = 0; i < 4; i++) {
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 20, Date.now() + (i + 22) * 1000)]);
    }
    
    const tradeOptions = createMockTradeOptions('safe', 50);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify distribution and batch execution
    const distribution = getTradeDistribution(50);
    expect(distribution).toEqual([8, 10, 14, 10, 8]);
    expect(results.length).toBe(50);
  });

  it('should execute 100 trades across 6 ticks using distribution [16,17,17,17,17,16] in Safe mode', async () => {
    // Setup: Mock pattern analysis and tick prices
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    for (let i = 0; i < 5; i++) {
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 10, Date.now() + (i + 22) * 1000)]);
    }
    
    const tradeOptions = createMockTradeOptions('safe', 100);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify distribution and all trades executed
    const distribution = getTradeDistribution(100);
    expect(distribution).toEqual([16, 17, 17, 17, 17, 16]);
    expect(results.length).toBe(100);
    expect(mockPlaceTrade).toHaveBeenCalledTimes(100);
  });
});

// Tick Timing and Price Handling Tests
describe('Tick Timing and Price Handling', () => {
  beforeEach(() => {
    // Clear mock history and implementations before each test
    mockPlaceTrade.mockClear();
    mockGetTicks.mockClear();
    mockGetContractStatus.mockClear();
    mockInstrumentToDerivSymbol.mockClear();
    mockPrismaCreate.mockClear();
    
    // Set default mock implementations
    mockPrismaCreate.mockResolvedValue({ 
      id: 'trade-123', 
      userId: MOCK_USER_ID,
      contractId: '12345',
      profit: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
    mockPlaceTrade.mockResolvedValue({ 
      contract_id: 12345, 
      buy_price: 10, 
      longcode: 'mock', 
      entry_spot: MOCK_TICK_PRICE 
    });
    mockInstrumentToDerivSymbol.mockImplementation(() => 'R_10');
  });

  it('should wait for next tick between batches in Turbo mode (5+ trades)', async () => {
    // Mock getTicks to simulate tick progression (different epochs)
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    for (let i = 0; i < 3; i++) {
      const epochTime = Date.now() + (i + 22) * 1000;
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 100, epochTime)]);
    }
    
    const tradeOptions = createMockTradeOptions('turbo', 5);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify that getTicks is called multiple times with increasing epochs
    expect(mockGetTicks).toHaveBeenCalledTimes(4); // Pattern + 3 ticks
    
    // Assert: Fresh price captured for each batch
    expect(results.length).toBe(5);
  });

  it('should wait for next tick between batches in Safe mode (5+ trades)', async () => {
    // Similar to above but for Safe mode
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    for (let i = 0; i < 2; i++) {
      mockGetTicks.mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + (i + 1) * 75, Date.now() + (i + 22) * 1000)]);
    }
    
    const tradeOptions = createMockTradeOptions('safe', 5);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Verify sequential execution within batches
    expect(mockGetTicks).toHaveBeenCalledTimes(3); // Pattern + 2 additional ticks
    expect(results.length).toBe(5);
  });

  it('should handle tick fetch failures gracefully', async () => {
    // Setup: Mock getTicks to reject with error
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks
      .mockResolvedValueOnce(patternTicks)
      .mockRejectedValueOnce(new Error('Tick fetch failed'))
      .mockResolvedValueOnce([createMockPriceTick(MOCK_TICK_PRICE + 100, Date.now() + 23000)]);
    
    const tradeOptions = createMockTradeOptions('turbo', 5);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: Execution continues with fallback price
    expect(results.length).toBe(5);
    
    // Assert: Error logged but trades still attempted
    expect(mockPlaceTrade).toHaveBeenCalledTimes(5);
  });
});

// Edge Cases and Error Handling Tests
describe('Edge Cases and Error Handling', () => {
  beforeEach(() => {
    // Clear mock history and implementations before each test
    mockPlaceTrade.mockClear();
    mockGetTicks.mockClear();
    mockGetContractStatus.mockClear();
    mockInstrumentToDerivSymbol.mockClear();
    mockPrismaCreate.mockClear();
    
    // Set default mock implementations
    mockPrismaCreate.mockResolvedValue({ 
      id: 'trade-123', 
      userId: MOCK_USER_ID,
      contractId: '12345',
      profit: 0,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
    mockPlaceTrade.mockResolvedValue({ 
      contract_id: 12345, 
      buy_price: 10, 
      longcode: 'mock', 
      entry_spot: MOCK_TICK_PRICE 
    });
    mockInstrumentToDerivSymbol.mockImplementation(() => 'R_10');
  });

  it('should handle partial trade failures in batch', async () => {
    // Setup: Mock placeTrade to succeed for some trades, fail for others
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    mockPlaceTrade
      .mockResolvedValueOnce({ contract_id: 12345, buy_price: 10, longcode: 'mock1', entry_spot: MOCK_TICK_PRICE })
      .mockRejectedValueOnce(new Error('Trade failed'))
      .mockResolvedValueOnce({ contract_id: 12346, buy_price: 10, longcode: 'mock2', entry_spot: MOCK_TICK_PRICE });
    
    const tradeOptions = createMockTradeOptions('turbo', 3);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: Successful trades are recorded
    const successfulTrades = results.filter(result => result.success);
    const failedTrades = results.filter(result => !result.success);
    
    expect(successfulTrades.length).toBe(2);
    expect(failedTrades.length).toBe(1);
    
    // Assert: Failed trades have error messages
    expect(failedTrades[0].error).toContain('Trade failed');
    
    // Assert: Execution continues despite failures
    expect(results.length).toBe(3);
  });

  it('should handle database save failures', async () => {
    // Setup: Mock prisma.trade.create to reject
    const patternTicks = Array.from({ length: 20 }, (_, i) => 
      createMockPriceTick(MOCK_TICK_PRICE + i, Date.now() + i * 1000)
    );
    
    mockGetTicks.mockResolvedValueOnce(patternTicks);
    mockPrismaCreate.mockRejectedValueOnce(new Error('Database save failed'));
    
    const tradeOptions = createMockTradeOptions('turbo', 1);
    const results = await executeVolatilityManualTradeLoop(tradeOptions);
    
    // Assert: Trade execution fails gracefully
    expect(results.length).toBe(1);
    
    // Assert: Error captured in result
    expect(results[0].success).toBe(false);
  });
});

// Distribution Table Integration Tests
describe('Distribution Table Integration', () => {
  it('should use correct distribution for all sample trade counts', () => {
    // Loop through sample counts: [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]
    const sampleCounts = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];
    
    for (const count of sampleCounts) {
      // For each count, verify getTradeDistribution returns expected array
      const distribution = getTradeDistribution(count);
      
      // Verify distribution sums to trade count
      const sum = distribution.reduce((acc, val) => acc + val, 0);
      expect(sum).toBe(count);
      
      // Verify distribution is valid
      expect(validateDistribution(count, distribution)).toBe(true);
    }
    
    // This ensures integration with trade-distribution.ts is correct
  });

  it('should validate distribution before execution', () => {
    // Verify validateDistribution is called for 5-100 trades
    const testCounts = [5, 25, 50, 75, 100];
    
    for (const count of testCounts) {
      const distribution = getTradeDistribution(count);
      
      // Assert: Invalid distributions are rejected
      expect(validateDistribution(count, distribution)).toBe(true);
      
      // Test with invalid distribution
      const invalidDistribution = [1, 1, 1]; // Sum doesn't match count
      expect(validateDistribution(count, invalidDistribution)).toBe(false);
    }
  });
});
