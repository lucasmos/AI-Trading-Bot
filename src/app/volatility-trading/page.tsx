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
import { getCandles, placeTrade, getContractStatus, instrumentToDerivSymbol, TradeDetails, DerivContractStatusData } from '@/services/deriv';
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

  const [consecutiveAiCallCount, setConsecutiveAiCallCount] = useState(0);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState<number | null>(null);
  const AI_COOLDOWN_DURATION_MS = 2 * 60 * 1000; // 2 minutes

  const currentBalance = paperTradingMode === 'paper' ? paperBalance : liveBalance;
  const setCurrentBalance = paperTradingMode === 'paper' ? setPaperBalance : setLiveBalance;

  // const router = useRouter(); // already added above
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
    if (authStatus === 'unauthenticated') {
      toast({
        title: "Authentication Required",
        description: "Please log in to start AI auto-trading on volatility indices.",
        variant: "destructive"
      });
      router.push('/auth/login');
      return;
    }

    // The new check `if (authStatus === 'unauthenticated')` is more comprehensive.
    // The old `if (authStatus !== 'authenticated' && paperTradingMode === 'live')` is now covered.
    // if (authStatus !== 'authenticated' && paperTradingMode === 'live') {
    //   toast({ title: "Login Required", description: "AI Auto-Trading on Real Account requires login.", variant: "destructive" });
    //   return;
    // }
    if (autoTradeTotalStake <= 0) {
      toast({ title: "Invalid Stake", description: "Please enter a valid total stake for AI trading.", variant: "destructive" });
      return;
    }
    if (autoTradeTotalStake > currentBalance) {
        toast({ title: `Insufficient ${paperTradingMode === 'paper' ? 'Demo' : 'Real'} Balance`, description: `Total stake $${autoTradeTotalStake.toFixed(2)} exceeds available balance of $${currentBalance.toFixed(2)}.`, variant: "destructive" });
        return;
    }

    if (consecutiveAiCallCount >= 2) {
      if (lastAiCallTimestamp && (Date.now() - lastAiCallTimestamp) < AI_COOLDOWN_DURATION_MS) {
        const remainingTimeSeconds = Math.ceil((AI_COOLDOWN_DURATION_MS - (Date.now() - lastAiCallTimestamp)) / 1000);
        const remainingMinutes = Math.ceil(remainingTimeSeconds / 60);
        toast({ title: "AI Cooldown", description: `AI is cooling down. Please wait ${remainingMinutes} minutes before starting a new auto-trade session.`, variant: "default" });
        return;
      } else {
        setConsecutiveAiCallCount(0); // Cooldown expired, reset count
      }
    }

    setIsAiLoading(true);
    setIsAutoTradingActive(true);
    setActiveAutomatedTrades([]);
    setProfitsClaimable({ totalNetProfit: 0, tradeCount: 0, winningTrades: 0, losingTrades: 0 });

    const targetDerivAccountId = paperTradingMode === 'paper' ? userInfo?.derivDemoAccountId : userInfo?.derivRealAccountId;
    const apiToken = paperTradingMode === 'paper' ? userInfo?.derivDemoApiToken : userInfo?.derivRealApiToken;

    if (!targetDerivAccountId || !apiToken) {
      toast({ title: "Account Error", description: `Deriv ${paperTradingMode} account ID or API token is missing. Please check your Deriv profile settings.`, variant: "destructive" });
      setIsAutoTradingActive(false);
      setIsAiLoading(false);
      return;
    }

    try {
      // ... (instrumentTicksData and instrumentIndicatorsData fetching remains the same)
      const instrumentTicksData: Record<VolatilityInstrumentType, PriceTick[]> = {} as Record<VolatilityInstrumentType, PriceTick[]>;
      const instrumentIndicatorsData: Record<VolatilityInstrumentType, any> = {} as Record<VolatilityInstrumentType, any>;
      
      for (const inst of VOLATILITY_INSTRUMENTS as VolatilityInstrumentType[]) {
        try {
          const candles = await getCandles(inst, 60, 60, apiToken); // Pass token
          if (candles && candles.length > 0) {
            instrumentTicksData[inst] = candles.map(candle => ({ epoch: candle.epoch, price: candle.close, time: candle.time, }));
            const closePrices = candles.map(c => c.close);
            const highPrices = candles.map(c => c.high);
            const lowPrices = candles.map(c => c.low);
            instrumentIndicatorsData[inst] = {
              ...(calculateRSI(closePrices) !== undefined && { rsi: calculateRSI(closePrices) }),
              ...(calculateMACD(closePrices) && { macd: calculateMACD(closePrices) }),
              ...(calculateBollingerBands(closePrices) && { bollingerBands: calculateBollingerBands(closePrices) }),
              ...(calculateEMA(closePrices) !== undefined && { ema: calculateEMA(closePrices) }),
              ...(calculateATR(highPrices, lowPrices, closePrices) !== undefined && { atr: calculateATR(highPrices, lowPrices, closePrices) }),
            };
          } else {
            instrumentTicksData[inst] = []; instrumentIndicatorsData[inst] = {};
            toast({title: `Data Error ${inst}`, description: `Could not fetch sufficient candle data for ${inst}. AI may exclude it.`, variant: 'destructive', duration: 4000});
          }
        } catch (err) {
          instrumentTicksData[inst] = []; instrumentIndicatorsData[inst] = {};
          toast({title: `Data Error ${inst}`, description: `Could not fetch price data for ${inst}: ${(err as Error).message}`, variant: 'destructive', duration: 4000});
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
        toast({ title: "AI Auto-Trade Update (Volatility)", description: strategyResult?.overallReasoning || "AI determined no optimal trades.", duration: 7000 });
        setIsAutoTradingActive(false);
        setIsAiLoading(false);
        return;
      }

      toast({ title: "AI Auto-Trade Strategy Initiated (Volatility)", description: `AI proposes ${strategyResult.tradesToExecute.length} trade(s). ${strategyResult.overallReasoning}`, duration: 7000 });
      setConsecutiveAiCallCount(prev => prev + 1);
      setLastAiCallTimestamp(Date.now());

      const tradesToAttempt: ActiveAutomatedVolatilityTrade[] = [];
      let currentAllocatedStake = 0;

      for (const proposal of strategyResult.tradesToExecute) {
        if (currentAllocatedStake + proposal.stake > autoTradeTotalStake) continue;
        currentAllocatedStake += proposal.stake;
        
        const clientTradeId = uuidv4(); // For UI key and tracking before Deriv ID is known
        const derivApiSymbol = instrumentToDerivSymbol(proposal.instrument as InstrumentType);

        tradesToAttempt.push({
          id: clientTradeId,
          instrument: proposal.instrument as VolatilityInstrumentType,
          derivSymbol: derivApiSymbol,
          action: proposal.action, // This will be 'CALL' or 'PUT' from current AI
          stake: proposal.stake,
          durationSeconds: proposal.durationSeconds,
          durationUnit: 's', // Assuming seconds from AI for now
          reasoning: proposal.reasoning,
          last_digit_prediction: proposal.last_digit_prediction, // If AI provides it
          startTime: Date.now(),
          status: 'pending_placement',
        });
      }

      setActiveAutomatedTrades(tradesToAttempt); // Show trades as pending

      // Sequentially place trades and update their status
      for (let i = 0; i < tradesToAttempt.length; i++) {
        const tradeToPlace = tradesToAttempt[i];
        try {
          const tradeDetails: TradeDetails = {
            symbol: tradeToPlace.derivSymbol,
            // TODO: Map proposal.action to specific Deriv contract_type. For now, assuming CALL/PUT.
            // This will require AI to output more specific contract_type or a mapping here.
            contract_type: tradeToPlace.action.toUpperCase(), // e.g. "CALL", "PUT"
            duration: tradeToPlace.durationSeconds,
            duration_unit: tradeToPlace.durationUnit || 's',
            amount: tradeToPlace.stake,
            currency: 'USD',
            basis: 'stake',
            token: apiToken,
            trade_category: 'volatility_general', // Or 'volatility_digits' if applicable
            // last_digit_prediction: tradeToPlace.last_digit_prediction, // Pass if it's a digit trade
          };

          // Specific handling for digit trades based on current AI output structure
          if (tradeToPlace.action.toUpperCase().startsWith("DIGIT") && tradeToPlace.last_digit_prediction !== undefined) {
            tradeDetails.trade_category = 'volatility_digits';
            tradeDetails.last_digit_prediction = tradeToPlace.last_digit_prediction;
          }


          const derivTradeResponse = await placeTrade(tradeDetails, targetDerivAccountId);

          setActiveAutomatedTrades(prev => prev.map(t => t.id === tradeToPlace.id ? {
            ...t,
            derivContractId: derivTradeResponse.contract_id,
            entryPrice: derivTradeResponse.entry_spot,
            buyPrice: derivTradeResponse.buy_price,
            status: 'open',
            startTime: Date.now(), // Update startTime to when it was actually placed
          } : t));

          toast({ title: `Trade Placed: ${tradeToPlace.instrument}`, description: `Contract ID: ${derivTradeResponse.contract_id}`, variant: "default" });

        } catch (placementError: any) {
          console.error(`Error placing trade for ${tradeToPlace.instrument}:`, placementError);
          toast({ title: `Trade Failed: ${tradeToPlace.instrument}`, description: placementError.message, variant: "destructive" });
          setActiveAutomatedTrades(prev => prev.map(t => t.id === tradeToPlace.id ? { ...t, status: 'error_placement', placementError: placementError.message } : t));
        }
      }

    } catch (error) {
      toast({ title: "AI Auto-Trade Failed (Volatility)", description: `Could not execute volatility trading strategy: ${(error as Error).message}`, variant: "destructive" });
      setIsAutoTradingActive(false); // Ensure this is reset if the whole process fails early
    } finally {
      setIsAiLoading(false);
      // isAutoTradingActive remains true if trades were initiated, will be set to false when all trades conclude.
      // If no trades were initiated or all failed placement, it should be reset.
      // Check activeAutomatedTrades for any 'open' or 'pending_placement' status. If none, set isAutoTradingActive to false.
      // This part needs careful handling in the monitoring useEffect.
    }
  }, [autoTradeTotalStake, tradingMode, toast, paperTradingMode, currentBalance, authStatus, setCurrentBalance, setProfitsClaimable, userInfo, selectedAiStrategyId, router, AI_COOLDOWN_DURATION_MS, consecutiveAiCallCount, lastAiCallTimestamp]);

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
    // Clear all intervals if auto trading is stopped or no active trades
    if (!isAutoTradingActive) {
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
      // If there are no trades currently being monitored or pending placement, ensure AI loading is false.
      if (activeAutomatedTrades.every(t => t.status !== 'open' && t.status !== 'pending_placement' && t.status !== 'error_monitoring')) {
        setIsAiLoading(false);
      }
      return;
    }

    // If auto-trading is active but all trades have concluded or failed placement, stop the session.
    if (isAutoTradingActive && activeAutomatedTrades.length > 0 &&
        activeAutomatedTrades.every(t => t.status !== 'open' && t.status !== 'pending_placement' && t.status !== 'error_monitoring')) {
      setIsAutoTradingActive(false);
      toast({ title: "AI Volatility Trading Session Complete", description: `All volatility trades for ${paperTradingMode} account concluded or failed.`});
      return;
    }
    
    // Manage intervals for trades that are 'open'
    activeAutomatedTrades.forEach(trade => {
      if (trade.status === 'open' && trade.derivContractId && !tradeIntervals.current.has(trade.id)) {
        const intervalId = setInterval(async () => {
          const currentApiToken = paperTradingMode === 'paper' ? userInfo?.derivDemoApiToken : userInfo?.derivRealApiToken;
          const currentDerivAccountId = paperTradingMode === 'paper' ? userInfo?.derivDemoAccountId : userInfo?.derivRealAccountId;

          if (!currentApiToken || !currentDerivAccountId || !trade.derivContractId) {
            // This should ideally not happen if trade status is 'open'
            console.error("Missing token, account ID, or contract ID for monitoring trade:", trade.id);
            setActiveAutomatedTrades(prev => prev.map(t => t.id === trade.id ? { ...t, status: 'error_monitoring', finalProfitLoss: -(t.stake) } : t));
            clearInterval(tradeIntervals.current.get(trade.id)!);
            tradeIntervals.current.delete(trade.id);
            return;
          }

          try {
            const contractStatus: DerivContractStatusData = await getContractStatus(trade.derivContractId, currentApiToken, currentDerivAccountId);

            let newStatus: ActiveAutomatedVolatilityTrade['status'] = trade.status;
            let pnl = trade.pnl ?? 0;
            let currentPrice = trade.currentPrice;
            let isSettled = false;

            if (contractStatus) {
              currentPrice = contractStatus.current_spot ?? currentPrice;
              pnl = contractStatus.profit; // This is the actual P/L from Deriv

              if (contractStatus.status === 'won' || contractStatus.status === 'lost' || contractStatus.status === 'sold') {
                newStatus = contractStatus.status;
                isSettled = true;
              } else if (contractStatus.is_expired && contractStatus.is_settleable_now) {
                // Contract might be expired but status not yet 'won'/'lost', re-check status or determine from P/L
                newStatus = contractStatus.profit > 0 ? 'won' : 'lost';
                isSettled = true;
              } else {
                newStatus = 'open'; // Still open
              }
            }


            setActiveAutomatedTrades(prevTrades => prevTrades.map(currentTrade => {
              if (currentTrade.id === trade.id) {
                return { ...currentTrade, status: newStatus, pnl, currentPrice, finalProfitLoss: isSettled ? pnl : undefined, isSettled };
              }
              return currentTrade;
            }));

            if (isSettled) {
              clearInterval(tradeIntervals.current.get(trade.id)!);
              tradeIntervals.current.delete(trade.id);

              // Update balance and profits claimable
              setCurrentBalance(prevBal => parseFloat((prevBal + pnl).toFixed(2)));
              setProfitsClaimable(prevProfits => ({
                totalNetProfit: prevProfits.totalNetProfit + pnl,
                tradeCount: prevProfits.tradeCount + 1,
                winningTrades: newStatus === 'won' ? prevProfits.winningTrades + 1 : prevProfits.winningTrades,
                losingTrades: newStatus === 'lost' ? prevProfits.losingTrades + 1 : prevProfits.losingTrades,
              }));

              toast({
                title: `Trade Concluded: ${trade.instrument}`,
                description: `Status: ${newStatus}, P/L: $${pnl.toFixed(2)}`,
                variant: pnl > 0 ? "default" : "destructive"
              });

              // Save to DB
              if (userInfo?.id && trade.derivContractId) {
                fetch('/api/trades', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', },
                  body: JSON.stringify({
                    userId: userInfo.id, email: userInfo.email, name: userInfo.name,
                    symbol: trade.instrument, type: trade.action.toUpperCase(), // Assuming action is CALL/PUT like
                    amount: trade.stake, price: trade.entryPrice, // Original entry price
                    derivContractId: trade.derivContractId.toString(),
                    derivAccountId: currentDerivAccountId,
                    accountType: paperTradingMode,
                    aiStrategyId: selectedAiStrategyId,
                    status: 'OPEN', // Initial save might be OPEN
                    openTime: new Date(trade.startTime).toISOString(),
                    metadata: {
                        mode: tradingMode, duration: `${trade.durationSeconds}s`, automated: true,
                        tradeCategory: 'volatility', reasoning: trade.reasoning,
                        buyPrice: trade.buyPrice
                    }
                  }),
                })
                .then(res => res.json())
                .then(dbTrade => {
                  if (dbTrade && dbTrade.id) {
                    return fetch(`/api/trades/${dbTrade.id}/close`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', },
                      body: JSON.stringify({
                        exitPrice: contractStatus.current_spot || contractStatus.exit_tick || trade.entryPrice, // Best available exit price
                        metadata: { outcome: newStatus, pnl: pnl, reason: "Automated trade completed via Deriv API" }
                      }),
                    });
                  }
                  throw new Error('Failed to create initial trade record in DB for concluded trade.');
                })
                .then(res => res?.json())
                .then(closedDbTrade => {
                  if (closedDbTrade) console.log(`[VolatilityDashboard] Concluded trade ${trade.derivContractId} saved and closed in DB.`);
                  else console.warn(`[VolatilityDashboard] Failed to close concluded trade ${trade.derivContractId} in DB.`);
                })
                .catch(dbError => console.error("[VolatilityDashboard] Error saving concluded trade to DB:", dbError));
              }
            }
          } catch (statusError: any) {
            console.error(`Error fetching status for contract ${trade.derivContractId}:`, statusError);
            // Potentially increment retry count and if max retries, mark as error_monitoring
            setActiveAutomatedTrades(prev => prev.map(t => t.id === trade.id ? { ...t, status: 'error_monitoring', monitoringRetryCount: (t.monitoringRetryCount || 0) + 1 } : t));
             if ((trade.monitoringRetryCount || 0) >= 2) { // After 3 attempts (0, 1, 2)
                clearInterval(tradeIntervals.current.get(trade.id)!);
                tradeIntervals.current.delete(trade.id);
                toast({title: `Monitoring Error: ${trade.instrument}`, description: `Could not retrieve status after multiple attempts. Assuming loss of stake.`, variant: "destructive"});
                 // Assume loss of stake for balance adjustment
                const assumedLoss = -trade.stake;
                setCurrentBalance(prevBal => parseFloat((prevBal + assumedLoss).toFixed(2)));
                setProfitsClaimable(prevProfits => ({
                    totalNetProfit: prevProfits.totalNetProfit + assumedLoss,
                    tradeCount: prevProfits.tradeCount + 1,
                    losingTrades: prevProfits.losingTrades + 1,
                }));
                 // Also attempt to save this as a 'lost' trade in DB due to monitoring error.
             }
          }
        }, 5000); // Check status every 5 seconds
        tradeIntervals.current.set(trade.id, intervalId);
      }
    });
    
    // Cleanup intervals on component unmount or when dependencies change
    return () => {
      tradeIntervals.current.forEach(intervalId => clearInterval(intervalId));
      tradeIntervals.current.clear();
    };
  }, [activeAutomatedTrades, isAutoTradingActive, paperTradingMode, userInfo, setCurrentBalance, setProfitsClaimable, toast, selectedAiStrategyId, tradingMode]);


  return (
    <div className="container mx-auto py-2 space-y-6">
      <BalanceDisplay balance={currentBalance} accountType={paperTradingMode} />
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
