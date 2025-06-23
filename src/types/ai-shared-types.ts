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

// Schemas for Volatility Single Trade Strategy Flow
export const VolatilitySingleTradeStrategyInputSchema = z.object({
  currentInstrument: VolatilityInstrumentTypeSchema,
  userSelectedTradeType: UserTradeTypeSchema,
  stakePerTrade: z.number().min(0.01),
  instrumentTicks: z.array(PriceTickSchema),
  instrumentIndicators: InstrumentIndicatorDataSchema.optional(),
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
  availableInstruments: z.array(VolatilityInstrumentTypeSchema),
  userSelectedTradeType: UserTradeTypeSchema,
  totalSessionStake: z.number().min(0.35),
  instrumentTicks: z.record(VolatilityInstrumentTypeSchema, z.array(PriceTickSchema)),
  instrumentIndicators: z.record(VolatilityInstrumentTypeSchema, InstrumentIndicatorDataSchema.optional()).optional(),
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
  // Fields from VolatilitySessionStrategyInputSchema that might be relevant context for the prompt
  availableInstruments: z.array(VolatilityInstrumentTypeSchema).optional(),
  totalSessionStake: z.number().optional(),
});
export type VolatilityStrategyPromptInput = z.infer<typeof VolatilityStrategyPromptInputSchema>;
