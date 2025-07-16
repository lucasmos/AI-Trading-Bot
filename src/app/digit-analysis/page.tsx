'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, BarChart3, Activity, Clock, AlertTriangle } from 'lucide-react';
import DigitAnalysisTool from '@/components/digit-analysis/DigitAnalysisTool';

export default function DigitAnalysisPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Digit Analysis Tool</h1>
          <p className="text-muted-foreground mt-2">
            Advanced digit prediction and pattern analysis for Deriv volatility trading
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Live Analysis
        </Badge>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5" />
              Digit Match Trading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Predict the exact last digit of tick prices at contract expiry. 
              High precision analysis with statistical backing.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Pattern Recognition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Advanced algorithms analyze digit frequencies, gaps, streaks, 
              and cyclical patterns for optimal entry points.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Real-time Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Perfect synchronization with Deriv's live tick data ensures 
              accurate predictions and timely trade execution.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* How Digit Match Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Understanding Digit Match in Deriv Trading
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold">What is Digit Match?</h4>
              <p className="text-sm text-muted-foreground">
                Digit Match is a binary options contract type in Deriv's volatility trading where you predict 
                whether the last digit of the final tick price will match a specific digit (0-9) you choose.
              </p>
              
              <h4 className="font-semibold">Example</h4>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Your Prediction:</strong> Digit 7<br />
                  <strong>Final Tick Price:</strong> 1234.567<br />
                  <strong>Last Digit:</strong> 7<br />
                  <strong>Result:</strong> <span className="text-green-600 font-semibold">WIN</span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Key Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>10% theoretical probability</strong> for each digit (0-9)</li>
                <li>• <strong>High payout potential</strong> due to precision required</li>
                <li>• <strong>Short duration contracts</strong> (1-10 ticks typically)</li>
                <li>• <strong>Real-time execution</strong> based on live tick data</li>
                <li>• <strong>Statistical edge</strong> through pattern analysis</li>
              </ul>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Important:</strong> This tool analyzes historical patterns but cannot guarantee future results. 
                  Always trade responsibly and within your risk tolerance.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Strategies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Supported Trading Strategies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Digit Match</h4>
              <p className="text-xs text-muted-foreground">
                Predict exact digit (0-9) that will appear as the last digit of the final tick price.
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Digit Even/Odd</h4>
              <p className="text-xs text-muted-foreground">
                Predict whether the last digit will be even (0,2,4,6,8) or odd (1,3,5,7,9).
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Digit Over/Under</h4>
              <p className="text-xs text-muted-foreground">
                Predict whether the last digit will be over or under a specific threshold (usually 5).
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Digit Rise/Fall</h4>
              <p className="text-xs text-muted-foreground">
                Predict whether the last digit will be higher or lower than the previous tick's last digit.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bot Integration Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Bot Integration & Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold">Automated Trading Signals</h4>
              <p className="text-sm text-muted-foreground">
                This tool generates structured data perfect for automated trading bots:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Predicted Digit:</strong> The specific digit to trade</li>
                <li><strong>Confidence Level:</strong> Statistical confidence (60-95%)</li>
                <li><strong>Entry Point:</strong> Optimal tick number for trade placement</li>
                <li><strong>Strategy Type:</strong> Match, Even/Odd, Over/Under</li>
                <li><strong>Risk Assessment:</strong> Low, medium, or high risk classification</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Real-time Synchronization</h4>
              <p className="text-sm text-muted-foreground">
                Critical requirements for successful automation:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Live Data Feed:</strong> Direct connection to Deriv's tick stream</li>
                <li><strong>Timing Precision:</strong> Sub-second accuracy for entry points</li>
                <li><strong>Pattern Updates:</strong> Continuous analysis of new tick data</li>
                <li><strong>Risk Management:</strong> Automated stop-loss and position sizing</li>
                <li><strong>Performance Tracking:</strong> Real-time win rate monitoring</li>
              </ul>
            </div>
          </div>

          <Alert>
            <Target className="h-4 w-4" />
            <AlertDescription>
              <strong>Pro Tip:</strong> Use the prediction confidence levels to determine position sizes. 
              Higher confidence (80%+) can support larger positions, while lower confidence (60-70%) 
              should use smaller, more conservative position sizes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Main Analysis Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Live Digit Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DigitAnalysisTool />
        </CardContent>
      </Card>

      {/* Footer Information */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              This tool analyzes up to 200 recent ticks to identify patterns and generate predictions.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Disclaimer:</strong> Past performance does not guarantee future results. 
              Digital options trading involves substantial risk and may not be suitable for all investors.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
