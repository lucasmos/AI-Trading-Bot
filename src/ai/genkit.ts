import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { getDeepSeekService } from './deepseek-service';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

// Enhanced AI service with fallback support
export class EnhancedAIService {
  private deepSeekService = getDeepSeekService();

  /**
   * Generate response with automatic fallback to DeepSeek if Gemini fails
   */
  async generateWithFallback(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      console.log('[EnhancedAI] Attempting generation with Gemini (primary)');

      // Try Gemini first (now primary)
      const geminiResponse = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
      });

      if (geminiResponse.text) {
        console.log('[EnhancedAI] Gemini generation successful');
        return geminiResponse.text;
      }

      throw new Error('Gemini returned empty response');
    } catch (error) {
      console.warn('[EnhancedAI] Gemini failed, falling back to DeepSeek:', error instanceof Error ? error.message : 'Unknown error');

      try {
        const deepSeekResponse = await this.deepSeekService.generate(prompt, systemPrompt);
        console.log('[EnhancedAI] DeepSeek fallback successful');
        return deepSeekResponse;
      } catch (deepSeekError) {
        console.error('[EnhancedAI] Both Gemini and DeepSeek failed:', deepSeekError);
        throw new Error(`All AI services failed. Gemini: ${error instanceof Error ? error.message : 'Unknown'}. DeepSeek: ${deepSeekError instanceof Error ? deepSeekError.message : 'Unknown'}`);
      }
    }
  }

  /**
   * Generate structured JSON response with fallback support
   */
  async generateStructuredWithFallback<T = any>(
    prompt: string,
    schema: any,
    systemPrompt?: string
  ): Promise<T> {
    try {
      console.log('[EnhancedAI] Attempting structured generation with Gemini (primary)');

      // Try Gemini first (now primary)
      const geminiResponse = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
        output: { schema },
      });

      if (geminiResponse.output) {
        console.log('[EnhancedAI] Gemini structured generation successful');
        return geminiResponse.output as T;
      }

      throw new Error('Gemini returned empty structured response');
    } catch (error) {
      console.warn('[EnhancedAI] Gemini structured generation failed, falling back to DeepSeek:', error instanceof Error ? error.message : 'Unknown error');

      try {
        const schemaDescription = JSON.stringify(schema, null, 2);
        const deepSeekResponse = await this.deepSeekService.generateStructured<T>(
          prompt,
          schemaDescription,
          systemPrompt
        );
        console.log('[EnhancedAI] DeepSeek structured fallback successful');
        return deepSeekResponse;
      } catch (deepSeekError) {
        console.error('[EnhancedAI] Both Gemini and DeepSeek structured generation failed:', deepSeekError);
        throw new Error(`All AI services failed for structured generation. Gemini: ${error instanceof Error ? error.message : 'Unknown'}. DeepSeek: ${deepSeekError instanceof Error ? deepSeekError.message : 'Unknown'}`);
      }
    }
  }
}

// Singleton instance
let enhancedAIInstance: EnhancedAIService | null = null;

export function getEnhancedAI(): EnhancedAIService {
  if (!enhancedAIInstance) {
    enhancedAIInstance = new EnhancedAIService();
  }
  return enhancedAIInstance;
}
