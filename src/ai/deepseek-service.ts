import { InferenceClient } from '@huggingface/inference';

// DeepSeek AI Service using Hugging Face
export class DeepSeekService {
  private client: InferenceClient;
  private model = 'deepseek-ai/DeepSeek-R1-0528';

  constructor() {
    const hfToken = process.env.HF_DEEPSEEK_TOKEN;
    if (!hfToken) {
      throw new Error('HF_DEEPSEEK_TOKEN environment variable is required for DeepSeek integration');
    }

    this.client = new InferenceClient({
      provider: 'hyperbolic',
      apiKey: hfToken,
    });
  }

  /**
   * Generate a response using DeepSeek R1 model
   * @param prompt The prompt to send to DeepSeek
   * @param systemPrompt Optional system prompt
   * @returns The generated response
   */
  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      console.log('[DeepSeekService] Generating response with DeepSeek R1 model');
      
      const messages = [];
      
      if (systemPrompt) {
        messages.push({
          role: 'system' as const,
          content: systemPrompt
        });
      }
      
      messages.push({
        role: 'user' as const,
        content: prompt
      });

      const stream = this.client.chat.completions.create({
        model: this.model,
        messages,
        stream: true,
        max_tokens: 4000,
        temperature: 0.7,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          fullResponse += chunk.choices[0].delta.content;
        }
      }

      console.log('[DeepSeekService] Successfully generated response');
      return fullResponse.trim();
    } catch (error) {
      console.error('[DeepSeekService] Error generating response:', error);
      throw new Error(`DeepSeek generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Test the DeepSeek service connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generate('Hello, please respond with "DeepSeek is working"');
      return response.toLowerCase().includes('deepseek') || response.toLowerCase().includes('working');
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
