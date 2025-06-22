import * as z from 'zod';

export const UserTradeTypeSchema = z.enum([
  'RiseFall',
  'HigherLower',
  'TouchNoTouch',
  'DigitsEvenOdd',
  'DigitsOverUnder'
]);

export type UserTradeType = z.infer<typeof UserTradeTypeSchema>;
