'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BalanceDisplay } from '@/components/dashboard/balance-display';
import { TradingChart } from '@/components/dashboard/trading-chart'; 
import type { VolatilityInstrumentType, TradingMode, PaperTradingMode, ActiveAutomatedVolatilityTrade, ProfitsClaimable, PriceTick, InstrumentType } from '@/types/index';
// Import the new action and related types
import {
  executeVolatilityAiTradeLoop,
  VolatilityTradeExecutionResult
} from '@/app/actions/trade-execution-actions';
// Import UserTradeType from the new shared location
import { UserTradeType as UserTradeTypeValue } from '@/types/ai-shared-types';

import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCandles } from '@/services/deriv';
import { v4 as uuidv4 } from 'uuid'; 
import { getInstrumentDecimalPlaces } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { Bot, DollarSign, Play, Square, Briefcase, UserCheck, Activity } from 'lucide-react'; 
import { VOLATILITY_INSTRUMENTS } from "../../config/instruments";
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateEMA, calculateATR, calculateFullRSI, calculateFullMACD, calculateFullBollingerBands, calculateFullEMA, calculateFullATR } from '@/lib/technical-analysis';
import { AI_TRADING_STRATEGIES, DEFAULT_AI_STRATEGY_ID } from '@/config/ai-strategies';
import { useRouter } from 'next/navigation';

export default function VolatilityTradingPage() {
  const router = useRouter();
  const { 
    authStatus, 
    userInfo,
    paperBalance, 
    setPaperBalance, 
    liveBalance, 
    setLiveBalance 
  } = useAuth();
  
  const [currentVolatilityInstrument, setCurrentVolatilityInstrument] = useState<VolatilityInstrumentType>(VOLATILITY_INSTRUMENTS[0]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [paperTradingMode, setPaperTradingMode] = useState<PaperTradingMode>('paper'); 
  const [selectedAiStrategyId, setSelectedAiStrategyId] = useState<string>(DEFAULT_AI_STRATEGY_ID); // Keep for now, but new flow doesn't use it.
  const [selectedUserTradeType, setSelectedUserTradeType] = useState<UserTradeTypeValue | undefined>(undefined); // New state
  
  const [autoTradeTotalStake, setAutoTradeTotalStake] = useState<number>(10); // Default to smaller stake, as it's per trade in new flow
  const [isAutoTradingActive, setIsAutoTradingActive] = useState(false);
  const [activeAutomatedTrades, setActiveAutomatedTrades] = useState<ActiveAutomatedVolatilityTrade[]>([]); // Will be populated differently
  const [profitsClaimable, setProfitsClaimable] = useState<ProfitsClaimable>({
    totalNetProfit: 0,
    tradeCount: 0,
    winningTrades: 0,
    losingTrades: 0,
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const tradeIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const [consecutiveAiCallCount, setConsecutiveAiCallCount] = useState(0);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState<number | null>(null);
  const AI_COOLDOWN_DURATION_MS = 2 * 60 * 1000; // 2 minutes

  const currentBalance = paperTradingMode === 'paper' ? paperBalance : liveBalance;
  const setCurrentBalance = paperTradingMode === 'paper' ? setPaperBalance : setLiveBalance;

  // const router = useRouter(); // already added above
  const { toast } = useToast();

  const USER_TRADE_TYPES_OPTIONS: { value: UserTradeTypeValue; label: string }[] = [
    { value: 'RiseFall', label: 'Rise/Fall' },
    { value: 'HigherLower', label: 'Higher/Lower' },
    { value: 'TouchNoTouch', label: 'Touch/No Touch' },
    { value: 'DigitsOverUnder', label: 'Digits - Over/Under' },
    { value: 'DigitsEvenOdd', label: 'Digits - Even/Odd' },
  ];

  useEffect(() => {
    const profitsKey = `volatilityProfitsClaimable_${paperTradingMode}`;
    const storedProfits = localStorage.getItem(profitsKey);
    if (storedProfits) {
      try {
        setProfitsClaimable(JSON.parse(storedProfits));
      } catch (error) {
        console.error("Error parsing volatility profits from localStorage:", error);
        setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
      }
    } else {
      setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });
    }
  }, [paperTradingMode]);

  useEffect(() => {
    const profitsKey = `volatilityProfitsClaimable_${paperTradingMode}`;
    localStorage.setItem(profitsKey, JSON.stringify(profitsClaimable));
  }, [profitsClaimable, paperTradingMode]);

  const handleInstrumentChange = (instrument: string) => {
    if (VOLATILITY_INSTRUMENTS.includes(instrument as VolatilityInstrumentType)) {
      setCurrentVolatilityInstrument(instrument as VolatilityInstrumentType);
    }
  };

  const handleAutoStakeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value >= 0) {
      setAutoTradeTotalStake(value);
    } else if (event.target.value === "") {
      setAutoTradeTotalStake(0);
    }
  };

  const handleStartAiAutoTrade = useCallback(async () => {
    if (authStatus === 'unauthenticated' || !userInfo?.id) {
      toast({ title: "Authentication Required", description: "Please log in.", variant: "destructive" });
      router.push('/auth/login');
      return;
    }

    if (!selectedUserTradeType) {
      toast({ title: "Trade Type Required", description: "Please select a Volatility AI Trade Type.", variant: "destructive" });
      return;
    }

    const userDerivApiToken = userInfo.derivAccessToken;
    const targetAccountId = paperTradingMode === 'paper' ? userInfo.derivDemoAccountId : userInfo.derivRealAccountId;
    const selectedAccountType = paperTradingMode;

    if (!userDerivApiToken) {
        toast({ title: "API Token Missing", description: "Deriv API token not found in your session. Please re-authenticate with Deriv.", variant: "destructive"});
        return;
    }
    if (!targetAccountId) {
        toast({ title: "Deriv Account ID Missing", description: `Your Deriv ${selectedAccountType} account ID is not set. Please check your profile or Deriv session.`, variant: "destructive"});
        return;
    }

    // Cooldown logic
    if (consecutiveAiCallCount >= 2) {
      if (lastAiCallTimestamp && (Date.now() - lastAiCallTimestamp) < AI_COOLDOWN_DURATION_MS) {
        const remainingTimeSeconds = Math.ceil((AI_COOLDOWN_DURATION_MS - (Date.now() - lastAiCallTimestamp)) / 1000);
        const remainingMinutes = Math.ceil(remainingTimeSeconds / 60);
        toast({ title: "AI Cooldown", description: `AI is cooling down. Please wait ${remainingMinutes} minutes.`, variant: "default" });
        return;
      } else {
        setConsecutiveAiCallCount(0);
      }
    }

    setIsAiLoading(true); 
    setIsAutoTradingActive(true);
    setActiveAutomatedTrades([]); 
    setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });

    console.log(`[VolatilityPage] User ${userInfo.id} initiating Volatility AI Loop. Type: ${selectedUserTradeType}, Account: ${targetAccountId}, Mode: ${selectedAccountType}`);
    toast({ title: "Volatility AI Loop Starting...", description: `Trading Volatility Indices with type: ${selectedUserTradeType} on ${selectedAccountType} account.` });

    try {
      const loopResults = await executeVolatilityAiTradeLoop(
        userDerivApiToken,
        targetAccountId,
        selectedAccountType as 'demo' | 'real',
        userInfo.id,
        selectedUserTradeType
      );
      
      setConsecutiveAiCallCount(prev => prev + 1);
      setLastAiCallTimestamp(Date.now());
      console.log(`[VolatilityPage] Received ${loopResults.length} results from Volatility AI Loop:`, JSON.stringify(loopResults, null, 2));

      const newUiTrades: ActiveAutomatedVolatilityTrade[] = loopResults.map(result => ({
          id: result.dbTradeId || uuidv4(),
          instrument: result.instrument,
          action: result.tradeParams?.contract_type.includes('CALL') || result.tradeParams?.contract_type.includes('OVER') || result.tradeParams?.contract_type.includes('EVEN') || result.tradeParams?.contract_type.includes('ONETOUCH') ? 'CALL' : 'PUT', // Simplified display
          stake: result.tradeParams?.amount || 0,
          durationSeconds: result.tradeParams?.duration || 0,
          reasoning: result.aiReasoning || 'N/A',
          entryPrice: result.tradeResponse?.entry_spot || 0,
          stopLossPrice: 0,
          startTime: Date.now(),
          status: result.success ? 'pending_execution' : 'failed_placement',
          currentPrice: result.tradeResponse?.entry_spot || 0,
          pnl: 0,
          error: result.error,
      }));
      setActiveAutomatedTrades(newUiTrades);

      const successfulPlacements = loopResults.filter(r => r.success).length;
      const failedPlacements = loopResults.length - successfulPlacements;
      toast({
        title: 'Volatility AI Loop Concluded',
        description: `Trade placements attempted: ${loopResults.length}. Successful: ${successfulPlacements}, Failed: ${failedPlacements}. Check results.`,
        duration: 7000
      });
      
      setIsAutoTradingActive(false);

    } catch (error: any) {
      toast({ title: "Volatility AI Loop Error", description: `Failed to execute trading loop: ${error.message}`, variant: "destructive" });
      setIsAutoTradingActive(false);
    } finally {
      setIsAiLoading(false); 
    }
  }, [
    authStatus, userInfo, toast, router, selectedUserTradeType, paperTradingMode,
    consecutiveAiCallCount, lastAiCallTimestamp, AI_COOLDOWN_DURATION_MS,
    setIsAiLoading, setIsAutoTradingActive, setActiveAutomatedTrades, setProfitsClaimable,
    setConsecutiveAiCallCount, setLastAiCallTimestamp
  ]);

  const handleStopAiAutoTrade = () => { // This function now primarily stops the UI indication of autotrading.
                                      // Real trades placed via backend action cannot be "stopped" by this frontend button once placed.
                                      // This button would now act more like a "reset UI" or "cancel current session view".
    setIsAutoTradingActive(false); 
    tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
    tradeIntervals.current.clear();

    setActiveAutomatedTrades(prevTrades => 
      prevTrades.map(trade => {
        if (trade.status === 'active') {
          const pnl = -trade.stake; 

          if (userInfo?.id) {
            console.log('[VolatilityDashboard] Storing manually stopped automated trade in database for user:', userInfo.id);
            fetch('/api/trades', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: userInfo.id,
                email: userInfo.email, 
                name: userInfo.name, 
                symbol: trade.instrument,
                type: trade.action === 'CALL' ? 'buy' : 'sell',
                amount: trade.stake,
                price: trade.entryPrice,
                aiStrategyId: selectedAiStrategyId,
                metadata: {
                  mode: tradingMode,
                  duration: `${trade.durationSeconds}s`,
                  accountType: paperTradingMode,
                  automated: true,
                  manualStop: true,
                  tradeCategory: 'volatility',
                  reasoning: (trade.reasoning || "") + " Manually stopped."
                }
              }),
            })
            .then(response => response.json())
            .then(createdTrade => {
              if (createdTrade && createdTrade.id) {
                console.log('[VolatilityDashboard] Manual stop trade created, now closing:', createdTrade.id);
                return fetch(`/api/trades/${createdTrade.id}/close`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    exitPrice: trade.currentPrice, 
                    metadata: {
                      outcome: 'closed_manual',
                      pnl: pnl,
                      reason: "Manually stopped automated trade"
                    }
                  }),
                });
              }
              throw new Error('Failed to create trade in DB for manual stop');
            })
            .then(response => response?.json())
            .then(closedTrade => {
              if (closedTrade) {
                console.log('[VolatilityDashboard] Manual stop trade closed successfully:', closedTrade.id);
              } else {
                 console.warn('[VolatilityDashboard] Failed to close manually stopped trade in DB or no trade to close.');
              }
            })
            .catch(error => {
              console.error("[VolatilityDashboard] Error processing manually stopped trade in database:", error);
            });
          }
          
          setTimeout(() => {
            setCurrentBalance(prevBal => parseFloat((prevBal + pnl).toFixed(2)));
            setProfitsClaimable(prevProfits => ({
              totalNetProfit: prevProfits.totalNetProfit + pnl,
              tradeCount: prevProfits.tradeCount + 1,
              winningTrades: prevProfits.winningTrades, 
              losingTrades: prevProfits.losingTrades + 1, 
            }));
          }, 0);
          return { ...trade, status: 'lost_duration', pnl, reasoning: (trade.reasoning || "") + " Manually stopped." };
        }
        return trade;
      })
    );
    toast({ title: "AI Volatility Trading Stopped", description: `Automated trading session for ${paperTradingMode} account has been stopped.`});
  };
  
  // Removed the useEffect that managed simulated trades (tradeIntervals.current, etc.)
  // The new flow relies on backend execution. Real-time status updates would require websockets or polling.

  return (
    <div className="container mx-auto py-2 space-y-6">
      <BalanceDisplay 
        balance={currentBalance} 
        selectedAccountType={paperTradingMode as 'demo' | 'real' | null} 
        displayAccountId={null} 
      />
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Activity className="h-8 w-8 text-primary" />AI Volatility Index Trading</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><Bot className="mr-2 h-6 w-6 text-primary" />AI Auto-Trading Controls</CardTitle>
              <CardDescription>Configure and manage automated AI trading sessions for Volatility Indices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="volatility-trading-mode">Trading Mode</Label>
                <Select value={tradingMode} onValueChange={(value) => setTradingMode(value as TradingMode)}>
                  <SelectTrigger id="volatility-trading-mode">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                  </Select>
                {/* Trading mode description can be kept or removed if not used by new AI flow */}
              </div>

              {/* AI Strategy and Trading Mode selects are less relevant for the new simplified loop but kept for now */}
              {/* <div className="space-y-2">
                <Label htmlFor="volatility-ai-strategy">AI Strategy (Not used by new loop)</Label>
                <Select value={selectedAiStrategyId} onValueChange={setSelectedAiStrategyId} disabled={isAutoTradingActive || isAiLoading}>
                  <SelectTrigger id="volatility-ai-strategy">
                    <SelectValue placeholder="Select AI Strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_TRADING_STRATEGIES.map((strategy) => (
                      <SelectItem key={strategy.id} value={strategy.id}>
                        {strategy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div> */}

              <div className="space-y-2">
                <Label htmlFor="volatility-user-trade-type">Volatility AI Trade Type</Label>
                <Select
                  value={selectedUserTradeType}
                  onValueChange={(value) => setSelectedUserTradeType(value as UserTradeTypeValue)}
                  disabled={isAutoTradingActive || isAiLoading}
                >
                  <SelectTrigger id="volatility-user-trade-type">
                    <SelectValue placeholder="Select Trade Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_TRADE_TYPES_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="vol-account-mode">Account Type</Label>
                <Select value={paperTradingMode} onValueChange={(val) => setPaperTradingMode(val as PaperTradingMode)} disabled={isAutoTradingActive || isAiLoading}>
                  <SelectTrigger id="vol-account-mode" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paper"><UserCheck className="mr-2 h-4 w-4 inline-block text-blue-500"/>Demo Account</SelectItem>
                    <SelectItem value="live"><Briefcase className="mr-2 h-4 w-4 inline-block text-green-500"/>Real Account (Simulated)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="vol-auto-stake">Total Stake for Session ($)</Label>
                <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    id="vol-auto-stake"
                    type="number"
                    value={autoTradeTotalStake} // This now represents stake per trade for the loop
                    onChange={handleAutoStakeChange}
                    placeholder="e.g., 10" // Default changed to 10
                    className="w-full pl-8"
                    min="0.35" // Min stake on Deriv
                    step="0.01"
                    disabled={isAutoTradingActive || isAiLoading}
                    />
                </div>
                <p className="text-xs text-muted-foreground mt-1">This stake will be attempted for each Volatility Index in the loop.</p>
                {/* Balance check might need adjustment if total exposure is considered */}
              </div>

              {isAutoTradingActive ? (
                <Button
                    onClick={handleStopAiAutoTrade} // This now just resets UI state
                    className="w-full bg-red-600 hover:bg-red-700 text-primary-foreground"
                >
                    <Square className="mr-2 h-5 w-5" />
                    Stop/Reset AI Session
                </Button>
                ) : (
                <Button
                    onClick={handleStartAiAutoTrade}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-primary-foreground"
                    disabled={isAiLoading || !selectedUserTradeType /* Other conditions like stake can be added */}
                >
                    <Bot className="mr-2 h-5 w-5" /> 
                    {isAiLoading ? 'Initializing AI Trades...' : 'Start AI Volatility Trading'}
                </Button>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Volatility Index trading involves high risk. AI strategies are experimental. All trading is simulated.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
             <TradingChart 
                instrument={currentVolatilityInstrument}
                onInstrumentChange={handleInstrumentChange}
                instrumentsToShow={VOLATILITY_INSTRUMENTS}
                isMarketOpen={true} 
                marketStatusMessage={`${currentVolatilityInstrument} market is Open 24/7.`}
             />
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Active AI Volatility Trades ({paperTradingMode === 'live' ? 'Real - Simulated' : 'Demo'})</CardTitle>
                <CardDescription>Monitoring automated volatility trades. Stop-Loss is 5% of entry.</CardDescription>
              </CardHeader>
              <CardContent>
                {activeAutomatedTrades.length === 0 && !isAutoTradingActive && !isAiLoading ? (
                    <p className="text-muted-foreground text-center py-4">No active AI volatility trades. Start a session to begin.</p>
                ) : activeAutomatedTrades.length === 0 && isAutoTradingActive && isAiLoading ? (
                     <p className="text-muted-foreground text-center py-4">AI is analyzing markets for volatility trades...</p>
                ) : activeAutomatedTrades.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Stake</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Stop-Loss</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>P/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAutomatedTrades.map(trade => (
                      <TableRow key={trade.id}>
                        <TableCell>{trade.instrument} {trade.error ? <Badge variant="destructive">Placement Error</Badge> : ''}</TableCell>
                        <TableCell>
                          <Badge variant={trade.action === 'CALL' ? 'default' : 'destructive'} 
                                 className={trade.action === 'CALL' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                            {trade.action} {/* This is simplified, actual contract type from API is better */}
                          </Badge>
                        </TableCell>
                        <TableCell>${trade.stake.toFixed(2)}</TableCell>
                        <TableCell>{trade.entryPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) || '-'}</TableCell>
                        <TableCell>{trade.currentPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) ?? '-'}</TableCell>
                        <TableCell>{trade.stopLossPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) || '-'}</TableCell>
                        <TableCell>
                           <Badge variant={trade.status === 'pending_execution' ? 'secondary' : (trade.status === 'failed_placement' ? 'destructive' : 'default')}
                                  className={trade.status === 'pending_execution' ? 'bg-yellow-500 text-white' : (trade.status === 'failed_placement' ? 'bg-red-500' : (trade.status === 'won' ? 'bg-green-500' : 'bg-gray-500')) }>
                            {trade.status.replace('_', ' ')}
                           </Badge>
                        </TableCell>
                        <TableCell className={trade.pnl && trade.pnl > 0 ? 'text-green-500' : trade.pnl && trade.pnl < 0 ? 'text-red-500' : ''}>
                          {trade.pnl ? `$${trade.pnl.toFixed(2)}` : (trade.status === 'failed_placement' ? trade.error : '-')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                ) : (
                     <p className="text-muted-foreground text-center py-4">No active AI volatility trades. AI might not have found suitable opportunities.</p>
                )}
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

if (typeof window !== 'undefined' && !(window as any).uuidv4) {
  (window as any).uuidv4 = uuidv4;
}
