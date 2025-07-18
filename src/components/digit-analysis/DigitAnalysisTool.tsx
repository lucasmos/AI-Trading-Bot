'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Activity, Target, BarChart3, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { VolatilityInstrumentType, PriceTick } from '@/types';
import { getTicks } from '@/services/deriv';
import { DigitAnalysisService, DigitAnalysisResult, DigitPredictionModel, BotTradingSignal, AllStrategyPredictions } from '@/lib/digit-analysis-service';
import { getInstrumentDecimalPlaces } from '@/lib/utils';

const VOLATILITY_INSTRUMENTS: VolatilityInstrumentType[] = [
  'Volatility 10 Index',
  'Volatility 25 Index', 
  'Volatility 50 Index',
  'Volatility 75 Index',
  'Volatility 100 Index',
  'Volatility 10 (1s) Index',
  'Volatility 25 (1s) Index',
  'Volatility 50 (1s) Index',
  'Volatility 75 (1s) Index',
  'Volatility 100 (1s) Index'
];

export default function DigitAnalysisTool() {
  // State management
  const [selectedInstrument, setSelectedInstrument] = useState<VolatilityInstrumentType>('Volatility 10 Index');
  const [ticks, setTicks] = useState<PriceTick[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [tickCount, setTickCount] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Analysis states
  const [analysis, setAnalysis] = useState<DigitAnalysisResult | null>(null);
  const [prediction, setPrediction] = useState<DigitPredictionModel | null>(null);
  const [tradingSignal, setTradingSignal] = useState<BotTradingSignal | null>(null);
  const [strategyPredictions, setStrategyPredictions] = useState<AllStrategyPredictions | null>(null);

  // Track previous strategy states for toast notifications
  const previousStrategyStates = useRef<{
    digitsEven: 'MATCH_NOW' | 'NO_SIGNAL';
    digitsOdd: 'MATCH_NOW' | 'NO_SIGNAL';
  }>({
    digitsEven: 'NO_SIGNAL',
    digitsOdd: 'NO_SIGNAL'
  });

  // Track pattern detection states for bouncy popup notifications
  const previousPatternStates = useRef<{
    digitsEvenPatternDetected: boolean;
    digitsOddPatternDetected: boolean;
  }>({
    digitsEvenPatternDetected: false,
    digitsOddPatternDetected: false
  });

  // Get last digit from price (including 0 as significant)
  const getLastDigit = useCallback((price: number, instrument: VolatilityInstrumentType): number => {
    // Get the correct decimal places for this instrument to preserve trailing zeros
    const decimalPlaces = getInstrumentDecimalPlaces(instrument);
    const priceStr = price.toFixed(decimalPlaces);
    const lastChar = priceStr.charAt(priceStr.length - 1);
    const lastDigit = parseInt(lastChar);
    
    // Ensure 0 is treated as a valid digit (not NaN or falsy)
    return isNaN(lastDigit) ? 0 : lastDigit;
  }, []);

  // Fetch tick data
  const fetchTickData = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const tickData = await getTicks(selectedInstrument, 200);
      setTicks(tickData);
      setLastUpdate(new Date());
      
      // Set current price and tick from latest data
      if (tickData.length > 0) {
        const latestTick = tickData[tickData.length - 1];
        setCurrentPrice(latestTick.price);
        setCurrentTick(getLastDigit(latestTick.price, selectedInstrument));
        setTickCount(tickData.length);
      }
    } catch (error) {
      console.error('Error fetching tick data:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedInstrument, getLastDigit]);

  // Analyze digit patterns using the advanced service
  const analyzeDigitPatterns = useCallback((tickData: PriceTick[], instrument: VolatilityInstrumentType): DigitAnalysisResult | null => {
    if (tickData.length < 20) {
      return null;
    }

    try {
      return DigitAnalysisService.analyzeDigitPatterns(tickData, instrument);
    } catch (error) {
      console.error('Error analyzing digit patterns:', error);
      return null;
    }
  }, []);

  // Perform analysis when ticks change
  useEffect(() => {
    if (ticks.length > 0) {
      const analysisResult = analyzeDigitPatterns(ticks, selectedInstrument);
      if (analysisResult) {
        setAnalysis(analysisResult);
        
        const predictionResult = DigitAnalysisService.generatePrediction(analysisResult, currentTick);
        setPrediction(predictionResult);
        
        // Generate strategy predictions for all trading strategies
        const allStrategyPredictions = DigitAnalysisService.generateAllStrategyPredictions(analysisResult, currentTick);
        setStrategyPredictions(allStrategyPredictions);
        
        // Entry tick should be the current last digit of the price (0-9)
        // This represents the actual digit we're analyzing for trading decisions
        
        const signal = DigitAnalysisService.generateTradingSignal(predictionResult, analysisResult, currentTick);
        setTradingSignal(signal);
      }
    }
  }, [ticks, analyzeDigitPatterns, currentTick, selectedInstrument]);

  // Effect to detect strategy changes and show toast notifications
  useEffect(() => {
    if (!strategyPredictions) return;

    const currentEvenAction = strategyPredictions.digitsEven.action;
    const currentOddAction = strategyPredictions.digitsOdd.action;

    // Check for new Even strategy signal
    if (currentEvenAction === 'MATCH_NOW' && previousStrategyStates.current.digitsEven === 'NO_SIGNAL') {
      toast.success(
        `🎯 DIGITS EVEN - MATCH NOW!\n3+ consecutive odd digits detected!\nCurrent digit: ${strategyPredictions.digitsEven.currentDigit} (EVEN)`,
        {
          duration: 6000,
          style: {
            background: '#dbeafe',
            border: '2px solid #3b82f6',
            color: '#1e40af',
            fontWeight: 'bold',
            fontSize: '14px'
          },
          icon: '🔵',
          position: 'top-right'
        }
      );
    }

    // Check for new Odd strategy signal
    if (currentOddAction === 'MATCH_NOW' && previousStrategyStates.current.digitsOdd === 'NO_SIGNAL') {
      toast.success(
        `🎯 DIGITS ODD - MATCH NOW!\n3+ consecutive even digits detected!\nCurrent digit: ${strategyPredictions.digitsOdd.currentDigit} (ODD)`,
        {
          duration: 6000,
          style: {
            background: '#f3e8ff',
            border: '2px solid #8b5cf6',
            color: '#7c3aed',
            fontWeight: 'bold',
            fontSize: '14px'
          },
          icon: '🟣',
          position: 'top-right'
        }
      );
    }

    // Update previous states
    previousStrategyStates.current = {
      digitsEven: currentEvenAction,
      digitsOdd: currentOddAction
    };
  }, [strategyPredictions]);

  // Effect to detect pattern changes and show bouncy popup notifications
  useEffect(() => {
    if (!strategyPredictions) return;

    // Check if Even strategy pattern is detected (3+ consecutive odds)
    const evenPatternDetected = strategyPredictions.digitsEven.reasoning.includes('consecutive odd digits detected!') ||
                               strategyPredictions.digitsEven.reasoning.includes('Pattern found:');

    // Check if Odd strategy pattern is detected (3+ consecutive evens)
    const oddPatternDetected = strategyPredictions.digitsOdd.reasoning.includes('consecutive even digits detected!') ||
                              strategyPredictions.digitsOdd.reasoning.includes('Pattern found:');

    // Show bouncy popup for Even strategy pattern detection
    if (evenPatternDetected && !previousPatternStates.current.digitsEvenPatternDetected) {
      toast.success(
        `🚨 PATTERN ALERT!\n3+ consecutive ODD digits detected!\n🎯 MATCH EVEN NEXT!`,
        {
          duration: 8000,
          style: {
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            border: '3px solid #3b82f6',
            color: '#1e40af',
            fontWeight: 'bold',
            fontSize: '16px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)',
            animation: 'bounce 1s infinite'
          },
          icon: '🔵',
          position: 'top-center'
        }
      );
    }

    // Show bouncy popup for Odd strategy pattern detection
    if (oddPatternDetected && !previousPatternStates.current.digitsOddPatternDetected) {
      toast.success(
        `🚨 PATTERN ALERT!\n3+ consecutive EVEN digits detected!\n🎯 MATCH ODD NEXT!`,
        {
          duration: 8000,
          style: {
            background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
            border: '3px solid #8b5cf6',
            color: '#7c3aed',
            fontWeight: 'bold',
            fontSize: '16px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(139, 92, 246, 0.3)',
            animation: 'bounce 1s infinite'
          },
          icon: '🟣',
          position: 'top-center'
        }
      );
    }

    // Update pattern detection states
    previousPatternStates.current = {
      digitsEvenPatternDetected: evenPatternDetected,
      digitsOddPatternDetected: oddPatternDetected
    };
  }, [strategyPredictions]);

  // Live mode effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLive) {
      interval = setInterval(fetchTickData, 2000); // Update every 2 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive, fetchTickData]);

  // Initial data fetch
  useEffect(() => {
    fetchTickData();
  }, [fetchTickData]);

  return (
    <div className="space-y-4">
      <Toaster />
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Individual Strategy Predictions
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-700 dark:text-gray-300">Ticks: <strong>{tickCount}</strong></span>
              </div>
              {isLive && (
                <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-800 dark:text-green-200 font-medium text-xs">LIVE</span>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instrument Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Volatility Instrument</label>
            <select
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value as VolatilityInstrumentType)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <optgroup label="Regular Volatility Indices">
                <option value="Volatility 10 Index">Volatility 10 Index</option>
                <option value="Volatility 25 Index">Volatility 25 Index</option>
                <option value="Volatility 50 Index">Volatility 50 Index</option>
                <option value="Volatility 75 Index">Volatility 75 Index</option>
                <option value="Volatility 100 Index">Volatility 100 Index</option>
              </optgroup>
              <optgroup label="1-Second Volatility Indices">
                <option value="Volatility 10 (1s) Index">Volatility 10 (1s) Index</option>
                <option value="Volatility 25 (1s) Index">Volatility 25 (1s) Index</option>
                <option value="Volatility 50 (1s) Index">Volatility 50 (1s) Index</option>
                <option value="Volatility 75 (1s) Index">Volatility 75 (1s) Index</option>
                <option value="Volatility 100 (1s) Index">Volatility 100 (1s) Index</option>
              </optgroup>
            </select>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={fetchTickData}
              disabled={isAnalyzing || isLive}
              variant="outline"
              size="sm"
            >
              {isAnalyzing ? 'Analyzing...' : 'Manual Refresh'}
            </Button>
            <Button
              onClick={() => setIsLive(!isLive)}
              variant={isLive ? "default" : "secondary"}
              size="sm"
              className={isLive ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800" : ""}
            >
              <div className="flex items-center gap-2">
                {isLive && <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>}
                {isLive ? 'Live Mode ON' : 'Start Live Mode'}
              </div>
            </Button>
          </div>

          {/* Current Price Display */}
          {currentPrice && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700">
              <CardContent className="pt-4">
                <div className="text-center space-y-2">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Price - {selectedInstrument}</div>
                  <div className="text-3xl font-mono font-bold text-gray-800 dark:text-gray-200">
                    {(() => {
                      // Use correct decimal places to preserve trailing zeros (including 0)
                      const decimalPlaces = getInstrumentDecimalPlaces(selectedInstrument);
                      const priceStr = currentPrice.toFixed(decimalPlaces);
                      const lastDigitIndex = priceStr.length - 1;
                      const beforeLastDigit = priceStr.substring(0, lastDigitIndex);
                      const lastDigit = priceStr.charAt(lastDigitIndex);

                      return (
                        <>
                          <span className="text-gray-600 dark:text-gray-400">{beforeLastDigit}</span>
                          <span className="text-5xl font-black text-blue-600 dark:text-blue-400 bg-yellow-200 dark:bg-yellow-800 px-2 py-1 rounded-lg border-2 border-yellow-400 dark:border-yellow-600 shadow-lg animate-pulse">
                            {lastDigit}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex justify-center items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></div>
                      <span className="text-gray-700 dark:text-gray-300">Current Last Digit: <strong>{currentTick}</strong></span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status */}
          {lastUpdate && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
              <div className="flex items-center gap-2">
                {isLive && (
                  <>
                    <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></div>
                    <Badge variant="default" className="bg-green-600 dark:bg-green-700">LIVE</Badge>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategy Predictions */}
      {strategyPredictions && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Digits Match Strategy */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Target className="h-4 w-4" />
                  Digits Match
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategyPredictions.digitsMatch.action === 'MATCH_NOW' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900 px-3 py-2 rounded-lg border-2 border-green-400 dark:border-green-600 animate-pulse">
                      <div className="w-3 h-3 bg-green-600 dark:bg-green-400 rounded-full animate-bounce"></div>
                      <span className="text-green-800 dark:text-green-200 font-bold text-sm">MATCH NOW!</span>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Match with digit:</div>
                      <div className="text-4xl font-bold font-mono text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-lg border-2 border-green-200 dark:border-green-700">
                        {strategyPredictions.digitsMatch.targetDigit}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Confidence: {strategyPredictions.digitsMatch.confidence.toFixed(1)}%
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-gray-500 dark:text-gray-400 text-sm">No Signal</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Waiting for better opportunity
                    </div>
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  {strategyPredictions.digitsMatch.reasoning}
                </div>
              </CardContent>
            </Card>

            {/* Digits Even Strategy */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Activity className="h-4 w-4" />
                  Digits Even
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategyPredictions.digitsEven.action === 'MATCH_NOW' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900 px-3 py-2 rounded-lg border-2 border-blue-400 dark:border-blue-600 animate-pulse">
                      <div className="w-3 h-3 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce"></div>
                      <span className="text-blue-800 dark:text-blue-200 font-bold text-sm">MATCH NOW!</span>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pattern: 3+ Consecutive Odds → Even</div>
                      <div className="text-4xl font-bold font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-700">
                        {strategyPredictions.digitsEven.currentDigit}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">EVEN DIGIT DETECTED!</div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Confidence: {strategyPredictions.digitsEven.confidence.toFixed(1)}%
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    {/* Check if we should show popup notification for pattern detection */}
                    {(strategyPredictions.digitsEven.reasoning.includes('consecutive odd digits detected!') ||
                      strategyPredictions.digitsEven.reasoning.includes('Pattern found:')) ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2 bg-blue-100 dark:bg-blue-900 px-4 py-3 rounded-full border-2 border-blue-400 dark:border-blue-600 animate-bounce">
                          <div className="w-3 h-3 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></div>
                          <span className="text-blue-800 dark:text-blue-200 font-bold text-sm">PATTERN DETECTED!</span>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-3">
                          <div className="text-blue-800 dark:text-blue-200 font-semibold text-sm mb-1">
                            3+ Consecutive Odds Found!
                          </div>
                          <div className="text-blue-700 dark:text-blue-300 text-xs">
                            Wait for EVEN digit to appear, then trade DIGITS EVEN
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm">No Signal</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Current digit: {strategyPredictions.digitsEven.currentDigit} ({strategyPredictions.digitsEven.currentDigit % 2 === 0 ? 'Even' : 'Odd'})
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  {strategyPredictions.digitsEven.reasoning}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Digits Odd Strategy */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Activity className="h-4 w-4" />
                  Digits Odd
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategyPredictions.digitsOdd.action === 'MATCH_NOW' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900 px-3 py-2 rounded-lg border-2 border-purple-400 dark:border-purple-600 animate-pulse">
                      <div className="w-3 h-3 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce"></div>
                      <span className="text-purple-800 dark:text-purple-200 font-bold text-sm">MATCH NOW!</span>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pattern: 3+ Consecutive Evens → Odd</div>
                      <div className="text-3xl font-bold font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-3 py-2 rounded-lg border-2 border-purple-200 dark:border-purple-700">
                        {strategyPredictions.digitsOdd.currentDigit}
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-medium">ODD DIGIT DETECTED!</div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Confidence: {strategyPredictions.digitsOdd.confidence.toFixed(1)}%
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    {/* Check if we should show popup notification for pattern detection */}
                    {(strategyPredictions.digitsOdd.reasoning.includes('consecutive even digits detected!') ||
                      strategyPredictions.digitsOdd.reasoning.includes('Pattern found:')) ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2 bg-purple-100 dark:bg-purple-900 px-4 py-3 rounded-full border-2 border-purple-400 dark:border-purple-600 animate-bounce">
                          <div className="w-3 h-3 bg-purple-600 dark:bg-purple-400 rounded-full animate-pulse"></div>
                          <span className="text-purple-800 dark:text-purple-200 font-bold text-sm">PATTERN DETECTED!</span>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-700 rounded-lg p-3">
                          <div className="text-purple-800 dark:text-purple-200 font-semibold text-sm mb-1">
                            3+ Consecutive Evens Found!
                          </div>
                          <div className="text-purple-700 dark:text-purple-300 text-xs">
                            Wait for ODD digit to appear, then trade DIGITS ODD
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm">No Signal</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Current: {strategyPredictions.digitsOdd.currentDigit} ({strategyPredictions.digitsOdd.currentDigit % 2 === 0 ? 'Even' : 'Odd'})
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  {strategyPredictions.digitsOdd.reasoning}
                </div>
              </CardContent>
            </Card>

            {/* Digits Over Strategy */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <TrendingUp className="h-4 w-4" />
                  Digits Over
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategyPredictions.digitsOver.action === 'MATCH_NOW' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900 px-3 py-2 rounded-lg border-2 border-orange-400 dark:border-orange-600 animate-pulse">
                      <div className="w-3 h-3 bg-orange-600 dark:bg-orange-400 rounded-full animate-bounce"></div>
                      <span className="text-orange-800 dark:text-orange-200 font-bold text-sm">MATCH NOW!</span>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current digit is OVER 5:</div>
                      <div className="text-3xl font-bold font-mono text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-3 py-2 rounded-lg border-2 border-orange-200 dark:border-orange-700">
                        {strategyPredictions.digitsOver.currentDigit}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Confidence: {strategyPredictions.digitsOver.confidence.toFixed(1)}%
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-gray-500 dark:text-gray-400 text-sm">No Signal</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Current: {strategyPredictions.digitsOver.currentDigit} (≤5)
                    </div>
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  {strategyPredictions.digitsOver.reasoning}
                </div>
              </CardContent>
            </Card>

            {/* Digits Under Strategy */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <TrendingDown className="h-4 w-4" />
                  Digits Under
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategyPredictions.digitsUnder.action === 'MATCH_NOW' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900 px-3 py-2 rounded-lg border-2 border-red-400 dark:border-red-600 animate-pulse">
                      <div className="w-3 h-3 bg-red-600 dark:bg-red-400 rounded-full animate-bounce"></div>
                      <span className="text-red-800 dark:text-red-200 font-bold text-sm">MATCH NOW!</span>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current digit is UNDER/EQUAL 5:</div>
                      <div className="text-3xl font-bold font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg border-2 border-red-200 dark:border-red-700">
                        {strategyPredictions.digitsUnder.currentDigit}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Confidence: {strategyPredictions.digitsUnder.confidence.toFixed(1)}%
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-gray-500 dark:text-gray-400 text-sm">No Signal</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Current: {strategyPredictions.digitsUnder.currentDigit} (&gt;5)
                    </div>
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  {strategyPredictions.digitsUnder.reasoning}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!strategyPredictions && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Analyzing tick data...</p>
          <p className="text-sm mt-2">Please wait while we process the data</p>
        </div>
      )}
    </div>
  );
}
