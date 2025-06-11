'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ForexCryptoCommodityInstrumentType, TradingMode, AutomatedTradingStrategyOutput } from '@/types';
import { generateAutomatedTradingStrategy } from '@/ai/flows/automated-trading-strategy-flow';
import { executeAiTradingStrategy, TradeExecutionResult } from '@/app/actions/trade-execution-actions';
import { useToast } from '@/hooks/use-toast'; // Assuming a toast hook exists for notifications

// Define available instruments - this could also come from a config file or API
const AVAILABLE_INSTRUMENTS: ForexCryptoCommodityInstrumentType[] = [
  'EUR/USD',
  'GBP/USD',
  'BTC/USD',
  'XAU/USD', // Gold
  'ETH/USD',
  'Palladium/USD',
  'Platinum/USD',
  'Silver/USD',
];

const TRADING_MODES: TradingMode[] = ['conservative', 'balanced', 'aggressive'];

interface AutomatedTradingControlsProps {
  // Props if needed, e.g., for passing down user info or callbacks
}

export function AutomatedTradingControls({}: AutomatedTradingControlsProps) {
  const { toast } = useToast(); // For showing notifications

  // State for API Token
  const [apiToken, setApiToken] = useState<string>('');

  // State for Strategy Configuration
  const [totalStake, setTotalStake] = useState<number>(10); // Default to 10 USD
  const [selectedInstruments, setSelectedInstruments] = useState<ForexCryptoCommodityInstrumentType[]>([]);
  const [tradingMode, setTradingMode] = useState<TradingMode>('balanced');
  const [stopLossPercentage, setStopLossPercentage] = useState<number | undefined>(5); // Default 5%

  // State for UI feedback
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [executionResults, setExecutionResults] = useState<TradeExecutionResult[]>([]);
  const [aiReasoning, setAiReasoning] = useState<string>('');

  const handleInstrumentChange = (instrument: ForexCryptoCommodityInstrumentType) => {
    setSelectedInstruments(prev =>
      prev.includes(instrument)
        ? prev.filter(item => item !== instrument)
        : [...prev, instrument]
    );
  };

  const handleStartAutomatedTrading = async () => {
    if (!apiToken) {
      toast({ title: 'Error', description: 'Deriv API Token is required.', variant: 'destructive' });
      return;
    }
    if (selectedInstruments.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one instrument.', variant: 'destructive' });
      return;
    }
    if (totalStake < 1) { // Or a more appropriate minimum like 0.35 for some Deriv contracts
        toast({ title: 'Error', description: 'Total stake must be at least 1.', variant: 'destructive' });
        return;
    }

    setIsProcessing(true);
    setExecutionResults([]);
    setAiReasoning('');

    try {
      // 1. Generate AI Strategy
      // For now, instrumentTicks and instrumentIndicators will be empty or mocked.
      // In a real scenario, you'd fetch live data.
      toast({ title: 'AI Thinking...', description: 'Generating trading strategy.' });
      const strategyInput = {
        totalStake,
        instruments: selectedInstruments,
        tradingMode,
        stopLossPercentage: stopLossPercentage || undefined, // Pass undefined if 0 or empty
        instrumentTicks: {}, // Mock: fetch real data
        instrumentIndicators: {}, // Mock: calculate real indicators
      };

      // Type assertion needed if the imported type from @/types is slightly different from Zod schema
      const aiStrategy: AutomatedTradingStrategyOutput = await generateAutomatedTradingStrategy(strategyInput as any);

      if (!aiStrategy || !aiStrategy.tradesToExecute || aiStrategy.tradesToExecute.length === 0) {
        toast({ title: 'AI Strategy', description: 'AI did not propose any trades. Try different parameters or market conditions.', variant: 'default' });
        setAiReasoning(aiStrategy?.overallReasoning || 'No trades proposed.');
        setIsProcessing(false);
        return;
      }

      setAiReasoning(aiStrategy.overallReasoning);
      toast({ title: 'AI Strategy Generated', description: `AI proposed ${aiStrategy.tradesToExecute.length} trade(s). Executing now...` });

      // 2. Execute Trades
      const results = await executeAiTradingStrategy(aiStrategy, apiToken);
      setExecutionResults(results);

      results.forEach(result => {
        if (result.success) {
          toast({
            title: `Trade Success: ${result.instrument}`,
            description: `Contract ID: ${result.tradeResponse?.contract_id}, Buy Price: ${result.tradeResponse?.buy_price}`,
          });
        } else {
          toast({
            title: `Trade Failed: ${result.instrument}`,
            description: result.error,
            variant: 'destructive',
          });
        }
      });

    } catch (error: any) {
      console.error('Error during automated trading process:', error);
      toast({ title: 'Error', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Automated Trading</CardTitle>
        <CardDescription>Configure and start AI-powered automated trading with your Deriv account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* API Token Input */}
        <div className="space-y-2">
          <Label htmlFor="apiToken">Deriv API Token</Label>
          <Input
            id="apiToken"
            type="password"
            placeholder="Enter your Deriv API Token"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            disabled={isProcessing}
          />
          <p className="text-xs text-muted-foreground">
            Your API token is used to place trades. It is not stored on our servers.
          </p>
        </div>

        {/* Strategy Configuration */}
        <div className="space-y-2">
          <Label htmlFor="totalStake">Total Stake (USD)</Label>
          <Input
            id="totalStake"
            type="number"
            min="1"
            value={totalStake}
            onChange={(e) => setTotalStake(parseFloat(e.target.value))}
            disabled={isProcessing}
          />
        </div>

        <div className="space-y-2">
          <Label>Select Instruments</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AVAILABLE_INSTRUMENTS.map(instrument => (
              <Button
                key={instrument}
                variant={selectedInstruments.includes(instrument) ? 'default' : 'outline'}
                onClick={() => handleInstrumentChange(instrument)}
                disabled={isProcessing}
                size="sm"
              >
                {instrument}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tradingMode">Trading Mode</Label>
          <Select
            value={tradingMode}
            onValueChange={(value: string) => setTradingMode(value as TradingMode)}
            disabled={isProcessing}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select trading mode" />
            </SelectTrigger>
            <SelectContent>
              {TRADING_MODES.map(mode => (
                <SelectItem key={mode} value={mode}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stopLossPercentage">Stop-Loss Percentage (Optional, 1-50%)</Label>
          <Input
            id="stopLossPercentage"
            type="number"
            min="1"
            max="50"
            placeholder="e.g., 5 for 5%"
            value={stopLossPercentage === undefined ? '' : stopLossPercentage}
            onChange={(e) => {
              const val = e.target.value;
              setStopLossPercentage(val === '' ? undefined : parseFloat(val));
            }}
            disabled={isProcessing}
          />
        </div>

        {/* Control Button */}
        <Button
          onClick={handleStartAutomatedTrading}
          disabled={isProcessing || !apiToken || selectedInstruments.length === 0}
          className="w-full"
        >
          {isProcessing ? 'Processing...' : 'Start Automated Trading'}
        </Button>
      </CardContent>

      {/* Status Display */}
      {(aiReasoning || executionResults.length > 0) && (
        <CardFooter className="flex flex-col items-start space-y-4">
          {aiReasoning && (
            <div>
              <h4 className="font-semibold mb-2">AI Overall Reasoning:</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiReasoning}</p>
            </div>
          )}
          {executionResults.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Trade Execution Results:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {executionResults.map((result, index) => (
                  <li key={index} className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    Instrument: {result.instrument} - {result.success ? 'Success' : 'Failed'}
                    {result.success && result.tradeResponse && ` (Contract ID: ${result.tradeResponse.contract_id})`}
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
