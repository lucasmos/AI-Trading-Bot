import type { TradingMode } from '@/types';

/**
 * Defines the structure for an AI trading strategy.
 */
export interface AiStrategyDefinition {
  id: string; // Unique identifier for the strategy
  name: string; // User-friendly display name
  description: string; // A brief explanation of the strategy
  // baseRiskProfile?: TradingMode; // Optional: Suggests a default risk profile
  // Note: More specific parameters can be added here later to fine-tune strategy behavior
}

/**
 * List of available AI trading strategies.
 * The actual logic differentiation within AI flows based on these IDs is a future step.
 */
export const AI_TRADING_STRATEGIES: AiStrategyDefinition[] = [
  {
    id: 'default_dynamic',
    name: 'Dynamic Adaptive',
    description: 'A balanced approach that dynamically adapts to changing market conditions. Uses the selected Trading Mode (Conservative, Balanced, Aggressive) for risk tuning.',
    // baseRiskProfile: 'balanced',
  },
  {
    id: 'trend_rider',
    name: 'Trend Rider',
    description: 'Attempts to identify and follow strong market trends. Risk level set by Trading Mode.',
    // baseRiskProfile: 'aggressive',
  },
  {
    id: 'range_bound',
    name: 'Range Negotiator',
    description: 'Optimized for markets that are moving sideways within a defined range. Risk level set by Trading Mode.',
    // baseRiskProfile: 'conservative',
  },
  // {
  //   id: 'breakout_specialist',
  //   name: 'Breakout Specialist',
  //   description: 'Looks for opportunities when prices break out of established ranges or patterns.',
  //   baseRiskProfile: 'aggressive',
  // },
];

// Default strategy if none is selected or applicable
export const DEFAULT_AI_STRATEGY_ID = AI_TRADING_STRATEGIES[0].id; 