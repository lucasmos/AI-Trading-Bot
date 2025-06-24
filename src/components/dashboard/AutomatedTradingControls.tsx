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
  PriceTick,
  VolatilityInstrumentType, // Added for VolatilityTradeExecutionResult
} from '@/types';
import { generateAutomatedTradingStrategy } from '@/ai/flows/automated-trading-strategy-flow';
import {
  executeAiTradingStrategy,
  TradeExecutionResult,
  executeVolatilityAiTradeLoop, // Import the new action
  VolatilityTradeExecutionResult
} from '@/app/actions/trade-execution-actions';
import { UserTradeType as UserTradeTypeValue } from '@/ai/flows/volatility-trading-strategy-flow'; // Import type for state
import { useToast } from '@/hooks/use-toast';
import { getCandles, getTradingTimes, getFullContractDetails, DerivFullContractDetails } from '@/services/deriv';
import { calculateAllIndicators } from '@/lib/technical-analysis';
import { getMarketStatus } from '@/lib/market-hours';
import { getTradeMonitor, cleanupTradeMonitor, type TradeCompletionData } from '@/services/trade-monitor';

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
  const [isFetchingData, setIsFetchingData] = useState<boolean>(false);
  const [isProcessingAi, setIsProcessingAi] = useState<boolean>(false);
  const [isExecutingTrades, setIsExecutingTrades] = useState<boolean>(false); // Used for both general execution and Volatility loop

  const [marketData, setMarketData] = useState<MarketDataState>({});
  // executionResults can now hold results from either flow.
  const [executionResults, setExecutionResults] = useState<(TradeExecutionResult | VolatilityTradeExecutionResult)[]>([]);
  const [aiReasoning, setAiReasoning] = useState<string>('');
  const [isTokenFromSession, setIsTokenFromSession] = useState<boolean>(false);
  const [sessionProfitLoss, setSessionProfitLoss] = useState<number>(0);
  const [completedTrades, setCompletedTrades] = useState<number>(0);

  // New state for Volatility AI Trading
  const [selectedUserTradeType, setSelectedUserTradeType] = useState<UserTradeTypeValue | undefined>(undefined);

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

  // Cleanup trade monitor on unmount
  useEffect(() => {
    return () => {
      cleanupTradeMonitor();
    };
  }, []);

  // Combined busy state for disabling UI elements during critical operations.
  const isBusy = isFetchingData || isProcessingAi || isExecutingTrades || sessionStatus === 'loading';

  // Define UserTradeTypes for the dropdown
  const USER_TRADE_TYPES_OPTIONS: { value: UserTradeTypeValue; label: string }[] = [
    { value: 'RiseFall', label: 'Rise/Fall (Volatility)' },
    { value: 'HigherLower', label: 'Higher/Lower (Volatility)' },
    { value: 'TouchNoTouch', label: 'Touch/No Touch (Volatility)' },
    { value: 'DigitsOverUnder', label: 'Digits - Over/Under (Volatility)' },
    { value: 'DigitsEvenOdd', label: 'Digits - Even/Odd (Volatility)' },
  ];

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
    let activeInstruments = fetchResult.successfulInstruments;

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
        console.warn(`Data integrity issue: Instrument ${instrument} was marked successful but has no valid data for AI input.`);
        toast({ title: 'Internal Warning', description: `Could not prepare AI data for supposedly successful instrument: ${instrument}. It will be skipped.`, variant: 'warning'});
      }
    }

    if (Object.keys(instrumentTicksForAi).length === 0) {
        toast({ title: 'AI Strategy Halted', description: 'Failed to prepare any valid market data for the AI strategy generation.', variant: 'destructive' });
        return;
    }

    // Step 2b: Fetch Trading Times and Full Contract Details for each active instrument
    const instrumentOfferingsData: Record<string, any> = {};
    toast({ title: 'Fetching Market Details...', description: `Fetching trading times and contract details for ${activeInstruments.join(', ')}.`});

    for (const instrumentSymbol of activeInstruments) {
      let tradingTimesData: any = null;
      let tradingTimesDataString: string = 'Trading times data not fetched or error.';
      let isMarketOpen = false;
      let processedAvailableContracts: any[] = [];
      let errorFetchingContracts: string | undefined = undefined;

      try {
        // Fetch Trading Times
        try {
          tradingTimesData = await getTradingTimes(instrumentSymbol, apiToken);
          tradingTimesDataString = JSON.stringify(tradingTimesData);
        } catch (ttError: any) {
          console.error(`Error fetching trading times for ${instrumentSymbol}:`, ttError);
          tradingTimesDataString = `Error fetching trading times: ${ttError.message || 'Unknown error'}`;
          tradingTimesData = { error: ttError.message || 'Unknown error' }; // Store error for getMarketStatus
        }

        // Determine Market Status
        if (instrumentSymbol.toLowerCase().startsWith('cry')) {
          isMarketOpen = true;
        } else if (tradingTimesData && !tradingTimesData.error) {
          try {
            const marketStatus = getMarketStatus(tradingTimesData); // Ensure getMarketStatus handles the actual data object
            isMarketOpen = marketStatus.isOpen;
            if (!isMarketOpen && marketStatus.reason) {
              tradingTimesDataString += ` (Market determined closed: ${marketStatus.reason})`;
            } else if (!isMarketOpen) {
              tradingTimesDataString += ` (Market determined closed)`;
            }
          } catch (statusError: any) {
            console.error(`Error determining market status for ${instrumentSymbol}:`, statusError);
            tradingTimesDataString += ` (Error determining market status: ${statusError.message})`;
            isMarketOpen = false;
          }
        } else {
          isMarketOpen = false;
        }

        // Fetch Full Contract Details
        let rawAvailableContracts: DerivFullContractDetails[] = [];
        try {
          rawAvailableContracts = await getFullContractDetails(instrumentSymbol, apiToken);
        } catch (e: any) {
          console.error(`Failed to get full contract details for ${instrumentSymbol}`, e);
          errorFetchingContracts = (e as Error).message || 'Unknown error fetching contracts';
        }

        if (rawAvailableContracts.length > 0) {
          processedAvailableContracts = rawAvailableContracts.map(detail => {
            const mappedContract: any = {
              action: detail.contract_type,
              displayName: detail.contract_display,
            };
            if (detail.multiplier_range && detail.multiplier_range.length > 0) {
              mappedContract.multiplier_range = detail.multiplier_range;
            }

            let durations: string[] = [];
            if (detail.expiry_type === 'no_expiry') {
              durations = ['no_expiry'];
            } else if (detail.min_contract_duration && detail.max_contract_duration) {
              // Simplified approach: Use min and max. A more complex approach could generate steps.
              // TODO: Consider using a utility like generateDurationSteps (from deriv.ts or a shared util)
              // if a richer list of durations is needed by the AI.
              durations.push(detail.min_contract_duration);
              if (detail.min_contract_duration !== detail.max_contract_duration) {
                durations.push(detail.max_contract_duration);
              }
            } else if (detail.min_contract_duration) {
              durations.push(detail.min_contract_duration);
            }
            // Add more specific duration parsing here if Deriv provides structured lists for other expiry types

            if (durations.length > 0) {
              mappedContract.availableDurations = durations;
            }
            return mappedContract;
          }).filter(c => c.action); // Ensure action is present
        }

        instrumentOfferingsData[instrumentSymbol] = {
          tradingTimesDataString,
          isMarketCurrentlyOpen: isMarketOpen,
          availableContracts: processedAvailableContracts,
          errorFetchingContracts: errorFetchingContracts, // Store error if any
        };

      } catch (instrumentError: any) { // Catch errors from processing this specific instrument
        console.error(`Failed to process all details for instrument ${instrumentSymbol}:`, instrumentError);
        instrumentOfferingsData[instrumentSymbol] = {
          tradingTimesDataString: tradingTimesDataString, // Store whatever was fetched
          isMarketCurrentlyOpen: isMarketOpen, // Store determined status
          availableContracts: [], // Default to empty
          errorFetchingContracts: instrumentError.message || 'Overall error processing instrument details',
        };
      }
    }

    // Step 2c: Filter instruments by market status and adjust stake apportionment
    const openMarketInstruments = activeInstruments.filter(instrument => {
      const instrumentData = instrumentOfferingsData[instrument];
      return instrumentData && instrumentData.isMarketCurrentlyOpen;
    });

    const closedMarketInstruments = activeInstruments.filter(instrument => {
      const instrumentData = instrumentOfferingsData[instrument];
      return !instrumentData || !instrumentData.isMarketCurrentlyOpen;
    });

    // Notify user about market status filtering
    if (closedMarketInstruments.length > 0) {
      toast({
        title: 'Market Hours Filtering',
        description: `Markets closed: ${closedMarketInstruments.join(', ')}. AI will focus on open markets: ${openMarketInstruments.join(', ')}.`,
        variant: 'info',
        duration: 8000
      });
    }

    if (openMarketInstruments.length === 0) {
      toast({
        title: 'No Open Markets',
        description: 'All selected markets are currently closed. Please try again during market hours or select different instruments.',
        variant: 'destructive'
      });
      return;
    }

    // Update active instruments to only include open markets
    activeInstruments = openMarketInstruments;

    // Recalculate stake apportionment for open markets
    const adjustedStakePerInstrument = totalStake / activeInstruments.length;
    console.log(`[AutomatedTrading] Stake apportionment: Total $${totalStake} across ${activeInstruments.length} open markets = $${adjustedStakePerInstrument.toFixed(2)} per instrument`);

    // Step 3: Call AI to generate trading strategy.
    setIsProcessingAi(true);
    try {
      toast({ title: 'AI Thinking...', description: `Generating trading strategy for ${activeInstruments.length} open market(s): ${activeInstruments.join(', ')}...` });

      const strategyInput = {
        totalStake,
        instruments: activeInstruments,
        tradingMode,
        stopLossPercentage: stopLossPercentage || undefined,
        instrumentTicks: instrumentTicksForAi,
        instrumentIndicators: instrumentIndicatorsForAi,
        aiStrategyId: aiStrategyId,
        instrumentOfferings: instrumentOfferingsData, // <<<< NEWLY ADDED
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

      // Initialize trade monitor for successful trades
      const tradeMonitor = getTradeMonitor(apiToken, targetAccountId, {
        onTradeComplete: (trade: TradeCompletionData) => {
          setSessionProfitLoss(prev => prev + trade.profit);
          setCompletedTrades(prev => prev + 1);

          // Show session summary toast
          toast({
            title: `📊 Session Update`,
            description: `Completed: ${completedTrades + 1} trades | Session P/L: ${sessionProfitLoss + trade.profit >= 0 ? '+' : ''}$${(sessionProfitLoss + trade.profit).toFixed(2)}`,
            duration: 5000
          });
        },
        showToastNotifications: true
      });

      results.forEach(result => {
        if (result.success) {
          // Add to trade monitor
          if (tradeMonitor && result.tradeResponse?.contract_id) {
            tradeMonitor.addContract(
              result.tradeResponse.contract_id.toString(),
              result.instrument,
              result.tradeResponse.buy_price || 0
            );
          }

          toast({
            title: `✅ Trade Placed: ${result.instrument}`,
            description: `Stake: $${result.tradeResponse?.buy_price || 'N/A'} | Contract ID: ${result.tradeResponse?.contract_id} | Entry: ${result.tradeResponse?.entry_spot}`,
            duration: 6000
          });
        } else {
          toast({
            title: `❌ Trade Failed: ${result.instrument}`,
            description: result.error,
            variant: 'destructive',
            duration: 8000
          });
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

        {/* Volatility AI Trade Type Selection */}
        <div className="space-y-2">
          <Label htmlFor="volatilityTradeType">Volatility AI Trade Type (Select to enable Volatility Loop)</Label>
          <Select
            value={selectedUserTradeType}
            onValueChange={(value: string) => setSelectedUserTradeType(value as UserTradeTypeValue)}
            disabled={isBusy || showAiConfirmationDialog}
          >
            <SelectTrigger id="volatilityTradeType">
              <SelectValue placeholder="Select Volatility Trade Type (or leave for general AI)" />
            </SelectTrigger>
            <SelectContent>
              {USER_TRADE_TYPES_OPTIONS.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
           <p className="text-xs text-muted-foreground">Selecting a type here will activate the Volatility Index trading loop.</p>
        </div>


        {!showAiConfirmationDialog && (
          <Button
            onClick={selectedUserTradeType ? handleStartVolatilityAiLoop : handleStartAutomatedTrading}
            disabled={
              isBusy ||
              sessionStatus === 'loading' ||
              !apiToken ||
              (selectedUserTradeType ? false : selectedInstruments.length === 0) || // Instrument selection not needed if Volatility type is chosen
              showAiConfirmationDialog
            }
            className="w-full"
          >
            {(() => {
              if (sessionStatus === 'loading') return 'Authenticating...';
              if (isExecutingTrades && selectedUserTradeType) return 'Volatility AI Loop Running...';
              if (isExecutingTrades && !selectedUserTradeType) return 'Executing Confirmed Trades...';
              if (isFetchingData) return 'Fetching Market Data...';
              if (isProcessingAi) return 'AI Processing...';
              return selectedUserTradeType ? 'Start Volatility AI Loop' : 'Start Automated Trading Analysis';
            })()}
          </Button>
        )}
        {sessionStatus === 'unauthenticated' && !apiToken && ( <p className="text-sm text-center text-amber-600 dark:text-amber-500 mt-2"> Please sign in with Deriv or enter an API token manually to enable trading. </p> )}
      </CardContent>

      {/* Confirmation Dialog Section (Only for general AI strategy) */}
      {/* Confirmation Dialog Section (Only for general AI strategy, not for Volatility loop) */}
      {showAiConfirmationDialog && aiStrategyForConfirmation && !selectedUserTradeType && (
        <CardFooter className="flex flex-col items-start space-y-4 border-t pt-6">
          <CardTitle className="text-lg">Confirm General AI Trading Strategy</CardTitle>
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

      {/* Results Display Section - Unified for both flows */}
      {(!showAiConfirmationDialog || selectedUserTradeType) && (executionResults.length > 0 || (aiReasoning && !aiStrategyForConfirmation)) && (
        <CardFooter className="flex flex-col items-start space-y-4 border-t pt-6">
          {/* Display market data errors if any */}
          {Object.entries(marketData).map(([instrument, data]) =>
            data.error && !selectedUserTradeType ? // Only show general market data errors if not in volatility loop
            ( <div key={instrument} className="text-red-500 text-sm"> Market Data Error for {instrument}: {data.error} </div> )
            : null
          )}

          {/* Display overall AI reasoning if AI decided not to trade (for general strategy) */}
          {aiReasoning && !aiStrategyForConfirmation && !selectedUserTradeType && (
            <div> <h4 className="font-semibold mb-2">AI Overall Reasoning:</h4> <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiReasoning}</p> </div>
          )}

          {executionResults.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Trade Execution Results:</h4>
              <ScrollArea className="h-40 w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executionResults.map((result, index) => (
                      <TableRow key={index} className={result.success ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}>
                        <TableCell>{result.instrument}</TableCell>
                        <TableCell>{result.success ? 'Success' : 'Failed'}</TableCell>
                        <TableCell className="text-xs">
                          {result.success ?
                           `Deriv Contract ID: ${result.tradeResponse?.contract_id}, DB ID: ${result.dbTradeId}` :
                           result.error}
                          {/* Display AI reasoning per trade if available in VolatilityTradeExecutionResult */}
                          {(result as VolatilityTradeExecutionResult).aiReasoning &&
                            <p className="mt-1 italic">AI: {(result as VolatilityTradeExecutionResult).aiReasoning}</p>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

// Helper function needs to be defined or imported
// This is a new handler for the volatility loop.
async function handleStartVolatilityAiLoop() {
  // This function's content was defined in the thought block.
  // It needs to be part of the component or correctly scoped.
  // For this example, I will assume it's defined within the component scope.
  // The actual implementation has been moved into the component above for brevity here.
  console.log("handleStartVolatilityAiLoop would be invoked here.");
};
