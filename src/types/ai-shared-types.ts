import * as z from 'zod';
import type { VolatilityInstrumentType as ExternalVolatilityInstrumentType, PriceTick as ExternalPriceTickType, InstrumentIndicatorData as ExternalInstrumentIndicatorDataType } from '@/types';

// Base Schemas
export const VolatilityInstrumentTypeSchema = z.string().describe("Deriv symbol for a volatility index, e.g., R_10, R_25, or full name like 'Volatility 10 Index'.");
export type VolatilityInstrumentType = ExternalVolatilityInstrumentType; // Keep using the one from types/index

export const PriceTickSchema = z.object({
  epoch: z.number(),
  price: z.number(),
  time: z.string(),
}).describe("A single price tick data point.");
export type PriceTick = ExternalPriceTickType;

export const InstrumentIndicatorDataSchema = z.object({
  rsi: z.number().optional(),
  macd: z.object({ macd: z.number(), signal: z.number(), histogram: z.number() }).optional(),
  bollingerBands: z.object({ upper: z.number(), middle: z.number(), lower: z.number() }).optional(),
  ema: z.number().optional(),
  atr: z.number().optional(),
  stochastic: z.object({ k: z.number(), d: z.number() }).optional(),
  williamsR: z.number().optional(),
  cci: z.number().optional(),
}).describe("Calculated technical indicators for an instrument.");
export type InstrumentIndicatorData = ExternalInstrumentIndicatorDataType; // Use from '@/types' if defined there

// User Trade Type
export const UserTradeTypeSchema = z.enum([
  'RiseFall',
  'HigherLower',
  'TouchNoTouch',
  'DigitsEvenOdd',
  'DigitsOverUnder'
]);
export type UserTradeType = z.infer<typeof UserTradeTypeSchema>;

// Pattern trigger schema for AI integration
export const PatternTriggerSchema = z.object({
  shouldTrade: z.boolean(),
  contractType: z.string(), // DIGITEVEN or DIGITODD
  reasoning: z.string(),
  confidence: z.number().min(0).max(1).optional(), // Pattern detection confidence (0-1)
  patternType: z.enum(['even_reversal', 'odd_reversal']).optional(), // Type of pattern detected
}).describe("Pattern-based trade trigger information for Even/Odd strategies");
export type PatternTrigger = z.infer<typeof PatternTriggerSchema>;

// Schemas for Volatility Single Trade Strategy Flow
export const VolatilitySingleTradeStrategyInputSchema = z.object({
  currentInstrument: VolatilityInstrumentTypeSchema,
  userSelectedTradeType: UserTradeTypeSchema,
  stakePerTrade: z.number().min(0.01),
  instrumentTicks: z.array(PriceTickSchema),
  instrumentIndicators: InstrumentIndicatorDataSchema.optional(),

  // User settings from AI Auto-Trading Controls
  executionMode: z.enum(['turbo', 'safe']).default('safe'), // Turbo vs Safe execution
  accountType: z.enum(['demo', 'real']).default('demo'), // Account type selection
  selectedStrategy: z.string().optional(), // User-selected strategy (Even/Odd, etc.)
  predictionDigit: z.number().min(0).max(9).optional(), // For DigitsOverUnder trades

  // Pattern-based trading
  patternTrigger: PatternTriggerSchema.optional(), // Pattern-based trade trigger
});
export type VolatilitySingleTradeStrategyInput = z.infer<typeof VolatilitySingleTradeStrategyInputSchema>;

export const VolatilitySingleTradeProposalSchema = z.object({
  instrument: VolatilityInstrumentTypeSchema,
  shouldTrade: z.boolean(),
  derivContractType: z.string().optional(),
  duration: z.number().int().min(1).optional(),
  durationUnit: z.enum(['s', 'm', 'h', 'd', 't']).optional(),
  barrier: z.string().optional(),
  stake: z.number().min(0.01).optional(),
  reasoning: z.string(),
});
export type VolatilitySingleTradeProposal = z.infer<typeof VolatilitySingleTradeProposalSchema>;

// Schemas for Volatility Session Strategy Flow
export const VolatilitySessionStrategyInputSchema = z.object({
  // Single instrument selection (user-selected volatility index)
  selectedInstrument: VolatilityInstrumentTypeSchema, // Primary user-selected instrument
  availableInstruments: z.array(VolatilityInstrumentTypeSchema), // Keep for backward compatibility
  userSelectedTradeType: UserTradeTypeSchema,
  totalSessionStake: z.number().min(0.35),
  instrumentTicks: z.record(VolatilityInstrumentTypeSchema, z.array(PriceTickSchema)),
  instrumentIndicators: z.record(VolatilityInstrumentTypeSchema, InstrumentIndicatorDataSchema.optional()).optional(),

  // User settings from AI Auto-Trading Controls
  executionMode: z.enum(['turbo', 'safe']).default('safe'), // Turbo vs Safe execution
  numberOfBulkTrades: z.number().min(1).max(20).default(1), // Bulk trades setting (1-20)
  accountType: z.enum(['demo', 'real']).default('demo'), // Account type selection
  selectedStrategy: z.string().optional(), // User-selected strategy (Even/Odd, etc.)
  predictionDigit: z.number().min(0).max(9).optional(), // For DigitsOverUnder trades

  // Pattern-based trading
  patternTrigger: PatternTriggerSchema.optional(), // Pattern-based trade trigger for session
});
export type VolatilitySessionStrategyInput = z.infer<typeof VolatilitySessionStrategyInputSchema>;

export const VolatilitySessionStrategyOutputSchema = z.object({
  tradesToExecute: z.array(VolatilitySingleTradeProposalSchema),
  overallReasoning: z.string(),
});
export type VolatilitySessionStrategyOutput = z.infer<typeof VolatilitySessionStrategyOutputSchema>;

// Schemas for the older/page-simulation VolatilityTradingStrategy flow
export const VolatilityTradingStrategyInputSchema = z.object({
  totalStake: z.number(),
  instruments: z.array(VolatilityInstrumentTypeSchema),
  tradingMode: z.enum(['conservative', 'balanced', 'aggressive']),
  aiStrategyId: z.string().optional(),
  instrumentTicks: z.record(VolatilityInstrumentTypeSchema, z.array(PriceTickSchema)),
  instrumentIndicators: z.record(VolatilityInstrumentTypeSchema, InstrumentIndicatorDataSchema.optional()).optional(),
});
export type VolatilityTradingStrategyInput = z.infer<typeof VolatilityTradingStrategyInputSchema>;

// Note: This VolatilityTradeProposalSchema is for the OLD flow.
// VolatilitySingleTradeProposalSchema is for the NEW session-based flow.
export const VolatilityTradeProposalSchema = z.object({
  instrument: VolatilityInstrumentTypeSchema,
  action: z.enum(['CALL', 'PUT']),
  stake: z.number(),
  durationSeconds: z.number().int().min(15),
  reasoning: z.string(),
});
export type VolatilityTradeProposal = z.infer<typeof VolatilityTradeProposalSchema>;

export const VolatilityTradingStrategyOutputSchema = z.object({
  tradesToExecute: z.array(VolatilityTradeProposalSchema),
  overallReasoning: z.string(),
});
export type VolatilityTradingStrategyOutput = z.infer<typeof VolatilityTradingStrategyOutputSchema>;

// Schema for pre-formatted indicators (used internally by prompts)
export const PromptFormattedInstrumentIndicatorSchema = z.object({
  rsi: z.string().optional(),
  macdLine: z.string().optional(),
  macdSignal: z.string().optional(),
  macdHist: z.string().optional(),
  bbUpper: z.string().optional(),
  bbMiddle: z.string().optional(),
  bbLower: z.string().optional(),
  ema: z.string().optional(),
  atr: z.string().optional(),
  stochasticK: z.string().optional(),
  stochasticD: z.string().optional(),
  williamsR: z.string().optional(),
  cci: z.string().optional(),
});
export type PromptFormattedInstrumentIndicator = z.infer<typeof PromptFormattedInstrumentIndicatorSchema>;

// Schema for the input to the prompt that determines Deriv contract types
export const VolatilityStrategyPromptInputSchema = z.object({
  currentInstrument: VolatilityInstrumentTypeSchema,
  userSelectedTradeType: UserTradeTypeSchema,
  stakePerTrade: z.number(),
  instrumentTicks: z.array(PriceTickSchema), // Ticks for the *current* instrument for the prompt
  formattedIndicators: PromptFormattedInstrumentIndicatorSchema.nullable().optional(), // Formatted indicators for the *current* instrument

  // User settings context for AI decision-making
  executionMode: z.enum(['turbo', 'safe']).optional(), // Turbo vs Safe execution mode
  accountType: z.enum(['demo', 'real']).optional(), // Account type selection
  selectedStrategy: z.string().optional(), // User-selected strategy for prompt context
  predictionDigit: z.number().min(0).max(9).optional(), // For DigitsOverUnder trades

  // Session context
  availableInstruments: z.array(VolatilityInstrumentTypeSchema).optional(),
  totalSessionStake: z.number().optional(),
  patternTrigger: PatternTriggerSchema.optional(), // Pattern-based trade trigger for prompt context
});
export type VolatilityStrategyPromptInput = z.infer<typeof VolatilityStrategyPromptInputSchema>;
