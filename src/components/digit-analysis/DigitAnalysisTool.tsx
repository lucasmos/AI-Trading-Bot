'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Target, Activity, BarChart3, Clock } from 'lucide-react';
import { VolatilityInstrumentType, PriceTick } from '@/types';
import { getTicks } from '@/services/deriv';
import { DigitAnalysisService, DigitAnalysisResult, DigitPredictionModel, BotTradingSignal } from '@/lib/digit-analysis-service';
import { getInstrumentDecimalPlaces } from '@/lib/utils';

interface DigitAnalysis {
  digit: number;
  frequency: number;
  probability: number;
  lastSeen: number;
  streak: number;
  trend: 'rising' | 'falling' | 'stable';
}

interface DigitPrediction {
  predictedDigit: number;
  confidence: number;
  estimatedRounds: number;
  entryPoint: number;
  strategy: 'match' | 'even' | 'odd' | 'over' | 'under';
  reasoning: string;
}

interface DigitPatternAnalysis {
  evenOddBias: { even: number; odd: number };
  overUnderBias: { over5: number; under5: number };
  digitDistribution: DigitAnalysis[];
  consecutivePatterns: Record<string, number>;
  risefall: { rise: number; fall: number };
}

const VOLATILITY_INSTRUMENTS: VolatilityInstrumentType[] = [
  // Regular Volatility Indices
  'Volatility 10 Index',
  'Volatility 25 Index',
  'Volatility 50 Index',
  'Volatility 75 Index',
  'Volatility 100 Index',
  // 1-Second Volatility Indices
  'Volatility 10 (1s) Index',
  'Volatility 25 (1s) Index',
  'Volatility 50 (1s) Index',
  'Volatility 75 (1s) Index',
  'Volatility 100 (1s) Index'
];

export default function DigitAnalysisTool() {
  const [selectedInstrument, setSelectedInstrument] = useState<VolatilityInstrumentType>('Volatility 10 Index');
  const [ticks, setTicks] = useState<PriceTick[]>([]);
  const [analysis, setAnalysis] = useState<DigitAnalysisResult | null>(null);
  const [prediction, setPrediction] = useState<DigitPredictionModel | null>(null);
  const [tradingSignal, setTradingSignal] = useState<BotTradingSignal | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLive, setIsLive] = useState(true); // Start live by default
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [entryTick, setEntryTick] = useState<number>(0);
  const [tickCount, setTickCount] = useState<number>(0);



  // Get last digit from price (including 0 as significant)
  const getLastDigit = useCallback((price: number, instrument: VolatilityInstrumentType): number => {
    // Get the correct decimal places for this instrument
    const decimalPlaces = getInstrumentDecimalPlaces(instrument);

    // Format the price with the correct decimal places to preserve trailing zeros
    const priceStr = price.toFixed(decimalPlaces);
    const lastChar = priceStr.charAt(priceStr.length - 1);
    const lastDigit = parseInt(lastChar);

    // Ensure 0 is treated as a valid digit (not NaN or falsy)
    return isNaN(lastDigit) ? 0 : lastDigit;
  }, []);

  // Fetch historical tick data
  const fetchTickData = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const tickData = await getTicks(selectedInstrument, 100); // Get last 100 ticks
      setTicks(tickData);

      // Set current price and tick from latest data
      if (tickData.length > 0) {
        const latestTick = tickData[tickData.length - 1];
        setCurrentPrice(latestTick.price);
        setCurrentTick(getLastDigit(latestTick.price, selectedInstrument));
        setTickCount(tickData.length);
      }

      setLastUpdate(new Date());
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

        // Entry tick should be the current last digit of the price (0-9)
        // This represents the actual digit we're analyzing for trading decisions

        const signal = DigitAnalysisService.generateTradingSignal(predictionResult, analysisResult, currentTick);
        setTradingSignal(signal);
      }
    }
  }, [ticks, analyzeDigitPatterns, currentTick, selectedInstrument]);

  // Auto-refresh when live mode is enabled (constantly running)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(fetchTickData, 1000); // Refresh every 1 second for more responsive updates
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Digit Analysis Tool
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <span>Ticks: <strong>{tickCount}</strong></span>
              </div>
              {isLive && (
                <div className="flex items-center gap-2 bg-green-100 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                  <span className="text-green-800 font-medium text-xs">LIVE</span>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instrument Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Volatility Instrument</label>
            <select
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value as VolatilityInstrumentType)}
              className="w-full p-2 border rounded-md"
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
              className={isLive ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <div className="flex items-center gap-2">
                {isLive && <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>}
                {isLive ? 'Live Mode ON' : 'Start Live Mode'}
              </div>
            </Button>
          </div>

          {/* Current Price Display */}
          {currentPrice && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="text-center space-y-2">
                  <div className="text-sm font-medium text-gray-600">Current Price - {selectedInstrument}</div>
                  <div className="text-3xl font-mono font-bold text-gray-800">
                    {(() => {
                      // Use correct decimal places to preserve trailing zeros
                      const decimalPlaces = getInstrumentDecimalPlaces(selectedInstrument);
                      const priceStr = currentPrice.toFixed(decimalPlaces);
                      const lastDigitIndex = priceStr.length - 1;
                      const beforeLastDigit = priceStr.substring(0, lastDigitIndex);
                      const lastDigit = priceStr.charAt(lastDigitIndex);

                      return (
                        <>
                          <span className="text-gray-600">{beforeLastDigit}</span>
                          <span className={`text-5xl font-black px-2 py-1 rounded-lg border-2 shadow-lg animate-pulse ${
                            lastDigit === '0'
                              ? 'text-orange-600 bg-orange-200 border-orange-400'
                              : 'text-blue-600 bg-yellow-200 border-yellow-400'
                          }`}>
                            {lastDigit}
                            {lastDigit === '0' && <span className="text-sm text-orange-700 ml-1">⚠</span>}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex justify-center items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                      <span>Current Digit: <strong>{currentTick}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-600" />
                      <span>Current Last Digit: <strong>{currentTick}</strong></span>
                    </div>
                    {prediction && currentTick === prediction.predictedDigit && (
                      <div className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full border-2 border-green-400 animate-bounce">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        <span className="text-green-800 font-bold text-xs">PREDICTION MATCH!</span>
                      </div>
                    )}
                    {currentTick === 0 && (
                      <div className="flex items-center gap-2 bg-orange-100 px-3 py-1 rounded-full border-2 border-orange-400">
                        <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                        <span className="text-orange-800 font-bold text-xs">DIGIT 0 - VALID ENTRY!</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status */}
          {lastUpdate && (
            <div className="text-xs text-gray-500 flex items-center justify-between">
              <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
              <div className="flex items-center gap-2">
                {isLive && (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <Badge variant="default" className="bg-green-600">LIVE</Badge>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && prediction && (
        <Tabs defaultValue="prediction" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="prediction">Prediction</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="guide">Guide</TabsTrigger>
          </TabsList>

          <TabsContent value="prediction" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Current Prediction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Target className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Predicted Digit: {prediction.predictedDigit}</strong>
                    <br />
                    Method: {prediction.method.toUpperCase()}
                    <br />
                    Confidence: {prediction.confidence.toFixed(1)}%
                    <br />
                    Risk Level: <Badge variant={prediction.riskLevel === 'low' ? 'default' : prediction.riskLevel === 'medium' ? 'secondary' : 'destructive'}>{prediction.riskLevel.toUpperCase()}</Badge>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Est. Occurrence</span>
                    </div>
                    <div className="text-xl font-bold">{prediction.estimatedOccurrence} ticks</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Current Last Digit</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 font-mono bg-blue-50 px-3 py-1 rounded-lg border">
                      {currentTick}
                    </div>
                    <div className="text-xs text-gray-500 text-center">Last digit of current price</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Predicted Digit</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600 font-mono bg-green-50 px-3 py-1 rounded-lg border">
                      {prediction.predictedDigit}
                    </div>
                    <div className="text-xs text-gray-500 text-center">AI prediction for next occurrence</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium">Supporting Evidence</span>
                  <ul className="text-sm text-gray-600 list-disc list-inside">
                    {prediction.supportingEvidence.map((evidence, index) => (
                      <li key={index}>{evidence}</li>
                    ))}
                  </ul>
                </div>

                <Progress value={prediction.confidence} className="w-full" />

                {/* Trading Signal */}
                {tradingSignal && (
                  <div className="mt-4 p-4 border rounded-lg bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Bot Trading Signal
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Action:</span>
                        <Badge variant={tradingSignal.action === 'BUY' ? 'default' : tradingSignal.action === 'WAIT' ? 'secondary' : 'destructive'} className="ml-1">
                          {tradingSignal.action}
                        </Badge>
                      </div>
                      <div><span className="font-medium">Strategy:</span> {tradingSignal.strategy}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Current Last Digit:</span>
                        <span className="font-mono font-bold text-lg bg-blue-100 px-2 py-1 rounded border">
                          {tradingSignal.entryTick}
                        </span>
                      </div>
                      <div><span className="font-medium">Duration:</span> {tradingSignal.duration} ticks</div>
                    </div>
                    <div className="mt-3 p-2 bg-white rounded border">
                      <span className="font-medium text-sm">Risk Assessment:</span>
                      <p className="text-xs text-gray-600 mt-1">{tradingSignal.riskAssessment}</p>
                    </div>
                    <div className="mt-2 p-2 bg-blue-50 rounded border">
                      <span className="font-medium text-sm">Reasoning:</span>
                      <p className="text-xs text-gray-600 mt-1">{tradingSignal.reasoning}</p>
                    </div>
                    <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                      <span className="font-medium text-sm text-yellow-800">Trading Context:</span>
                      <p className="text-xs text-yellow-700 mt-1">
                        For <strong>{tradingSignal.strategy}</strong> strategy: The current last digit ({tradingSignal.entryTick})
                        is your reference point. AI predicts digit {tradingSignal.digit} will appear next with {tradingSignal.confidence.toFixed(1)}% confidence.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Even/Odd Bias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Even</span>
                      <span>{analysis.evenOddBias.even.toFixed(1)}%</span>
                    </div>
                    <Progress value={analysis.evenOddBias.even} />
                    <div className="flex justify-between">
                      <span>Odd</span>
                      <span>{analysis.evenOddBias.odd.toFixed(1)}%</span>
                    </div>
                    <Progress value={analysis.evenOddBias.odd} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Over/Under 5 Bias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Over {analysis.overUnderBias.threshold}</span>
                      <span>{analysis.overUnderBias.over.toFixed(1)}%</span>
                    </div>
                    <Progress value={analysis.overUnderBias.over} />
                    <div className="flex justify-between">
                      <span>Under {analysis.overUnderBias.threshold}</span>
                      <span>{analysis.overUnderBias.under.toFixed(1)}%</span>
                    </div>
                    <Progress value={analysis.overUnderBias.under} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Gap Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Digits with largest gaps (due for appearance):
                  </div>
                  {Object.entries(analysis.gapAnalysis)
                    .sort(([,a], [,b]) => b.current - a.current)
                    .slice(0, 3)
                    .map(([digit, gap]) => (
                      <div key={digit} className="flex justify-between text-sm">
                        <span>Digit {digit}</span>
                        <span>{gap.current} ticks ago</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Digit Distribution Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs text-blue-700">
                    <strong>Note:</strong> Digit 0 is significant and counted as a valid trading entry point.
                    It's classified as EVEN and UNDER 5 for trading strategies.
                  </p>
                </div>
                <div className="space-y-3">
                  {Object.entries(analysis.digitProbabilities).map(([digit, probability]) => {
                    const digitNum = parseInt(digit);
                    const gap = analysis.gapAnalysis[digitNum];
                    const streak = analysis.streakAnalysis[digitNum];

                    return (
                      <div key={digit} className={`flex items-center justify-between p-2 border rounded ${digitNum === 0 ? 'bg-yellow-50 border-yellow-200' : ''}`}>
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-lg font-bold w-6 ${digitNum === 0 ? 'text-yellow-700' : ''}`}>
                            {digit}
                            {digitNum === 0 && <span className="text-xs text-yellow-600 ml-1">⚠</span>}
                          </span>
                          <div className="flex gap-1">
                            <Badge variant={probability > 12 ? 'default' : probability < 8 ? 'destructive' : 'secondary'} className="text-xs">
                              {probability.toFixed(1)}%
                            </Badge>
                            {gap.current > 15 && (
                              <Badge variant="outline" className="text-xs">
                                Gap: {gap.current}
                              </Badge>
                            )}
                            {streak.current > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                Streak: {streak.current}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm">{analysis.digitFrequencies[digitNum]} times</span>
                          <div className="w-20">
                            <Progress value={probability * 10} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guide" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Digit Match Trading Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">What is Digit Match?</h4>
                  <p className="text-sm text-gray-600">
                    Digit Match in Deriv's volatility trading involves predicting whether the last digit of the tick price 
                    matches a chosen digit at contract expiry. For example, if you predict digit "7" and the final tick 
                    price is 1234.567, you win because the last digit is 7.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">⚠ Important: Digit 0 Significance</h4>
                  <div className="p-3 bg-orange-50 rounded border border-orange-200">
                    <p className="text-sm text-orange-800">
                      <strong>Digit 0 is a valid and significant trading entry point!</strong>
                    </p>
                    <ul className="text-sm text-orange-700 mt-2 space-y-1 list-disc list-inside">
                      <li><strong>Classification:</strong> Digit 0 is EVEN and UNDER 5</li>
                      <li><strong>Trading Value:</strong> Counts as a legitimate last digit for all strategies</li>
                      <li><strong>Frequency:</strong> Appears with ~10% theoretical probability like other digits</li>
                      <li><strong>Visual Indicator:</strong> Highlighted in orange when it appears</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">How to Use This Tool</h4>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Monitor the predicted digit and confidence level</li>
                    <li>Wait for the estimated number of rounds</li>
                    <li>Place your trade at the suggested entry point</li>
                    <li>Use the pattern analysis to validate predictions</li>
                    <li><strong>Remember:</strong> Digit 0 is a valid entry point for all strategies</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Bot Integration</h4>
                  <p className="text-sm text-gray-600">
                    This tool provides structured data for automated trading bots:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>Predicted Digit:</strong> The digit to trade</li>
                    <li><strong>Entry Point:</strong> When to place the trade</li>
                    <li><strong>Confidence:</strong> Trade strength indicator</li>
                    <li><strong>Strategy:</strong> Match, Even/Odd, or Over/Under</li>
                  </ul>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Important:</strong> This tool requires real-time synchronization with Deriv's tick data. 
                    Always verify predictions with current market conditions before executing trades.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
