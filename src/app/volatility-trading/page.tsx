'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BalanceDisplay } from '@/components/dashboard/balance-display';
import { TradingChart } from '@/components/dashboard/trading-chart'; 
import type { VolatilityInstrumentType, TradingMode, PaperTradingMode, ActiveAutomatedVolatilityTrade, ProfitsClaimable, PriceTick, InstrumentType } from '@/types/index';
import { generateVolatilityTradingStrategy, type VolatilityTradingStrategyInput } from '@/ai/flows/volatility-trading-strategy-flow';
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

export default function VolatilityTradingPage() {
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
  const [selectedAiStrategyId, setSelectedAiStrategyId] = useState<string>(DEFAULT_AI_STRATEGY_ID);
  
  const [autoTradeTotalStake, setAutoTradeTotalStake] = useState<number>(100);
  const [isAutoTradingActive, setIsAutoTradingActive] = useState(false);
  const [activeAutomatedTrades, setActiveAutomatedTrades] = useState<ActiveAutomatedVolatilityTrade[]>([]);
  const [profitsClaimable, setProfitsClaimable] = useState<ProfitsClaimable>({
    totalNetProfit: 0,
    tradeCount: 0,
    winningTrades: 0,
    losingTrades: 0,
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const tradeIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const currentBalance = paperTradingMode === 'paper' ? paperBalance : liveBalance;
  const setCurrentBalance = paperTradingMode === 'paper' ? setPaperBalance : setLiveBalance;

  const { toast } = useToast();

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
    if (authStatus !== 'authenticated' && paperTradingMode === 'live') {
      toast({ title: "Login Required", description: "AI Auto-Trading on Real Account requires login.", variant: "destructive" });
      return;
    }
    if (autoTradeTotalStake <= 0) {
      toast({ title: "Invalid Stake", description: "Please enter a valid total stake for AI trading.", variant: "destructive" });
      return;
    }
    if (autoTradeTotalStake > currentBalance) {
        toast({ title: `Insufficient ${paperTradingMode === 'paper' ? 'Demo' : 'Real'} Balance`, description: `Total stake $${autoTradeTotalStake.toFixed(2)} exceeds available balance of $${currentBalance.toFixed(2)}.`, variant: "destructive" });
        return;
    }

    setIsAiLoading(true); 
    setIsAutoTradingActive(true);
    setActiveAutomatedTrades([]); 
    setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });


    try {
      const instrumentTicksData: Record<VolatilityInstrumentType, PriceTick[]> = {} as Record<VolatilityInstrumentType, PriceTick[]>;
      const instrumentIndicatorsData: Record<VolatilityInstrumentType, any> = {} as Record<VolatilityInstrumentType, any>; // Adjust 'any' to a more specific type if available
      
      for (const inst of VOLATILITY_INSTRUMENTS as VolatilityInstrumentType[]) {
        try {
          const candles = await getCandles(inst, 60); // Fetch 60 candles for indicator calculation
          if (candles && candles.length > 0) {
            instrumentTicksData[inst] = candles.map(candle => ({
              epoch: candle.epoch,
              price: candle.close,
              time: candle.time,
            }));

            const closePrices = candles.map(c => c.close);
            const highPrices = candles.map(c => c.high);
            const lowPrices = candles.map(c => c.low);

            // Calculate latest values for each indicator
            const rsi = calculateRSI(closePrices);
            const macd = calculateMACD(closePrices);
            const bb = calculateBollingerBands(closePrices);
            const ema = calculateEMA(closePrices);
            const atr = calculateATR(highPrices, lowPrices, closePrices);

            instrumentIndicatorsData[inst] = {
              ...(rsi !== undefined && { rsi }),
              ...(macd && { macd }), // macd itself is an object { macd, signal, histogram } or undefined
              ...(bb && { bollingerBands: bb }), // bb itself is an object { upper, middle, lower } or undefined
              ...(ema !== undefined && { ema }),
              ...(atr !== undefined && { atr }),
            };

          } else {
            instrumentTicksData[inst] = [];
            instrumentIndicatorsData[inst] = {}; // No data for indicators
            toast({title: `Data Error ${inst}`, description: `Could not fetch sufficient candle data for ${inst}. AI may exclude it or work with limited info.`, variant: 'destructive', duration: 4000});
          }
        } catch (err) {
          instrumentTicksData[inst] = []; 
          instrumentIndicatorsData[inst] = {}; // Error fetching data
          toast({title: `Data Error ${inst}`, description: `Could not fetch price data for ${inst}. AI may exclude it.`, variant: 'destructive', duration: 4000});
        }
      }
      
      const strategyInput: VolatilityTradingStrategyInput = {
        totalStake: autoTradeTotalStake,
        instruments: VOLATILITY_INSTRUMENTS as VolatilityInstrumentType[],
        tradingMode: tradingMode,
        aiStrategyId: selectedAiStrategyId,
        instrumentTicks: instrumentTicksData,
        instrumentIndicators: instrumentIndicatorsData,
      };
      const strategyResult = await generateVolatilityTradingStrategy(strategyInput);

      if (!strategyResult || strategyResult.tradesToExecute.length === 0) {
        const reason = strategyResult?.overallReasoning || "AI determined no optimal trades at this moment for volatility indices.";
        toast({ title: "AI Auto-Trade Update (Volatility)", description: `AI analysis complete. ${reason}`, duration: 7000 });
        setIsAutoTradingActive(false); 
        return;
      }
      
      toast({ title: "AI Auto-Trade Strategy Initiated (Volatility)", description: `AI proposes ${strategyResult.tradesToExecute.length} trade(s) for ${paperTradingMode} account on volatility indices. ${strategyResult.overallReasoning}`, duration: 7000});

      const newTrades: ActiveAutomatedVolatilityTrade[] = [];
      let currentAllocatedStake = 0;

      for (const proposal of strategyResult.tradesToExecute) {
        if (currentAllocatedStake + proposal.stake > autoTradeTotalStake) continue; 
        currentAllocatedStake += proposal.stake;

        const currentTicks = instrumentTicksData[proposal.instrument as VolatilityInstrumentType];
        if (!currentTicks || currentTicks.length === 0) {
          toast({ title: "Auto-Trade Skipped (Volatility)", description: `No price data for ${proposal.instrument} to initiate AI trade.`, variant: "destructive"});
          continue;
        }
        const entryPrice = currentTicks[currentTicks.length - 1].price;
        
        let stopLossPrice;
        const stopLossPercentage = 0.05; 
        if (proposal.action === 'CALL') stopLossPrice = entryPrice * (1 - stopLossPercentage);
        else stopLossPrice = entryPrice * (1 + stopLossPercentage);
        
        stopLossPrice = parseFloat(stopLossPrice.toFixed(getInstrumentDecimalPlaces(proposal.instrument as InstrumentType)));

        const tradeId = uuidv4();
        newTrades.push({
          id: tradeId,
          instrument: proposal.instrument as VolatilityInstrumentType,
          action: proposal.action,
          stake: proposal.stake,
          durationSeconds: proposal.durationSeconds,
          reasoning: proposal.reasoning,
          entryPrice,
          stopLossPrice, 
          startTime: Date.now(),
          status: 'active',
          currentPrice: entryPrice,
        });
      }

      if (newTrades.length === 0) {
        toast({ title: "AI Auto-Trade Update (Volatility)", description: "No valid volatility trades could be initiated based on AI proposals and current data.", duration: 7000 });
        setIsAutoTradingActive(false);
      }
      setActiveAutomatedTrades(newTrades);


    } catch (error) {
      toast({ title: "AI Auto-Trade Failed (Volatility)", description: `Could not execute volatility trading strategy: ${(error as Error).message}`, variant: "destructive" });
      setIsAutoTradingActive(false);
    } finally {
      setIsAiLoading(false); 
    }
  }, [autoTradeTotalStake, tradingMode, toast, paperTradingMode, currentBalance, authStatus, setCurrentBalance, setProfitsClaimable, userInfo, selectedAiStrategyId]);

  const handleStopAiAutoTrade = () => {
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
  
  useEffect(() => {
    if (isAutoTradingActive && activeAutomatedTrades.length === 0 && !isAiLoading) {
      setIsAutoTradingActive(false);
    }

    if (!isAutoTradingActive || activeAutomatedTrades.length === 0) { 
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
      return; 
    }
    
    activeAutomatedTrades.forEach(trade => {
      if (trade.status === 'active' && !tradeIntervals.current.has(trade.id)) {
        const intervalId = setInterval(() => {
          setActiveAutomatedTrades(prevTrades => {
            let allTradesConcluded = true;
            const updatedTrades = prevTrades.map(currentTrade => {
              if (currentTrade.id !== trade.id || currentTrade.status !== 'active') {
                if(currentTrade.status === 'active') allTradesConcluded = false;
                return currentTrade;
              }

              let newStatus: ActiveAutomatedVolatilityTrade['status'] = currentTrade.status;
              let pnl = currentTrade.pnl ?? 0;
              let newCurrentPrice = currentTrade.currentPrice ?? currentTrade.entryPrice;
              const decimalPlaces = getInstrumentDecimalPlaces(currentTrade.instrument);

              const priceChangeFactor = (Math.random() - 0.5) * (currentTrade.instrument.includes("100") ? 0.005 : 0.0005); 
              newCurrentPrice += priceChangeFactor * newCurrentPrice; 
              newCurrentPrice = parseFloat(newCurrentPrice.toFixed(decimalPlaces));

              if (currentTrade.action === 'CALL' && newCurrentPrice <= currentTrade.stopLossPrice) {
                newStatus = 'lost_stoploss'; pnl = -currentTrade.stake;
              } else if (currentTrade.action === 'PUT' && newCurrentPrice >= currentTrade.stopLossPrice) {
                newStatus = 'lost_stoploss'; pnl = -currentTrade.stake;
              }

              if (newStatus === 'active' && Date.now() >= currentTrade.startTime + currentTrade.durationSeconds * 1000) {
                const isWin = Math.random() < 0.70; 
                if (isWin) { newStatus = 'won'; pnl = currentTrade.stake * 0.85; } 
                else { newStatus = 'lost_duration'; pnl = -currentTrade.stake; }
              }
              
              if (newStatus !== 'active') {
                clearInterval(tradeIntervals.current.get(trade.id)!);
                tradeIntervals.current.delete(trade.id);
                
                if (userInfo?.id) {
                  console.log('[VolatilityDashboard] Storing automated trade in database for user:', userInfo.id);
                  fetch('/api/trades', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      userId: userInfo.id,
                      email: userInfo.email,
                      name: userInfo.name,
                      symbol: currentTrade.instrument,
                      type: currentTrade.action === 'CALL' ? 'buy' : 'sell',
                      amount: currentTrade.stake,
                      price: currentTrade.entryPrice,
                      aiStrategyId: selectedAiStrategyId,
                      metadata: {
                        mode: tradingMode,
                        duration: `${currentTrade.durationSeconds}s`,
                        accountType: paperTradingMode,
                        automated: true,
                        tradeCategory: 'volatility',
                        reasoning: currentTrade.reasoning
                      }
                    }),
                  })
                  .then(response => response.json())
                  .then(createdTrade => {
                    if (createdTrade && createdTrade.id) {
                      console.log('[VolatilityDashboard] Automated trade created, now closing:', createdTrade.id);
                      return fetch(`/api/trades/${createdTrade.id}/close`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          exitPrice: newCurrentPrice,
                          metadata: {
                            outcome: newStatus,
                            pnl: pnl,
                            reason: "Automated trade completed"
                          }
                        }),
                      });
                    }
                    throw new Error('Failed to create automated trade in DB');
                  })
                  .then(response => response?.json())
                  .then(closedTrade => {
                     if (closedTrade) {
                        console.log('[VolatilityDashboard] Automated trade closed successfully:', closedTrade.id);
                     } else {
                        console.warn('[VolatilityDashboard] Failed to close automated trade in DB or no trade to close.');
                     }
                  })
                  .catch(error => {
                    console.error("[VolatilityDashboard] Error processing automated trade in database:", error);
                  });
                }
                
                setTimeout(() => { 
                  setCurrentBalance(prevBal => parseFloat((prevBal + pnl).toFixed(2)));
                  setProfitsClaimable(prevProfits => ({
                    totalNetProfit: prevProfits.totalNetProfit + pnl,
                    tradeCount: prevProfits.tradeCount + 1,
                    winningTrades: newStatus === 'won' ? prevProfits.winningTrades + 1 : prevProfits.winningTrades,
                    losingTrades: (newStatus === 'lost_duration' || newStatus === 'lost_stoploss') ? prevProfits.losingTrades + 1 : prevProfits.losingTrades,
                  }));
                  
                  toast({
                    title: `Auto-Trade Ended (Volatility - ${paperTradingMode}): ${currentTrade.instrument}`,
                    description: `Status: ${newStatus}, P/L: $${pnl.toFixed(2)}`,
                    variant: pnl > 0 ? "default" : "destructive"
                  });
                }, 0);
              } else {
                allTradesConcluded = false; 
              }
              return { ...currentTrade, status: newStatus, pnl, currentPrice: newCurrentPrice };
            });

            if (allTradesConcluded && isAutoTradingActive) { 
                 setTimeout(() => { 
                    setIsAutoTradingActive(false);
                    toast({ title: "AI Volatility Trading Session Complete", description: `All volatility trades for ${paperTradingMode} account concluded.`});
                }, 100); 
            }
            return updatedTrades;
          });
        }, 1000); 
        tradeIntervals.current.set(trade.id, intervalId);
      }
    });
    
    return () => {
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
    };
  }, [activeAutomatedTrades, isAutoTradingActive, paperTradingMode, setCurrentBalance, setProfitsClaimable, toast, isAiLoading, userInfo, selectedAiStrategyId]);


  return (
    <div className="container mx-auto py-2 space-y-6">
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
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                  <p><strong>Conservative:</strong> Focuses on capital preservation with lower risk.</p>
                  <p><strong>Balanced:</strong> Aims for a moderate balance between risk and reward.</p>
                  <p><strong>Aggressive:</strong> Seeks higher potential returns, accepting higher risk.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="volatility-ai-strategy">AI Strategy</Label>
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
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                  <p><strong>Dynamic Adaptive:</strong> Flexible strategy, adapts to market changes.</p>
                  <p><strong>Trend Rider:</strong> Follows strong market trends.</p>
                  <p><strong>Range Negotiator:</strong> For sideways-moving markets.</p>
                  <p><em>Risk for all strategies is set by your chosen Trading Mode.</em></p>
                </div>
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
                    value={autoTradeTotalStake}
                    onChange={handleAutoStakeChange}
                    placeholder="e.g., 100"
                    className="w-full pl-8"
                    min="10"
                    disabled={isAutoTradingActive || isAiLoading}
                    />
                </div>
                {autoTradeTotalStake > currentBalance && !isAutoTradingActive && !isAiLoading && (
                    <p className="text-xs text-destructive mt-1">Stake exceeds available balance.</p>
                )}
              </div>
              {isAutoTradingActive ? (
                <Button
                    onClick={handleStopAiAutoTrade}
                    className="w-full bg-red-600 hover:bg-red-700 text-primary-foreground"
                    disabled={isAiLoading && !isAutoTradingActive} 
                >
                    <Square className="mr-2 h-5 w-5" />
                    Stop AI Volatility Trading
                </Button>
                ) : (
                <Button
                    onClick={handleStartAiAutoTrade}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-primary-foreground"
                    disabled={isAiLoading || autoTradeTotalStake <=0 || autoTradeTotalStake > currentBalance}
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
                        <TableCell>{trade.instrument}</TableCell>
                        <TableCell>
                          <Badge variant={trade.action === 'CALL' ? 'default' : 'destructive'} 
                                 className={trade.action === 'CALL' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}>
                            {trade.action}
                          </Badge>
                        </TableCell>
                        <TableCell>${trade.stake.toFixed(2)}</TableCell>
                        <TableCell>{trade.entryPrice.toFixed(getInstrumentDecimalPlaces(trade.instrument))}</TableCell>
                        <TableCell>{trade.currentPrice?.toFixed(getInstrumentDecimalPlaces(trade.instrument)) ?? '-'}</TableCell>
                        <TableCell>{trade.stopLossPrice.toFixed(getInstrumentDecimalPlaces(trade.instrument))}</TableCell>
                        <TableCell>
                           <Badge variant={trade.status === 'active' ? 'secondary' : (trade.status === 'won' ? 'default' : 'destructive')}
                                  className={trade.status === 'active' ? 'bg-blue-500 text-white' : (trade.status === 'won' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600')}>
                            {trade.status}
                           </Badge>
                        </TableCell>
                        <TableCell className={trade.pnl && trade.pnl > 0 ? 'text-green-500' : trade.pnl && trade.pnl < 0 ? 'text-red-500' : ''}>
                          {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '-'}
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
