import { HfInference } from '@huggingface/inference';

// DeepSeek AI Service using Hugging Face
export class DeepSeekService {
  private client: HfInference;
  private model = 'google/flan-t5-base'; // Using a reliable instruction-following model

  constructor() {
    const hfToken = process.env.HF_DEEPSEEK_TOKEN;
    if (!hfToken) {
      throw new Error('HF_DEEPSEEK_TOKEN environment variable is required for DeepSeek integration');
    }

    this.client = new HfInference(hfToken);
  }

  /**
   * Generate a response using Hugging Face text generation
   * @param prompt The prompt to send to the model
   * @param systemPrompt Optional system prompt
   * @returns The generated response
   */
  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      console.log('[DeepSeekService] Generating response with Hugging Face API');

      // Combine system prompt and user prompt for instruction-following models
      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\nTask: ${prompt}`
        : prompt;

      // Use text generation for FLAN-T5
      const response = await this.client.textGeneration({
        model: this.model,
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          do_sample: true,
          return_full_text: false,
        },
      });

      const content = response.generated_text;
      if (!content) {
        throw new Error('Hugging Face returned empty response');
      }

      console.log('[DeepSeekService] Successfully generated response via HF API');
      return content.trim();
    } catch (error) {
      console.error('[DeepSeekService] Error generating response:', error);

      // Try fallback with text generation if conversational fails
      try {
        console.log('[DeepSeekService] Trying text generation fallback');

        const fallbackPrompt = systemPrompt
          ? `${systemPrompt}\n\n${prompt}`
          : prompt;

        const fallbackResponse = await this.client.textGeneration({
          model: 'gpt2',
          inputs: fallbackPrompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            do_sample: true,
            return_full_text: false,
          },
        });

        const fallbackContent = fallbackResponse.generated_text;
        if (!fallbackContent) {
          throw new Error('Fallback text generation returned empty response');
        }

        console.log('[DeepSeekService] Successfully generated response via fallback');
        return fallbackContent.trim();
      } catch (fallbackError) {
        console.error('[DeepSeekService] Fallback also failed:', fallbackError);
        throw new Error(`HF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Generate a structured JSON response using Hugging Face API
   * @param prompt The prompt to send to the model
   * @param schema Description of expected JSON schema
   * @param systemPrompt Optional system prompt
   * @returns Parsed JSON response
   */
  async generateStructured<T = any>(
    prompt: string,
    schema: string,
    systemPrompt?: string
  ): Promise<T> {
    try {
      console.log('[DeepSeekService] Generating structured response via HF API');

      const enhancedSystemPrompt = `${systemPrompt || ''}\n\nIMPORTANT: You must respond with valid JSON that matches this schema: ${schema}\n\nReturn ONLY the JSON object, no additional text or explanation.`;

      const response = await this.generate(prompt, enhancedSystemPrompt);

      // Extract JSON from response (in case there's extra text)
      let jsonString = response.trim();

      // Try to find JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }

      // Clean up common issues
      jsonString = jsonString
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*[\w\s]*?(\{)/g, '$1') // Remove text before first {
        .replace(/(\})\s*[\w\s]*?$/g, '$1'); // Remove text after last }

      try {
        const parsed = JSON.parse(jsonString);
        console.log('[DeepSeekService] Successfully parsed structured response');
        return parsed;
      } catch (parseError) {
        console.error('[DeepSeekService] Failed to parse JSON response:', jsonString);
        console.error('[DeepSeekService] Original response:', response);

        // Try to create a valid response based on the prompt
        console.log('[DeepSeekService] Attempting to create fallback structured response');

        const fallbackResponse = this.createFallbackStructuredResponse(prompt);
        console.log('[DeepSeekService] Created fallback structured response');
        return fallbackResponse as T;
      }
    } catch (error) {
      console.error('[DeepSeekService] Error generating structured response:', error);
      throw error;
    }
  }

  /**
   * Create a fallback structured response when JSON parsing fails
   */
  private createFallbackStructuredResponse(prompt: string): any {
    const response: any = {
      shouldTrade: false,
      reasoning: 'Unable to generate proper AI analysis due to parsing issues.'
    };

    // Extract instrument from prompt
    const instrumentMatch = prompt.match(/instrument[:\s]+([A-Z_0-9]+)/i);
    if (instrumentMatch) {
      response.instrument = instrumentMatch[1];
    }

    // Extract stake from prompt
    const stakeMatch = prompt.match(/stake[:\s]+(\d+(?:\.\d+)?)/i);
    if (stakeMatch) {
      response.stake = parseFloat(stakeMatch[1]);
    }

    return response;
  }

  /**
   * Test the Hugging Face service connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generate('Hello, respond with "working"');
      return response.length > 0 && !response.toLowerCase().includes('error');
    } catch (error) {
      console.error('[DeepSeekService] Connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
let deepSeekInstance: DeepSeekService | null = null;

export function getDeepSeekService(): DeepSeekService {
  if (!deepSeekInstance) {
    deepSeekInstance = new DeepSeekService();
  }
  return deepSeekInstance;
}
