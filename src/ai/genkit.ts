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
   * Generate response with automatic fallback to Gemini if DeepSeek fails
   */
  async generateWithFallback(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      console.log('[EnhancedAI] Attempting generation with DeepSeek (primary)');

      // Try DeepSeek first (now primary)
      const deepSeekResponse = await this.deepSeekService.generate(prompt, systemPrompt);
      console.log('[EnhancedAI] DeepSeek generation successful');
      return deepSeekResponse;
    } catch (error) {
      console.warn('[EnhancedAI] DeepSeek failed, falling back to Gemini:', error instanceof Error ? error.message : 'Unknown error');

      try {
        const geminiResponse = await ai.generate({
          model: 'googleai/gemini-2.0-flash',
          prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
        });

        if (geminiResponse.text) {
          console.log('[EnhancedAI] Gemini fallback successful');
          return geminiResponse.text;
        }

        throw new Error('Gemini returned empty response');
      } catch (geminiError) {
        console.error('[EnhancedAI] Both DeepSeek and Gemini failed:', geminiError);
        throw new Error(`All AI services failed. DeepSeek: ${error instanceof Error ? error.message : 'Unknown'}. Gemini: ${geminiError instanceof Error ? geminiError.message : 'Unknown'}`);
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
      console.log('[EnhancedAI] Attempting structured generation with DeepSeek (primary)');

      // Try DeepSeek first (now primary)
      const schemaDescription = JSON.stringify(schema, null, 2);
      const deepSeekResponse = await this.deepSeekService.generateStructured<T>(
        prompt,
        schemaDescription,
        systemPrompt
      );
      console.log('[EnhancedAI] DeepSeek structured generation successful');
      return deepSeekResponse;
    } catch (error) {
      console.warn('[EnhancedAI] DeepSeek structured generation failed, falling back to Gemini:', error instanceof Error ? error.message : 'Unknown error');

      try {
        const geminiResponse = await ai.generate({
          model: 'googleai/gemini-2.0-flash',
          prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
          output: { schema },
        });

        if (geminiResponse.output) {
          console.log('[EnhancedAI] Gemini structured fallback successful');
          return geminiResponse.output as T;
        }

        throw new Error('Gemini returned empty structured response');
      } catch (geminiError) {
        console.error('[EnhancedAI] Both DeepSeek and Gemini structured generation failed:', geminiError);
        throw new Error(`All AI services failed for structured generation. DeepSeek: ${error instanceof Error ? error.message : 'Unknown'}. Gemini: ${geminiError instanceof Error ? geminiError.message : 'Unknown'}`);
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
