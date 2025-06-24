import OpenAI from 'openai';

// DeepSeek AI Service using DeepSeek's Official API with OpenAI SDK
export class DeepSeekService {
  private client: OpenAI;
  private model = 'deepseek-reasoner'; // Using DeepSeek's reasoning model

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required for DeepSeek integration');
    }

    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey
    });
  }

  /**
   * Generate a response using DeepSeek's reasoning model via OpenAI SDK
   * @param prompt The prompt to send to the model
   * @param systemPrompt Optional system prompt
   * @returns The generated response
   */
  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      console.log('[DeepSeekService] Generating response with DeepSeek Reasoning API via OpenAI SDK');

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      messages.push({
        role: 'user',
        content: prompt
      });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 4000,
        temperature: 0.7, // Adding temperature parameter as per DeepSeek docs
        stream: false
      });

      if (!completion.choices || !completion.choices[0] || !completion.choices[0].message) {
        throw new Error('Invalid response structure from DeepSeek API');
      }

      const content = completion.choices[0].message.content;
      const reasoningContent = (completion.choices[0].message as any).reasoning_content;

      if (!content) {
        throw new Error('DeepSeek returned empty response');
      }

      // Log reasoning content for debugging (optional)
      if (reasoningContent) {
        console.log('[DeepSeekService] Reasoning process available (length:', reasoningContent.length, 'chars)');
      }

      console.log('[DeepSeekService] Successfully generated response via DeepSeek API');
      return content.trim();
    } catch (error) {
      console.error('[DeepSeekService] Error generating response:', error);
      throw new Error(`DeepSeek generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a structured JSON response using DeepSeek's reasoning model via OpenAI SDK
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
      console.log('[DeepSeekService] Generating structured response via DeepSeek API with OpenAI SDK');

      const enhancedSystemPrompt = `${systemPrompt || ''}\n\nIMPORTANT: You must respond with valid JSON that matches this schema: ${schema}\n\nReturn ONLY the JSON object, no additional text or explanation.`;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      if (enhancedSystemPrompt) {
        messages.push({
          role: 'system',
          content: enhancedSystemPrompt
        });
      }

      messages.push({
        role: 'user',
        content: prompt
      });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 4000,
        temperature: 0.7, // Adding temperature parameter
        stream: false
      });

      if (!completion.choices || !completion.choices[0] || !completion.choices[0].message) {
        throw new Error('Invalid response structure from DeepSeek API');
      }

      const response = completion.choices[0].message.content;
      const reasoningContent = (completion.choices[0].message as any).reasoning_content;

      if (!response) {
        throw new Error('DeepSeek returned empty response');
      }

      // Log reasoning content for debugging (optional)
      if (reasoningContent) {
        console.log('[DeepSeekService] Reasoning process available for structured response (length:', reasoningContent.length, 'chars)');
      }

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
   * Test the DeepSeek API connection using OpenAI SDK
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('[DeepSeekService] Testing connection to DeepSeek API');

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, respond with "working"' }
        ],
        max_tokens: 100,
        temperature: 0.7
      });

      const response = completion.choices[0]?.message?.content || '';
      const isWorking = response.length > 0 && !response.toLowerCase().includes('error');

      console.log('[DeepSeekService] Connection test result:', isWorking ? 'SUCCESS' : 'FAILED');
      return isWorking;
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
