'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'; // For confirmation display
import { ScrollArea } from '@/components/ui/scroll-area'; // For long reasoning or many trades

import {
  ForexCryptoCommodityInstrumentType,
  TradingMode,
  AutomatedTradingStrategyOutput,
  CandleData,
  InstrumentIndicatorData,
  PriceTick
} from '@/types';
import { generateAutomatedTradingStrategy } from '@/ai/flows/automated-trading-strategy-flow';
import { executeAiTradingStrategy, TradeExecutionResult } from '@/app/actions/trade-execution-actions';
import { useToast } from '@/hooks/use-toast';
import { getCandles } from '@/services/deriv';
import { calculateAllIndicators } from '@/lib/technical-analysis';

const AVAILABLE_INSTRUMENTS: ForexCryptoCommodityInstrumentType[] = [
  'EUR/USD', 'GBP/USD', 'BTC/USD', 'XAU/USD',
  'ETH/USD', 'Palladium/USD', 'Platinum/USD', 'Silver/USD',
];
const TRADING_MODES: TradingMode[] = ['conservative', 'balanced', 'aggressive'];

type MarketDataState = Record<ForexCryptoCommodityInstrumentType, {
  candles: CandleData[];
  indicators?: InstrumentIndicatorData;
  error?: string;
}>;

/**
 * Provides an interactive AI-powered automated trading interface using live market data and Deriv API integration.
 *
 * Users can configure trading parameters, fetch real-time market data, generate AI trading strategies, review proposed trades, and execute them upon confirmation. The component manages authentication, market data retrieval, AI strategy generation, trade execution, and displays detailed feedback and results throughout the process.
 *
 * @remark The trading flow is explicitly separated into two phases: AI strategy generation and user confirmation before execution. No trades are executed without explicit user approval.
 */
export function AutomatedTradingControls() {
  const { toast } = useToast();
  const { data: session, status: sessionStatus } = useSession();

  const [apiToken, setApiToken] = useState<string>('');
  const [totalStake, setTotalStake] = useState<number>(10);
  const [selectedInstruments, setSelectedInstruments] = useState<ForexCryptoCommodityInstrumentType[]>([]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [stopLossPercentage, setStopLossPercentage] = useState<number | undefined>(5);
  const [aiStrategyId, setAiStrategyId] = useState<string | undefined>(undefined);

  // State flags to manage UI busy states during different phases of automated trading.
  const [isFetchingData, setIsFetchingData] = useState<boolean>(false); // True when fetching market data (candles, indicators).
  const [isProcessingAi, setIsProcessingAi] = useState<boolean>(false); // True when the AI is generating a trading strategy.
  const [isExecutingTrades, setIsExecutingTrades] = useState<boolean>(false); // True when confirmed trades are being sent to the backend for execution.

  const [marketData, setMarketData] = useState<MarketDataState>({}); // Stores fetched candle and indicator data for selected instruments.
  const [executionResults, setExecutionResults] = useState<TradeExecutionResult[]>([]); // Stores results of executed trades.
  const [aiReasoning, setAiReasoning] = useState<string>(''); // Stores the overall reasoning from the AI strategy.
  const [isTokenFromSession, setIsTokenFromSession] = useState<boolean>(false); // Tracks if the API token is from the user's session.

  // State variables for managing the AI trade confirmation dialog.
  // This ensures user review before any AI-proposed trades are executed.
  const [aiStrategyForConfirmation, setAiStrategyForConfirmation] = useState<AutomatedTradingStrategyOutput | null>(null); // Stores the AI-generated strategy awaiting confirmation.
  const [showAiConfirmationDialog, setShowAiConfirmationDialog] = useState<boolean>(false); // Controls visibility of the confirmation dialog.


  useEffect(() => {
    // Auto-fill API token from session if available and not manually overridden.
    if (sessionStatus === 'authenticated' && session?.user?.derivAccessToken) {
      if (apiToken === '' || isTokenFromSession) { // Only set if apiToken is empty or was previously set from session
        setApiToken(session.user.derivAccessToken as string); // Use token from session
        setIsTokenFromSession(true); // Mark that token is from session
      }
    }
  }, [session, sessionStatus, apiToken, isTokenFromSession]); // Rerun if session, status, or local token state changes.

  // Combined busy state for disabling UI elements during critical operations.
  const isBusy = isFetchingData || isProcessingAi || isExecutingTrades || sessionStatus === 'loading';

  const handleInstrumentChange = (instrument: ForexCryptoCommodityInstrumentType) => {
    setSelectedInstruments(prev =>
      prev.includes(instrument)
        ? prev.filter(item => item !== instrument)
        : [...prev, instrument]
    );
  };

  interface FetchMarketDataResult {
    success: boolean;
    successfulInstruments: ForexCryptoCommodityInstrumentType[];
    failedInstruments: ForexCryptoCommodityInstrumentType[];
  }

  const fetchMarketDataForSelectedInstruments = async (currentToken: string): Promise<FetchMarketDataResult> => {
    const result: FetchMarketDataResult = {
      success: false,
      successfulInstruments: [],
      failedInstruments: [],
    };

    if (!currentToken) {
      toast({ title: 'Internal Error', description: 'API token missing for data fetch.', variant: 'destructive' });
      return result; // Early return with success: false
    }
    if (selectedInstruments.length === 0) {
      result.success = true; // No instruments selected, technically a success.
      return result;
    }

    setIsFetchingData(true);
    toast({ title: 'Fetching Market Data...', description: `Fetching candles for ${selectedInstruments.join(', ')}.` });

    const newMarketData: MarketDataState = {};
    const promises = selectedInstruments.map(async (instrument) => {
      try {
        const candles = await getCandles(instrument, 150, 60, currentToken);
        if (candles && candles.length > 0) {
          const indicators = calculateAllIndicators(candles);
          newMarketData[instrument] = { candles, indicators };
          result.successfulInstruments.push(instrument);
        } else {
          newMarketData[instrument] = { candles: [], error: 'No candle data returned.' };
          result.failedInstruments.push(instrument);
        }
      } catch (error: any) {
        newMarketData[instrument] = { candles: [], error: error.message || 'Failed to fetch data.' };
        result.failedInstruments.push(instrument);
      }
    });

    await Promise.all(promises); // Wait for all fetches to complete

    setMarketData(newMarketData); // Update state once after all fetches
    setIsFetchingData(false);

    if (result.successfulInstruments.length > 0) {
      result.success = true; // Success if at least one instrument's data was fetched
    }

    // Update toasts based on the outcome
    if (!result.success) {
      toast({ title: 'Market Data Error', description: 'Failed to fetch market data for all selected instruments.', variant: 'destructive'});
    } else if (result.failedInstruments.length > 0) {
      toast({ title: 'Partial Market Data', description: `Successfully fetched data for ${result.successfulInstruments.join(', ')}. Failed for ${result.failedInstruments.join(', ')}.`, variant: 'warning', duration: 7000 });
    } else {
      toast({ title: 'Market Data Fetched', description: `Successfully fetched data for all selected instruments.`, duration: 3000 });
    }

    return result;
  };

  // Handles the initiation of an automated trading session.
  // This involves several steps:
  // 1. Basic validation of inputs (API token, selected instruments, stake).
  // 2. Fetching market data (candles and indicators) for the selected instruments.
  // 3. If data fetching is successful (even partially), preparing the data for the AI.
  // 4. Calling the AI to generate a trading strategy.
  // 5. If the AI proposes trades, displaying them in a confirmation dialog for user review.
  //    If no trades are proposed, informing the user.
  const handleStartAutomatedTrading = async () => {
    // Initial validation checks
    if (!apiToken || selectedInstruments.length === 0 || totalStake < 1 || sessionStatus !== 'authenticated' || !session?.user?.id) {
      toast({ title: 'Error', description: 'Please ensure API token, selected instruments, and total stake are valid, and you are logged in.', variant: 'destructive' });
      return;
    }

    // Reset states from any previous session
    setExecutionResults([]);
    setAiReasoning('');
    setAiStrategyForConfirmation(null);
    setShowAiConfirmationDialog(false);

    // Step 1: Fetch market data for selected instruments.
    // `isFetchingData` will be true during this phase.
    const fetchResult = await fetchMarketDataForSelectedInstruments(apiToken);

    // If data fetching failed for all instruments or no instruments had successful data, halt.
    if (!fetchResult.success || fetchResult.successfulInstruments.length === 0) {
      toast({ title: 'AI Strategy Halted', description: 'No market data available for any selected instrument to proceed with strategy generation.', variant: 'destructive' });
      return;
    }

    // Use only instruments for which data was successfully fetched.
    const activeInstruments = fetchResult.successfulInstruments;

    // Notify user if proceeding with partial data.
    if (fetchResult.failedInstruments.length > 0) {
      toast({ title: 'Proceeding with Partial Data', description: `Generating AI strategy using data for: ${activeInstruments.join(', ')}. Failed for: ${fetchResult.failedInstruments.join(', ')}.`, variant: 'info', duration: 7000});
    }

    // Step 2: Prepare data (ticks and indicators) for the AI.
    const instrumentTicksForAi: Record<ForexCryptoCommodityInstrumentType, PriceTick[]> = {};
    const instrumentIndicatorsForAi: Record<ForexCryptoCommodityInstrumentType, InstrumentIndicatorData> = {};

    for (const instrument of activeInstruments) {
      const currentInstrumentData = marketData[instrument];
      // Data for `activeInstruments` should be valid as per `fetchResult` logic.
      if (currentInstrumentData && !currentInstrumentData.error && currentInstrumentData.candles.length > 0) {
        instrumentTicksForAi[instrument] = currentInstrumentData.candles.map(c => ({ epoch: c.epoch, price: c.close, time: c.time }));
        if (currentInstrumentData.indicators) {
          instrumentIndicatorsForAi[instrument] = currentInstrumentData.indicators;
        }
      } else {
        // This is a fallback/warning for an unlikely scenario where an instrument marked 'successful'
        // might still have missing data. This could indicate an issue in data handling upstream.
        console.warn(`Data integrity issue: Instrument ${instrument} was marked successful but has no valid data for AI input.`);
        toast({ title: 'Internal Warning', description: `Could not prepare AI data for supposedly successful instrument: ${instrument}. It will be skipped.`, variant: 'warning'});
      }
    }

    // If, after attempting to prepare data, no instruments have valid data for the AI, halt.
    if (Object.keys(instrumentTicksForAi).length === 0) {
        toast({ title: 'AI Strategy Halted', description: 'Failed to prepare any valid market data for the AI strategy generation.', variant: 'destructive' });
        return;
    }

    // Step 3: Call AI to generate trading strategy.
    // `isProcessingAi` will be true during this phase.
    setIsProcessingAi(true);
    try {
      toast({ title: 'AI Thinking...', description: `Generating trading strategy for ${activeInstruments.join(', ')}...` });

      const strategyInput = {
        totalStake,
        instruments: activeInstruments, // Pass only successfully processed instruments
        tradingMode,
        stopLossPercentage: stopLossPercentage || undefined,
        instrumentTicks: instrumentTicksForAi,
        instrumentIndicators: instrumentIndicatorsForAi,
        aiStrategyId: aiStrategyId, // Optional custom strategy ID
      };

      // Call the AI flow. This is an async operation.
      const aiStrategyResult: AutomatedTradingStrategyOutput = await generateAutomatedTradingStrategy(strategyInput as any); // `as any` if type mismatch, should be resolved ideally

      // Step 4: Handle AI strategy result.
      if (!aiStrategyResult || !aiStrategyResult.tradesToExecute || aiStrategyResult.tradesToExecute.length === 0) {
        // AI decided not to trade or no strategy was generated.
        setAiReasoning(aiStrategyResult?.overallReasoning || 'AI determined no optimal trades at this moment.');
        toast({ title: 'AI Strategy Update', description: aiStrategyResult?.overallReasoning || 'AI did not propose any trades.', variant: 'default' });
        // No confirmation dialog needed if no trades.
      } else {
        // AI proposed trades, set them up for user confirmation.
        setAiStrategyForConfirmation(aiStrategyResult); // Store the full strategy for confirmation and later execution.
        setAiReasoning(aiStrategyResult.overallReasoning); // Display overall reasoning.
        setShowAiConfirmationDialog(true); // Trigger the confirmation dialog.
        toast({ title: 'AI Strategy Ready', description: `AI proposed ${aiStrategyResult.tradesToExecute.length} trade(s). Please review and confirm.`, duration: 5000 });
      }
    } catch (error: any) {
      console.error('Error during AI strategy generation:', error);
      toast({ title: 'AI Strategy Error', description: error.message || 'An unexpected error occurred during AI strategy generation.', variant: 'destructive' });
    } finally {
      setIsProcessingAi(false); // AI processing is finished, whether successful or not.
    }
    // Note: Actual execution of trades (`executeAiTradingStrategy`) is handled by `handleExecuteConfirmedTrades`
    // after user confirms via the dialog.
  };

  // Handles the execution of trades that have been confirmed by the user via the AI strategy dialog.
  // `isExecutingTrades` will be true during this phase.
  const handleExecuteConfirmedTrades = async () => {
    if (!aiStrategyForConfirmation) {
      toast({ title: 'Error', description: 'No AI strategy available for confirmation.', variant: 'destructive' });
      return;
    }
    if (!apiToken || sessionStatus !== 'authenticated' || !session?.user?.id) {
      toast({ title: 'Authentication Error', description: 'User session or API token invalid.', variant: 'destructive' });
      return;
    }

    const {
      id: userId,
      selectedDerivAccountType: sessionSelectedAccountType,
      derivDemoAccountId,
      derivRealAccountId
    } = session.user;

    if (!sessionSelectedAccountType) {
      toast({ title: 'Account Type Error', description: 'No Deriv account type selected.', variant: 'destructive'});
      return;
    }
    const targetAccountId = sessionSelectedAccountType === 'demo' ? derivDemoAccountId : derivRealAccountId;
    if (!targetAccountId) {
      toast({ title: 'Account ID Error', description: `Deriv ${sessionSelectedAccountType} account ID not found.`, variant: 'destructive'});
      return;
    }

    setIsExecutingTrades(true);
    setShowAiConfirmationDialog(false); // Hide dialog once execution starts
    toast({ title: 'Executing Trades...', description: `Processing ${aiStrategyForConfirmation.tradesToExecute.length} AI proposed trade(s).` });

    try {
      const results = await executeAiTradingStrategy(
        aiStrategyForConfirmation,
        apiToken,
        targetAccountId,
        sessionSelectedAccountType as 'demo' | 'real',
        userId
      );
      setExecutionResults(results);

      results.forEach(result => {
        if (result.success) {
          toast({
            title: `Trade Success: ${result.instrument}`,
            description: `Deriv Contract ID: ${result.tradeResponse?.contract_id}, DB ID: ${result.dbTradeId}`,
          });
        } else {
          toast({ title: `Trade Failed: ${result.instrument}`, description: result.error, variant: 'destructive' });
        }
      });

      // Add summary toast
      const successfulPlacements = results.filter(r => r.success).length;
      const failedPlacements = results.length - successfulPlacements;
      toast({
        title: 'Automated Trading Concluded',
        description: `Trade placements: ${successfulPlacements} successful, ${failedPlacements} failed. Check results for details. (P/L updates as trades close).`,
        duration: 7000
      });

    } catch (error: any) {
      console.error('Error during confirmed trade execution:', error);
      toast({ title: 'Trade Execution Error', description: error.message || 'An unexpected error occurred during trade execution.', variant: 'destructive' });
    } finally {
      setIsExecutingTrades(false); // Trade execution phase is finished.
      setAiStrategyForConfirmation(null); // Clear the strategy from confirmation state.
    }
  };

  // Handles the cancellation of AI-proposed trades from the confirmation dialog.
  const handleCancelAiConfirmation = () => {
    setShowAiConfirmationDialog(false); // Hide the dialog.
    setAiStrategyForConfirmation(null); // Clear the stored strategy.
    setIsProcessingAi(false); // Ensure AI processing state is reset if it was stuck.
    setAiReasoning(''); // Optionally clear reasoning from main display.
    toast({ title: 'AI Trading Cancelled', description: 'Automated trading strategy was cancelled by the user.' });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Automated Trading (Live Data)</CardTitle>
        <CardDescription>Configure and start AI-powered automated trading with your Deriv account using live market data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration UI remains the same */}
        <div className="space-y-2">
          <Label htmlFor="apiToken">Deriv API Token</Label>
          <Input id="apiToken" type="password" placeholder={isTokenFromSession && apiToken ? "Deriv session token active (override to change)" : "Enter your Deriv API Token"} value={apiToken} onChange={(e) => { setApiToken(e.target.value); setIsTokenFromSession(false); }} disabled={isBusy || showAiConfirmationDialog} />
          <p className="text-xs text-muted-foreground">Uses token from your Deriv session if logged in. Manually enter to override.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalStake">Total Stake (USD)</Label>
          <Input id="totalStake" type="number" min="1" value={totalStake} onChange={(e) => setTotalStake(parseFloat(e.target.value))} disabled={isBusy || showAiConfirmationDialog} />
        </div>
        <div className="space-y-2">
          <Label>Select Instruments</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AVAILABLE_INSTRUMENTS.map(instrument => ( <Button key={instrument} variant={selectedInstruments.includes(instrument) ? 'default' : 'outline'} onClick={() => handleInstrumentChange(instrument)} disabled={isBusy || showAiConfirmationDialog} size="sm"> {instrument} </Button> ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tradingMode">Trading Mode</Label>
          <Select value={tradingMode} onValueChange={(value: string) => setTradingMode(value as TradingMode)} disabled={isBusy || showAiConfirmationDialog}>
            <SelectTrigger><SelectValue placeholder="Select trading mode" /></SelectTrigger>
            <SelectContent> {TRADING_MODES.map(mode => ( <SelectItem key={mode} value={mode}> {mode.charAt(0).toUpperCase() + mode.slice(1)} </SelectItem> ))} </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="aiStrategyId">AI Strategy (Optional)</Label>
          <Input id="aiStrategyId" placeholder="Default strategy" value={aiStrategyId || ''} onChange={(e) => setAiStrategyId(e.target.value)} disabled={isBusy || showAiConfirmationDialog} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stopLossPercentage">Stop-Loss Percentage (Optional, 1-50%)</Label>
          <Input id="stopLossPercentage" type="number" min="1" max="50" placeholder="e.g., 5 for 5%" value={stopLossPercentage === undefined ? '' : stopLossPercentage} onChange={(e) => { const val = e.target.value; setStopLossPercentage(val === '' ? undefined : parseFloat(val));}} disabled={isBusy || showAiConfirmationDialog}/>
        </div>

        {!showAiConfirmationDialog && (
          <Button onClick={handleStartAutomatedTrading} disabled={isBusy || sessionStatus === 'loading' || !apiToken || selectedInstruments.length === 0 || showAiConfirmationDialog} className="w-full">
            {(() => {
              if (sessionStatus === 'loading') return 'Authenticating Session...';
              if (isFetchingData) return 'Fetching Market Data...';
              if (isProcessingAi) return 'AI Processing...'; // This state is now brief before confirmation
              // if (isExecutingTrades) return 'Executing Trades...'; // This button is hidden during execution
              return 'Start Automated Trading Analysis';
            })()}
          </Button>
        )}
        {sessionStatus === 'unauthenticated' && !apiToken && ( <p className="text-sm text-center text-amber-600 dark:text-amber-500 mt-2"> Please sign in with Deriv or enter an API token manually to enable trading. </p> )}
      </CardContent>

      {/* Confirmation Dialog Section */}
      {showAiConfirmationDialog && aiStrategyForConfirmation && (
        <CardFooter className="flex flex-col items-start space-y-4 border-t pt-6">
          <CardTitle className="text-lg">Confirm AI Trading Strategy</CardTitle>
          {aiReasoning && (
            <div>
              <h4 className="font-semibold mb-1">AI Overall Reasoning:</h4>
              <ScrollArea className="h-20 w-full rounded-md border p-2 text-sm">
                {aiReasoning}
              </ScrollArea>
            </div>
          )}
          <div>
            <h4 className="font-semibold mb-2">Proposed Trades ({aiStrategyForConfirmation.tradesToExecute.length}):</h4>
            <ScrollArea className="h-40 w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Stake</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiStrategyForConfirmation.tradesToExecute.map((trade, index) => (
                    <TableRow key={index}>
                      <TableCell>{trade.instrument}</TableCell>
                      <TableCell>{trade.action}</TableCell>
                      <TableCell>${trade.stake.toFixed(2)}</TableCell>
                      <TableCell>{trade.durationSeconds}s</TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={trade.reasoning}>{trade.reasoning}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          <div className="flex w-full space-x-4 mt-4">
            <Button onClick={handleExecuteConfirmedTrades} className="flex-1 bg-green-600 hover:bg-green-700" disabled={isExecutingTrades}>
              {isExecutingTrades ? 'Executing...' : 'Confirm & Execute Trades'}
            </Button>
            <Button onClick={handleCancelAiConfirmation} className="flex-1" variant="outline" disabled={isExecutingTrades}>
              Cancel
            </Button>
          </div>
        </CardFooter>
      )}

      {/* Existing Results Display Section (after confirmation or if no confirmation needed) */}
      {!showAiConfirmationDialog && (aiReasoning || executionResults.length > 0 || Object.values(marketData).some(d => d.error)) && (
        <CardFooter className="flex flex-col items-start space-y-4 border-t pt-6">
          {Object.entries(marketData).map(([instrument, data]) => data.error ? ( <div key={instrument} className="text-red-500 text-sm"> Market Data Error for {instrument}: {data.error} </div> ) : null )}
          {/* Display overall reasoning if AI processing happened but no trades to confirm (e.g. AI decided not to trade) */}
          {aiReasoning && !aiStrategyForConfirmation && ( <div> <h4 className="font-semibold mb-2">AI Overall Reasoning:</h4> <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiReasoning}</p> </div> )}
          {executionResults.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Trade Execution Results:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {executionResults.map((result, index) => (
                  <li key={index} className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    Instrument: {result.instrument} - {result.success ? 'Success' : 'Failed'}
                    {result.success && result.tradeResponse && ` (Deriv Contract ID: ${result.tradeResponse.contract_id}, DB ID: ${result.dbTradeId})`}
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
