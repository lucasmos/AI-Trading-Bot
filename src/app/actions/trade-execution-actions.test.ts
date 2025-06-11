import { executeAiTradingStrategy, TradeExecutionResult } from './trade-execution-actions';
import { AutomatedTradingStrategyOutput, AutomatedTradeProposal, ForexCryptoCommodityInstrumentType } from '@/types';
import { placeTrade, TradeDetails, PlaceTradeResponse, instrumentToDerivSymbol } from '@/services/deriv';

// Mock dependencies
jest.mock('@/services/deriv', () => ({
  ...jest.requireActual('@/services/deriv'), // Import and retain default exports
  placeTrade: jest.fn(),
  instrumentToDerivSymbol: jest.fn((instrument: ForexCryptoCommodityInstrumentType) => {
    // Simple mock implementation for testing
    if (instrument === 'EUR/USD') return 'frxEURUSD';
    if (instrument === 'BTC/USD') return 'cryBTCUSD';
    return `mock_${instrument}`;
  }),
}));

const mockPlaceTrade = placeTrade as jest.MockedFunction<typeof placeTrade>;
const mockInstrumentToDerivSymbol = instrumentToDerivSymbol as jest.MockedFunction<typeof instrumentToDerivSymbol>;

describe('executeAiTradingStrategy', () => {
  const mockUserToken = 'test-token-123';

  beforeEach(() => {
    // Clear mock history and implementations before each test
    mockPlaceTrade.mockClear();
    mockInstrumentToDerivSymbol.mockClear();
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
