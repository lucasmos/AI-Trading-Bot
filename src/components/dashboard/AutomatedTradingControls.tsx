'use client';

import React, { useState, useEffect } from 'react'; // Added useEffect
import { useSession } from 'next-auth/react'; // Import useSession
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ForexCryptoCommodityInstrumentType,
  TradingMode,
  AutomatedTradingStrategyOutput,
  CandleData, // Import CandleData
  InstrumentIndicatorData, // Import InstrumentIndicatorData
  PriceTick // Import PriceTick
} from '@/types';
import { generateAutomatedTradingStrategy } from '@/ai/flows/automated-trading-strategy-flow';
import { executeAiTradingStrategy, TradeExecutionResult } from '@/app/actions/trade-execution-actions';
import { useToast } from '@/hooks/use-toast';
import { getCandles } from '@/services/deriv'; // Import getCandles
import { calculateAllIndicators } from '@/lib/technical-analysis'; // Import calculateAllIndicators

const AVAILABLE_INSTRUMENTS: ForexCryptoCommodityInstrumentType[] = [
  'EUR/USD', 'GBP/USD', 'BTC/USD', 'XAU/USD',
  'ETH/USD', 'Palladium/USD', 'Platinum/USD', 'Silver/USD',
];
const TRADING_MODES: TradingMode[] = ['conservative', 'balanced', 'aggressive'];

// Define a type for the market data state
type MarketDataState = Record<ForexCryptoCommodityInstrumentType, {
  candles: CandleData[];
  indicators?: InstrumentIndicatorData;
  error?: string;
}>;

export function AutomatedTradingControls() {
  const { toast } = useToast();

  const [apiToken, setApiToken] = useState<string>('');
  const [totalStake, setTotalStake] = useState<number>(10);
  const [selectedInstruments, setSelectedInstruments] = useState<ForexCryptoCommodityInstrumentType[]>([]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [stopLossPercentage, setStopLossPercentage] = useState<number | undefined>(5);

  const [isFetchingData, setIsFetchingData] = useState<boolean>(false);
  const [isProcessingAi, setIsProcessingAi] = useState<boolean>(false);
  const [isExecutingTrades, setIsExecutingTrades] = useState<boolean>(false);

  const [marketData, setMarketData] = useState<MarketDataState>({});
  const [executionResults, setExecutionResults] = useState<TradeExecutionResult[]>([]);
  const [aiReasoning, setAiReasoning] = useState<string>('');

  // Session
  const { data: session, status: sessionStatus } = useSession();
  const [isTokenFromSession, setIsTokenFromSession] = useState<boolean>(false);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.derivAccessToken) {
      // Only set from session if apiToken is currently empty
      // or if it was previously set by the session (to allow session updates)
      if (apiToken === '' || isTokenFromSession) {
        setApiToken(session.user.derivAccessToken as string); // Assuming derivAccessToken is string
        setIsTokenFromSession(true);
      }
    } else if (sessionStatus !== 'loading' && isTokenFromSession) {
      // If session becomes unauthenticated or token disappears, and token was from session, clear it
      // setApiToken(''); // Optional: decide if you want to clear it or leave manual input
      // setIsTokenFromSession(false); // Handled by manual input change
    }
  }, [session, sessionStatus, apiToken, isTokenFromSession]); // Add apiToken and isTokenFromSession to deps


  const isBusy = isFetchingData || isProcessingAi || isExecutingTrades || sessionStatus === 'loading';

  const handleInstrumentChange = (instrument: ForexCryptoCommodityInstrumentType) => {
    setSelectedInstruments(prev =>
      prev.includes(instrument)
        ? prev.filter(item => item !== instrument)
        : [...prev, instrument]
    );
  };

  const fetchMarketDataForSelectedInstruments = async (currentToken: string): Promise<boolean> => {
    if (!currentToken) {
      console.error('[fetchMarketData] Attempted to fetch market data without a valid API token.');
      toast({ title: 'Internal Error', description: 'API token was missing when fetching data.', variant: 'destructive' });
      setIsFetchingData(false); // Ensure loading state is reset
      return false;
    }
    if (selectedInstruments.length === 0) return true; // No data to fetch

    setIsFetchingData(true);
    toast({ title: 'Fetching Market Data...', description: `Fetching candles for ${selectedInstruments.join(', ')}.` });

    const newMarketData: MarketDataState = {};
    let allFetchesSuccessful = true;

    for (const instrument of selectedInstruments) {
      try {
        // Use the user's API token for fetching candles
        const candles = await getCandles(instrument, 150, 60, currentToken); // Fetch 150 1-min candles
        if (candles && candles.length > 0) {
          const indicators = calculateAllIndicators(candles);
          newMarketData[instrument] = { candles, indicators };
        } else {
          newMarketData[instrument] = { candles: [], error: 'No candle data returned.' };
          toast({ title: 'Data Warning', description: `No candle data for ${instrument}.`, variant: 'default' });
          allFetchesSuccessful = false; // Mark as partially successful if some data is missing
        }
      } catch (error: any) {
        console.error(`Error fetching market data for ${instrument}:`, error);
        newMarketData[instrument] = { candles: [], error: error.message || 'Failed to fetch data.' };
        toast({ title: 'Data Error', description: `Failed to fetch data for ${instrument}: ${error.message}`, variant: 'destructive' });
        allFetchesSuccessful = false; // Definitely not fully successful
      }
    }
    setMarketData(newMarketData);
    setIsFetchingData(false);

    if (Object.values(newMarketData).every(d => d.error && d.candles.length === 0)) {
        toast({ title: 'Market Data Error', description: 'Failed to fetch market data for all selected instruments.', variant: 'destructive'});
        return false; // All fetches failed critically
    }
    // If some data was fetched, it might still be okay to proceed
    return true;
  };


  const handleStartAutomatedTrading = async () => {
    if (!apiToken) {
      toast({ title: 'Error', description: 'Deriv API Token is required.', variant: 'destructive' });
      return;
    }
    if (selectedInstruments.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one instrument.', variant: 'destructive' });
      return;
    }
    if (totalStake < 1) {
        toast({ title: 'Error', description: 'Total stake must be at least 1.', variant: 'destructive' });
        return;
    }

    setExecutionResults([]);
    setAiReasoning('');

    // 1. Fetch live market data and calculate indicators
    const dataFetchSuccess = await fetchMarketDataForSelectedInstruments(apiToken);
    if (!dataFetchSuccess) {
      // Error messages already toasted by fetchMarketDataForSelectedInstruments
      return;
    }

    // Prepare data for AI: instrumentTicks and instrumentIndicators
    const instrumentTicksForAi: Record<ForexCryptoCommodityInstrumentType, PriceTick[]> = {};
    const instrumentIndicatorsForAi: Record<ForexCryptoCommodityInstrumentType, InstrumentIndicatorData> = {};
    let hasDataForAtLeastOneInstrument = false;

    for (const instrument of selectedInstruments) {
      const currentInstrumentData = marketData[instrument]; // Use a local variable for current instrument's data
      if (currentInstrumentData && !currentInstrumentData.error && currentInstrumentData.candles.length > 0) {
        // Convert CandleData to PriceTick[] for the AI (using closing prices)
        instrumentTicksForAi[instrument] = currentInstrumentData.candles.map(c => ({ epoch: c.epoch, price: c.close, time: c.time }));
        if (currentInstrumentData.indicators) {
          instrumentIndicatorsForAi[instrument] = currentInstrumentData.indicators;
        }
        hasDataForAtLeastOneInstrument = true;
      }
    }

    if (!hasDataForAtLeastOneInstrument) {
        toast({ title: 'AI Strategy Halted', description: 'No valid market data available to generate a strategy.', variant: 'destructive' });
        return;
    }

    setIsProcessingAi(true);
    try {
      toast({ title: 'AI Thinking...', description: 'Generating trading strategy with live data.' });
      const strategyInput = {
        totalStake,
        instruments: selectedInstruments.filter(inst => marketData[inst] && !marketData[inst].error && marketData[inst].candles.length > 0), // Only pass instruments with data
        tradingMode,
        stopLossPercentage: stopLossPercentage || undefined,
        instrumentTicks: instrumentTicksForAi,
        instrumentIndicators: instrumentIndicatorsForAi,
      };

      const aiStrategy: AutomatedTradingStrategyOutput = await generateAutomatedTradingStrategy(strategyInput as any);
      setAiReasoning(aiStrategy.overallReasoning);

      if (!aiStrategy || !aiStrategy.tradesToExecute || aiStrategy.tradesToExecute.length === 0) {
        toast({ title: 'AI Strategy', description: 'AI did not propose any trades based on current live data.', variant: 'default' });
        setIsProcessingAi(false);
        return;
      }

      toast({ title: 'AI Strategy Generated', description: `AI proposed ${aiStrategy.tradesToExecute.length} trade(s). Executing now...` });
      setIsProcessingAi(false); // Done with AI part

      // 2. Execute Trades
      setIsExecutingTrades(true);
      const results = await executeAiTradingStrategy(aiStrategy, apiToken);
      setExecutionResults(results);

      results.forEach(result => {
        if (result.success) {
          toast({
            title: `Trade Success: ${result.instrument}`,
            description: `Contract ID: ${result.tradeResponse?.contract_id}, Buy Price: ${result.tradeResponse?.buy_price}`,
          });
        } else {
          toast({
            title: `Trade Failed: ${result.instrument}`,
            description: result.error,
            variant: 'destructive',
          });
        }
      });

    } catch (error: any) {
      console.error('Error during AI strategy generation or trade execution:', error);
      toast({ title: 'Error', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsProcessingAi(false);
      setIsExecutingTrades(false);
    }
  };

  // UI remains largely the same, but button disabled state uses `isBusy`
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Automated Trading (Live Data)</CardTitle>
        <CardDescription>Configure and start AI-powered automated trading with your Deriv account using live market data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* API Token Input */}
        <div className="space-y-2">
          <Label htmlFor="apiToken">Deriv API Token</Label>
          <Input
            id="apiToken"
            type="password"
            placeholder={isTokenFromSession && apiToken ? "Deriv session token active (override to change)" : "Enter your Deriv API Token"}
            value={apiToken}
            onChange={(e) => { setApiToken(e.target.value); setIsTokenFromSession(false); }}
            disabled={isBusy}
          />
          <p className="text-xs text-muted-foreground">
            Uses token from your Deriv session if logged in. Manually enter a token here to override.
          </p>
        </div>

        {/* Strategy Configuration */}
        <div className="space-y-2">
          <Label htmlFor="totalStake">Total Stake (USD)</Label>
          <Input
            id="totalStake"
            type="number"
            min="1"
            value={totalStake}
            onChange={(e) => setTotalStake(parseFloat(e.target.value))}
            disabled={isBusy}
          />
        </div>

        <div className="space-y-2">
          <Label>Select Instruments</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AVAILABLE_INSTRUMENTS.map(instrument => (
              <Button
                key={instrument}
                variant={selectedInstruments.includes(instrument) ? 'default' : 'outline'}
                onClick={() => handleInstrumentChange(instrument)}
                disabled={isBusy}
                size="sm"
              >
                {instrument}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tradingMode">Trading Mode</Label>
          <Select
            value={tradingMode}
            onValueChange={(value: string) => setTradingMode(value as TradingMode)}
            disabled={isBusy}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select trading mode" />
            </SelectTrigger>
            <SelectContent>
              {TRADING_MODES.map(mode => (
                <SelectItem key={mode} value={mode}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stopLossPercentage">Stop-Loss Percentage (Optional, 1-50%)</Label>
          <Input
            id="stopLossPercentage"
            type="number"
            min="1"
            max="50"
            placeholder="e.g., 5 for 5%"
            value={stopLossPercentage === undefined ? '' : stopLossPercentage}
            onChange={(e) => {
              const val = e.target.value;
              setStopLossPercentage(val === '' ? undefined : parseFloat(val));
            }}
            disabled={isBusy}
          />
        </div>

        {/* Control Button */}
        <Button
          onClick={handleStartAutomatedTrading}
          disabled={isBusy || sessionStatus === 'loading' || !apiToken || selectedInstruments.length === 0}
          className="w-full"
        >
          {(() => {
            if (sessionStatus === 'loading') return 'Authenticating Session...';
            if (isFetchingData) return 'Fetching Market Data...';
            if (isProcessingAi) return 'AI Processing...';
            if (isExecutingTrades) return 'Executing Trades...';
            return 'Start Automated Trading';
          })()}
        </Button>
        {sessionStatus === 'unauthenticated' && !apiToken && (
          <p className="text-sm text-center text-amber-600 dark:text-amber-500 mt-2">
            Please sign in with Deriv or enter an API token manually to enable trading.
          </p>
        )}
      </CardContent>

      {/* Status Display (market data errors can also be shown here if desired) */}
      {(aiReasoning || executionResults.length > 0 || Object.values(marketData).some(d => d.error)) && (
        <CardFooter className="flex flex-col items-start space-y-4">
          {Object.entries(marketData).map(([instrument, data]) =>
            data.error ? (
              <div key={instrument} className="text-red-500 text-sm">
                Market Data Error for {instrument}: {data.error}
              </div>
            ) : null
          )}
          {aiReasoning && (
            <div>
              <h4 className="font-semibold mb-2">AI Overall Reasoning:</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiReasoning}</p>
            </div>
          )}
          {executionResults.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Trade Execution Results:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {executionResults.map((result, index) => (
                  <li key={index} className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    Instrument: {result.instrument} - {result.success ? 'Success' : 'Failed'}
                    {result.success && result.tradeResponse && ` (Contract ID: ${result.tradeResponse.contract_id})`}
                    {result.error && ` - Error: ${result.error}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
