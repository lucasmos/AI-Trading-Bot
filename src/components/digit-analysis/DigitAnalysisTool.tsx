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
import { getDerivTicks } from '@/lib/deriv-service';
import { DigitAnalysisService, DigitAnalysisResult, DigitPredictionModel, BotTradingSignal } from '@/lib/digit-analysis-service';

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
  'Volatility 10 Index', 'Volatility 25 Index', 'Volatility 50 Index',
  'Volatility 75 Index', 'Volatility 100 Index'
];

export default function DigitAnalysisTool() {
  const [selectedInstrument, setSelectedInstrument] = useState<VolatilityInstrumentType>('Volatility 10 Index');
  const [ticks, setTicks] = useState<PriceTick[]>([]);
  const [analysis, setAnalysis] = useState<DigitAnalysisResult | null>(null);
  const [prediction, setPrediction] = useState<DigitPredictionModel | null>(null);
  const [tradingSignal, setTradingSignal] = useState<BotTradingSignal | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [currentTick, setCurrentTick] = useState<number>(0);

  // Convert instrument name to Deriv symbol
  const getDerivSymbol = (instrument: VolatilityInstrumentType): string => {
    const symbolMap: Record<VolatilityInstrumentType, string> = {
      'Volatility 10 Index': 'R_10',
      'Volatility 25 Index': 'R_25',
      'Volatility 50 Index': 'R_50',
      'Volatility 75 Index': 'R_75',
      'Volatility 100 Index': 'R_100'
    };
    return symbolMap[instrument];
  };

  // Fetch historical tick data
  const fetchTickData = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const symbol = getDerivSymbol(selectedInstrument);
      const tickData = await getDerivTicks(symbol, 100); // Get last 100 ticks
      setTicks(tickData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching tick data:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedInstrument]);

  // Analyze digit patterns using the advanced service
  const analyzeDigitPatterns = useCallback((tickData: PriceTick[]): DigitAnalysisResult | null => {
    if (tickData.length < 20) {
      return null;
    }

    try {
      return DigitAnalysisService.analyzeDigitPatterns(tickData);
    } catch (error) {
      console.error('Error analyzing digit patterns:', error);
      return null;
    }
  }, []);





  // Perform analysis when ticks change
  useEffect(() => {
    if (ticks.length > 0) {
      const analysisResult = analyzeDigitPatterns(ticks);
      if (analysisResult) {
        setAnalysis(analysisResult);

        const predictionResult = DigitAnalysisService.generatePrediction(analysisResult, currentTick);
        setPrediction(predictionResult);

        const signal = DigitAnalysisService.generateTradingSignal(predictionResult, analysisResult, currentTick);
        setTradingSignal(signal);
      }

      setCurrentTick(ticks.length);
    }
  }, [ticks, analyzeDigitPatterns, currentTick]);

  // Auto-refresh when live mode is enabled
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(fetchTickData, 2000); // Refresh every 2 seconds
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
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Digit Analysis Tool
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
              {VOLATILITY_INSTRUMENTS.map(instrument => (
                <option key={instrument} value={instrument}>{instrument}</option>
              ))}
            </select>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={fetchTickData} 
              disabled={isAnalyzing}
              variant="outline"
              size="sm"
            >
              {isAnalyzing ? 'Analyzing...' : 'Refresh Data'}
            </Button>
            <Button
              onClick={() => setIsLive(!isLive)}
              variant={isLive ? "destructive" : "default"}
              size="sm"
            >
              {isLive ? 'Stop Live' : 'Start Live'}
            </Button>
          </div>

          {/* Status */}
          {lastUpdate && (
            <div className="text-xs text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
              {isLive && <Badge variant="secondary" className="ml-2">LIVE</Badge>}
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Estimated Occurrence</span>
                    </div>
                    <div className="text-2xl font-bold">{prediction.estimatedOccurrence} ticks</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      <span className="text-sm font-medium">Current Tick</span>
                    </div>
                    <div className="text-2xl font-bold">#{currentTick}</div>
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
                  <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-2">Bot Trading Signal</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Action:</span>
                        <Badge variant={tradingSignal.action === 'BUY' ? 'default' : tradingSignal.action === 'WAIT' ? 'secondary' : 'destructive'} className="ml-2">
                          {tradingSignal.action}
                        </Badge>
                      </div>
                      <div><span className="font-medium">Strategy:</span> {tradingSignal.strategy}</div>
                      <div><span className="font-medium">Entry Tick:</span> #{tradingSignal.entryTick}</div>
                      <div><span className="font-medium">Duration:</span> {tradingSignal.duration} ticks</div>
                    </div>
                    <div className="mt-2">
                      <span className="font-medium">Risk Assessment:</span>
                      <p className="text-xs text-gray-600">{tradingSignal.riskAssessment}</p>
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
                <div className="space-y-3">
                  {Object.entries(analysis.digitProbabilities).map(([digit, probability]) => {
                    const digitNum = parseInt(digit);
                    const gap = analysis.gapAnalysis[digitNum];
                    const streak = analysis.streakAnalysis[digitNum];

                    return (
                      <div key={digit} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-lg font-bold w-6">{digit}</span>
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
                  <h4 className="font-semibold">How to Use This Tool</h4>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Monitor the predicted digit and confidence level</li>
                    <li>Wait for the estimated number of rounds</li>
                    <li>Place your trade at the suggested entry point</li>
                    <li>Use the pattern analysis to validate predictions</li>
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
