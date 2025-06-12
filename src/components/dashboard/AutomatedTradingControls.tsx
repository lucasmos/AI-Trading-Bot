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

export function AutomatedTradingControls() {
  const { toast } = useToast();
  const { data: session, status: sessionStatus } = useSession();

  const [apiToken, setApiToken] = useState<string>('');
  const [totalStake, setTotalStake] = useState<number>(10);
  const [selectedInstruments, setSelectedInstruments] = useState<ForexCryptoCommodityInstrumentType[]>([]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [stopLossPercentage, setStopLossPercentage] = useState<number | undefined>(5);
  const [aiStrategyId, setAiStrategyId] = useState<string | undefined>(undefined);

  const [isFetchingData, setIsFetchingData] = useState<boolean>(false);
  const [isProcessingAi, setIsProcessingAi] = useState<boolean>(false);
  const [isExecutingTrades, setIsExecutingTrades] = useState<boolean>(false);

  const [marketData, setMarketData] = useState<MarketDataState>({});
  const [executionResults, setExecutionResults] = useState<TradeExecutionResult[]>([]);
  const [aiReasoning, setAiReasoning] = useState<string>('');
  const [isTokenFromSession, setIsTokenFromSession] = useState<boolean>(false);

  const [aiStrategyForConfirmation, setAiStrategyForConfirmation] = useState<AutomatedTradingStrategyOutput | null>(null);
  const [showAiConfirmationDialog, setShowAiConfirmationDialog] = useState<boolean>(false);


  useEffect(() => {
    console.log('[ATC useEffect/apiToken] Running. sessionStatus:', sessionStatus);
    if (sessionStatus === 'authenticated' && session?.user?.derivAccessToken) {
      console.log('[ATC useEffect/apiToken] Session authenticated, token available:', session.user.derivAccessToken ? 'YES' : 'NO');
      if (apiToken === '' || isTokenFromSession) {
        console.log('[ATC useEffect/apiToken] Setting apiToken from session:', session.user.derivAccessToken.substring(0, 5) + '...');
        setApiToken(session.user.derivAccessToken as string);
        setIsTokenFromSession(true);
      } else {
        console.log('[ATC useEffect/apiToken] apiToken already set manually, not overwriting from session.');
      }
    } else if (sessionStatus !== 'loading' && isTokenFromSession) {
      console.log('[ATC useEffect/apiToken] Session no longer authenticated or token missing, was from session. Current apiToken:', apiToken ? 'Exists' : 'Empty');
    }
  }, [session, sessionStatus, apiToken, isTokenFromSession]);

  const isBusy = isFetchingData || isProcessingAi || isExecutingTrades || sessionStatus === 'loading';

  const handleInstrumentChange = (instrument: ForexCryptoCommodityInstrumentType) => {
    setSelectedInstruments(prev =>
      prev.includes(instrument)
        ? prev.filter(item => item !== instrument)
        : [...prev, instrument]
    );
  };

  const fetchMarketDataForSelectedInstruments = async (currentToken: string): Promise<boolean> => {
    console.log('[ATC fetchMarketData] Called with currentToken:', currentToken ? currentToken.substring(0,5) + '...' : 'EMPTY_OR_NULL');
    if (!currentToken) {
      toast({ title: 'Internal Error', description: 'API token missing for data fetch.', variant: 'destructive' });
      return false;
    }
    if (selectedInstruments.length === 0) return true;
    setIsFetchingData(true);
    toast({ title: 'Fetching Market Data...', description: `Fetching candles for ${selectedInstruments.join(', ')}.` });
    const newMarketData: MarketDataState = {};
     for (const instrument of selectedInstruments) {
      try {
        const candles = await getCandles(instrument, 150, 60, currentToken);
        if (candles && candles.length > 0) {
          const indicators = calculateAllIndicators(candles);
          newMarketData[instrument] = { candles, indicators };
        } else {
          newMarketData[instrument] = { candles: [], error: 'No candle data returned.' };
        }
      } catch (error: any) {
        newMarketData[instrument] = { candles: [], error: error.message || 'Failed to fetch data.' };
      }
    }
    setMarketData(newMarketData);
    setIsFetchingData(false);
    if (Object.values(newMarketData).every(d => d.error && d.candles.length === 0)) {
        toast({ title: 'Market Data Error', description: 'Failed to fetch market data for all selected instruments.', variant: 'destructive'});
        return false;
    }
    return true;
  };

  const handleStartAutomatedTrading = async () => {
    console.log('[ATC handleStartAutomatedTrading] Called. Current apiToken state:', apiToken ? apiToken.substring(0,5) + '...' : 'EMPTY_OR_NULL');
    if (!apiToken || selectedInstruments.length === 0 || totalStake < 1 || sessionStatus !== 'authenticated' || !session?.user?.id) {
      toast({ title: 'Error', description: 'Please ensure API token, instruments, stake are set, and you are logged in.', variant: 'destructive' });
      return;
    }

    setExecutionResults([]);
    setAiReasoning('');
    setAiStrategyForConfirmation(null);
    setShowAiConfirmationDialog(false);

    const dataFetchSuccess = await fetchMarketDataForSelectedInstruments(apiToken);
    if (!dataFetchSuccess) {
        setIsProcessingAi(false); // Ensure this is reset if data fetch fails
        return;
    }

    const instrumentTicksForAi: Record<ForexCryptoCommodityInstrumentType, PriceTick[]> = {};
    const instrumentIndicatorsForAi: Record<ForexCryptoCommodityInstrumentType, InstrumentIndicatorData> = {};
    let hasDataForAtLeastOneInstrument = false;

    for (const instrument of selectedInstruments) {
      const currentInstrumentData = marketData[instrument];
      if (currentInstrumentData && !currentInstrumentData.error && currentInstrumentData.candles.length > 0) {
        instrumentTicksForAi[instrument] = currentInstrumentData.candles.map(c => ({ epoch: c.epoch, price: c.close, time: c.time }));
        if (currentInstrumentData.indicators) instrumentIndicatorsForAi[instrument] = currentInstrumentData.indicators;
        hasDataForAtLeastOneInstrument = true;
      }
    }

    console.log('[ATC handleStartAutomatedTrading] After data prep. hasDataForAtLeastOneInstrument:', hasDataForAtLeastOneInstrument);
    console.log('[ATC handleStartAutomatedTrading] instrumentTicksForAi keys:', Object.keys(instrumentTicksForAi));
    console.log('[ATC handleStartAutomatedTrading] instrumentIndicatorsForAi keys:', Object.keys(instrumentIndicatorsForAi));

    if (!hasDataForAtLeastOneInstrument) {
        toast({ title: 'AI Strategy Halted', description: 'No valid market data available to generate a strategy.', variant: 'destructive' });
        setIsProcessingAi(false); // Add this line
        return;
    }

    setIsProcessingAi(true);
    try {
      toast({ title: 'AI Thinking...', description: 'Generating trading strategy...' });
      const strategyInput = {
        totalStake,
        instruments: selectedInstruments.filter(inst => marketData[inst] && !marketData[inst].error && marketData[inst].candles.length > 0),
        tradingMode,
        stopLossPercentage: stopLossPercentage || undefined,
        instrumentTicks: instrumentTicksForAi,
        instrumentIndicators: instrumentIndicatorsForAi,
        aiStrategyId: aiStrategyId,
      };

      console.log('[ATC] strategyInput.instrumentIndicators being sent to AI flow:', JSON.stringify(strategyInput.instrumentIndicators, null, 2));
      const aiStrategyResult: AutomatedTradingStrategyOutput = await generateAutomatedTradingStrategy(strategyInput as any);

      console.log('[ATC] Received aiStrategyResult from AI flow:', JSON.stringify(aiStrategyResult, null, 2));
      if (aiStrategyResult) {
          console.log('[ATC] Overall Reasoning from result:', aiStrategyResult.overallReasoning);
          if (aiStrategyResult.tradesToExecute) {
              aiStrategyResult.tradesToExecute.forEach((trade, index) => {
                  console.log(`[ATC] Trade ${index + 1} Reasoning from result:`, trade.reasoning);
              });
          }
      }

      if (!aiStrategyResult || !aiStrategyResult.tradesToExecute || aiStrategyResult.tradesToExecute.length === 0) {
        setAiReasoning(aiStrategyResult?.overallReasoning || 'AI determined no optimal trades at this moment.');
        toast({ title: 'AI Strategy', description: aiStrategyResult?.overallReasoning || 'AI did not propose any trades.', variant: 'default' });
        // setIsProcessingAi(false); // This will be handled by finally
      } else {
        setAiStrategyForConfirmation(aiStrategyResult);
        setAiReasoning(aiStrategyResult.overallReasoning);
        setShowAiConfirmationDialog(true);
        toast({ title: 'AI Strategy Ready', description: `AI proposed ${aiStrategyResult.tradesToExecute.length} trade(s). Please confirm.`, duration: 5000 });
      }
    } catch (error: any) {
      console.error('Error during AI strategy generation:', error);
      toast({ title: 'Error', description: error.message || 'Unexpected error during AI strategy generation.', variant: 'destructive' });
    } finally {
      // Set isProcessingAi to false here if not showing confirmation, or after confirmation is handled.
      // If showAiConfirmationDialog is true, user interaction will follow, so isProcessingAi should be false.
      setIsProcessingAi(false);
    }
  };

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
    setShowAiConfirmationDialog(false);
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

      const successfulPlacements = results.filter(r => r.success).length;
      const failedPlacements = results.length - successfulPlacements;
      toast({
        title: 'Automated Trading Concluded',
        description: `Trade placements: ${successfulPlacements} successful, ${failedPlacements} failed. Check results for details. (P/L updates as trades close).`,
        duration: 7000
      });

    } catch (error: any) {
      console.error('Error during confirmed trade execution:', error);
      toast({ title: 'Execution Error', description: error.message || 'Unexpected error during trade execution.', variant: 'destructive' });
    } finally {
      setIsExecutingTrades(false);
      setAiStrategyForConfirmation(null);
    }
  };

  const handleCancelAiConfirmation = () => {
    setShowAiConfirmationDialog(false);
    setAiStrategyForConfirmation(null);
    setIsProcessingAi(false);
    setAiReasoning('');
    toast({ title: 'AI Trading Cancelled', description: 'Automated trading was cancelled by the user.' });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Automated Trading (Live Data)</CardTitle>
        <CardDescription>Configure and start AI-powered automated trading with your Deriv account using live market data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
              if (isProcessingAi) return 'AI Processing...';
              return 'Start Automated Trading Analysis';
            })()}
          </Button>
        )}
        {sessionStatus === 'unauthenticated' && !apiToken && ( <p className="text-sm text-center text-amber-600 dark:text-amber-500 mt-2"> Please sign in with Deriv or enter an API token manually to enable trading. </p> )}
      </CardContent>

      {showAiConfirmationDialog && aiStrategyForConfirmation && (() => {
        // Logging block for UI render state
        console.log('[ATC UI Render] Rendering Confirmation Dialog. States:');
        console.log('[ATC UI Render]   showAiConfirmationDialog:', showAiConfirmationDialog);
        console.log('[ATC UI Render]   aiReasoning (for overall):', aiReasoning);
        console.log('[ATC UI Render]   aiStrategyForConfirmation.overallReasoning (from strategy object):', aiStrategyForConfirmation.overallReasoning);
        if (aiStrategyForConfirmation.tradesToExecute && aiStrategyForConfirmation.tradesToExecute.length > 0) {
            aiStrategyForConfirmation.tradesToExecute.forEach((trade, index) => {
                console.log(`[ATC UI Render]   Trade ${index + 1} (${trade.instrument}) Reasoning from strategy object:`, trade.reasoning);
            });
        } else {
            console.log('[ATC UI Render]   No trades to execute in aiStrategyForConfirmation.');
        }
        // End of logging block

        return (
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
                        <TableCell className="text-xs whitespace-pre-wrap max-w-sm" title={trade.reasoning}>{trade.reasoning}</TableCell>
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
        );
      })()}

      {!showAiConfirmationDialog && (aiReasoning || executionResults.length > 0 || Object.values(marketData).some(d => d.error)) && (
        <CardFooter className="flex flex-col items-start space-y-4 border-t pt-6">
          {Object.entries(marketData).map(([instrument, data]) => data.error ? ( <div key={instrument} className="text-red-500 text-sm"> Market Data Error for {instrument}: {data.error} </div> ) : null )}
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
