import { HfInference } from '@huggingface/inference';

// DeepSeek AI Service using Hugging Face
export class DeepSeekService {
  private client: HfInference;
  private model = 'meta-llama/Llama-2-7b-chat-hf'; // Using Llama 2 for better reasoning

  constructor() {
    const hfToken = process.env.HF_DEEPSEEK_TOKEN;
    if (!hfToken) {
      throw new Error('HF_DEEPSEEK_TOKEN environment variable is required for DeepSeek integration');
    }

    this.client = new HfInference(hfToken);
  }

  /**
   * Generate a response using text generation model
   * @param prompt The prompt to send to the model
   * @param systemPrompt Optional system prompt
   * @returns The generated response
   */
  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      console.log('[DeepSeekService] Generating response with HF model');

      // Combine system prompt and user prompt
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}\nAssistant:` : `${prompt}`;

      const response = await this.client.textGeneration({
        model: this.model,
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 2000,
          temperature: 0.7,
          do_sample: true,
          return_full_text: false,
        },
      });

      const content = response.generated_text;
      if (!content) {
        throw new Error('HF model returned empty response');
      }

      console.log('[DeepSeekService] Successfully generated response');
      return content.trim();
    } catch (error) {
      console.error('[DeepSeekService] Error generating response:', error);
      throw new Error(`HF model generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a structured JSON response using DeepSeek R1 model
   * @param prompt The prompt to send to DeepSeek
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
      const enhancedSystemPrompt = `${systemPrompt || ''}\n\nIMPORTANT: You must respond with valid JSON that matches this schema: ${schema}\n\nReturn ONLY the JSON object, no additional text or explanation.`;
      
      const response = await this.generate(prompt, enhancedSystemPrompt);
      
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      
      try {
        const parsed = JSON.parse(jsonString);
        console.log('[DeepSeekService] Successfully parsed structured response');
        return parsed;
      } catch (parseError) {
        console.error('[DeepSeekService] Failed to parse JSON response:', jsonString);
        throw new Error(`Invalid JSON response from DeepSeek: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
      }
    } catch (error) {
      console.error('[DeepSeekService] Error generating structured response:', error);
      throw error;
    }
  }

  /**
   * Test the HF service connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generate('Hello, respond with "working"');
      return response.length > 0; // Just check if we get any response
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
