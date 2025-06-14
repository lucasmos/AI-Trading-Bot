import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutomatedTradingControls } from './AutomatedTradingControls';
import { getCandles } from '@/services/deriv';
import { calculateAllIndicators } from '@/lib/technical-analysis';
import { generateAutomatedTradingStrategy } from '@/ai/flows/automated-trading-strategy-flow';
import { executeAiTradingStrategy } from '@/app/actions/trade-execution-actions';
import { useToast } from '@/hooks/use-toast';
import { CandleData, InstrumentIndicatorData, PriceTick, AutomatedTradingStrategyOutput, TradeExecutionResult, ForexCryptoCommodityInstrumentType } from '@/types';

// Mock services and hooks
jest.mock('@/services/deriv');
jest.mock('@/lib/technical-analysis');
jest.mock('@/ai/flows/automated-trading-strategy-flow');
jest.mock('@/app/actions/trade-execution-actions');
jest.mock('@/hooks/use-toast');
jest.mock('next-auth/react'); // Mock useSession

const mockGetCandles = getCandles as jest.MockedFunction<typeof getCandles>;
const mockCalculateAllIndicators = calculateAllIndicators as jest.MockedFunction<typeof calculateAllIndicators>;
const mockGenerateAutomatedTradingStrategy = generateAutomatedTradingStrategy as jest.MockedFunction<typeof generateAutomatedTradingStrategy>;
const mockExecuteAiTradingStrategy = executeAiTradingStrategy as jest.MockedFunction<typeof executeAiTradingStrategy>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

// Sample data
const MOCK_MANUAL_API_TOKEN = 'manual-test-token';
const MOCK_SESSION_TOKEN = 'session-test-token';
const MOCK_EURUSD_CANDLES: CandleData[] = [{ epoch: 1, open: 1, high: 1, low: 1, close: 1.1234, time: 't1' }];
const MOCK_BTCUSD_CANDLES: CandleData[] = [{ epoch: 1, open: 1, high: 1, low: 1, close: 40000, time: 't1' }];
const MOCK_EURUSD_INDICATORS: InstrumentIndicatorData = { rsi: 50, ema: 1.1200 };
const MOCK_BTCUSD_INDICATORS: InstrumentIndicatorData = { rsi: 60, ema: 39000 };
const MOCK_AI_STRATEGY: AutomatedTradingStrategyOutput = {
  tradesToExecute: [{ instrument: 'EUR/USD', action: 'CALL', stake: 10, durationSeconds: 60, reasoning: 'AI says so' }],
  overallReasoning: 'Overall good',
};
const MOCK_EXECUTION_RESULTS: TradeExecutionResult[] = [{ success: true, instrument: 'EUR/USD', tradeResponse: { contract_id: 123, buy_price: 10, longcode: 'lc', entry_spot: 1.1234 } }];


describe('AutomatedTradingControls - Live Data', () => {
  let mockToast: jest.Mock;

  beforeEach(() => {
    mockToast = jest.fn();
    mockUseToast.mockReturnValue({ toast: mockToast });

    mockGetCandles.mockReset();
    mockCalculateAllIndicators.mockReset();
    mockGenerateAutomatedTradingStrategy.mockReset();
    mockExecuteAiTradingStrategy.mockReset();
    mockUseSession.mockReset();

    // Default to unauthenticated session unless overridden
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    // Default success mocks for AI and execution
    mockGenerateAutomatedTradingStrategy.mockResolvedValue(MOCK_AI_STRATEGY);
    mockExecuteAiTradingStrategy.mockResolvedValue(MOCK_EXECUTION_RESULTS);
  });

  test('successfully fetches data using MANUAL token, calculates indicators, and calls AI strategy', async () => {
    mockGetCandles
      .mockImplementation(async (instrument: ForexCryptoCommodityInstrumentType, count, granularity, token) => {
        if (instrument === 'EUR/USD') return MOCK_EURUSD_CANDLES;
        if (instrument === 'BTC/USD') return MOCK_BTCUSD_CANDLES;
        return [];
      });
    mockCalculateAllIndicators
      .mockImplementation((candles: CandleData[]) => {
        if (candles === MOCK_EURUSD_CANDLES) return MOCK_EURUSD_INDICATORS;
        if (candles === MOCK_BTCUSD_CANDLES) return MOCK_BTCUSD_INDICATORS;
        return {};
      });

    render(<AutomatedTradingControls />);

    // Simulate manual token input
    fireEvent.change(screen.getByLabelText(/Deriv API Token/i), { target: { value: MOCK_MANUAL_API_TOKEN } });
    fireEvent.click(screen.getByText('EUR/USD')); // Select EUR/USD
    fireEvent.click(screen.getByText('Start Automated Trading'));

    // Check for loading states and service calls
    expect(screen.getByText('Fetching Market Data...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetCandles).toHaveBeenCalledWith('EUR/USD', 150, 60, MOCK_MANUAL_API_TOKEN);
    });
    await waitFor(() => {
      expect(mockCalculateAllIndicators).toHaveBeenCalledWith(MOCK_EURUSD_CANDLES); // Assuming MOCK_EURUSD_CANDLES is returned by getCandles for EUR/USD
    });

    await waitFor(() => {
        // Button text changes through states
        expect(screen.getByText('AI Processing...')).toBeInTheDocument();
        expect(mockGenerateAutomatedTradingStrategy).toHaveBeenCalledWith(
          expect.objectContaining({
            instrumentTicks: { 'EUR/USD': [{ epoch: 1, price: 1.1234, time: 't1' }] },
            instrumentIndicators: { 'EUR/USD': MOCK_EURUSD_INDICATORS },
            instruments: ['EUR/USD']
          })
        );
    });

    await waitFor(() => {
        expect(screen.getByText('Executing Trades...')).toBeInTheDocument();
        expect(mockExecuteAiTradingStrategy).toHaveBeenCalledWith(MOCK_AI_STRATEGY, MOCK_MANUAL_API_TOKEN);
    });

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Trade Success: EUR/USD' })));
  });

  test('handles getCandles failure for one instrument (with manual token) and proceeds with valid data', async () => {
    mockGetCandles
      .mockImplementation(async (instrument: ForexCryptoCommodityInstrumentType, count, granularity, token) => {
        if (instrument === 'EUR/USD') return MOCK_EURUSD_CANDLES;
        if (instrument === 'BTC/USD') throw new Error('BTC/USD fetch failed');
        return [];
      });
    mockCalculateAllIndicators.mockImplementation((candles: CandleData[]) => {
        // Ensure it's only called with EUR/USD candles and returns EUR/USD indicators
        if(candles[0].close === MOCK_EURUSD_CANDLES[0].close) return MOCK_EURUSD_INDICATORS;
        return {};
    });

    render(<AutomatedTradingControls />);

    fireEvent.change(screen.getByLabelText(/Deriv API Token/i), { target: { value: MOCK_MANUAL_API_TOKEN } });
    fireEvent.click(screen.getByText('EUR/USD'));
    fireEvent.click(screen.getByText('BTC/USD')); // Select both
    fireEvent.click(screen.getByText('Start Automated Trading'));

    await waitFor(() => {
      expect(mockGetCandles).toHaveBeenCalledWith('EUR/USD', 150, 60, MOCK_MANUAL_API_TOKEN);
      expect(mockGetCandles).toHaveBeenCalledWith('BTC/USD', 150, 60, MOCK_MANUAL_API_TOKEN);
    });

    await waitFor(() => {
      expect(mockCalculateAllIndicators).toHaveBeenCalledWith(MOCK_EURUSD_CANDLES);
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Data Error',
        description: 'Failed to fetch data for BTC/USD: BTC/USD fetch failed',
        variant: 'destructive'
      }));
    });

    await waitFor(() => {
      expect(mockGenerateAutomatedTradingStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          instrumentIndicators: { 'EUR/USD': MOCK_EURUSD_INDICATORS },
          instruments: ['EUR/USD']
        })
      );
    });
  });

  test('uses session token if available and no manual token is input', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { derivAccessToken: MOCK_SESSION_TOKEN } } as any,
      status: 'authenticated',
    });
    mockGetCandles.mockResolvedValue(MOCK_EURUSD_CANDLES);
    mockCalculateAllIndicators.mockReturnValue(MOCK_EURUSD_INDICATORS);

    render(<AutomatedTradingControls />);

    // Verify placeholder indicates session token
    expect(screen.getByPlaceholderText("Deriv session token active (override to change)")).toBeInTheDocument();

    fireEvent.click(screen.getByText('EUR/USD'));
    fireEvent.click(screen.getByText('Start Automated Trading'));

    await waitFor(() => {
      expect(mockGetCandles).toHaveBeenCalledWith('EUR/USD', 150, 60, MOCK_SESSION_TOKEN);
    });
    await waitFor(() => {
      expect(mockExecuteAiTradingStrategy).toHaveBeenCalledWith(MOCK_AI_STRATEGY, MOCK_SESSION_TOKEN);
    });
  });

  test('manual token input overrides session token', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { derivAccessToken: 'should-be-overridden-token' } } as any,
      status: 'authenticated',
    });
    mockGetCandles.mockResolvedValue(MOCK_EURUSD_CANDLES);
    mockCalculateAllIndicators.mockReturnValue(MOCK_EURUSD_INDICATORS);

    render(<AutomatedTradingControls />);

    // User types a different token
    fireEvent.change(screen.getByLabelText(/Deriv API Token/i), { target: { value: MOCK_MANUAL_API_TOKEN } });
    // Placeholder should revert
    expect(screen.getByPlaceholderText("Enter your Deriv API Token")).toBeInTheDocument();


    fireEvent.click(screen.getByText('EUR/USD'));
    fireEvent.click(screen.getByText('Start Automated Trading'));

    await waitFor(() => {
      expect(mockGetCandles).toHaveBeenCalledWith('EUR/USD', 150, 60, MOCK_MANUAL_API_TOKEN);
    });
     await waitFor(() => {
      expect(mockExecuteAiTradingStrategy).toHaveBeenCalledWith(MOCK_AI_STRATEGY, MOCK_MANUAL_API_TOKEN);
    });
  });

  test('displays "Authenticating Session..." when session is loading', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    render(<AutomatedTradingControls />);
    expect(screen.getByText('Authenticating Session...')).toBeInTheDocument();
    expect(screen.getByText('Start Automated Trading').closest('button')).toBeDisabled();
  });

  test('displays guidance message when unauthenticated and no manual token', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<AutomatedTradingControls />);
    expect(screen.getByText(/Please sign in with Deriv or enter an API token manually/i)).toBeInTheDocument();
    expect(screen.getByText('Start Automated Trading').closest('button')).toBeDisabled(); // Also disabled due to no token
  });

});
