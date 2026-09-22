import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const OPENAI_API_KEY = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIClient {
  /**
   * Cleans text to extract raw JSON, handling code blocks, stray wrappers, and trailing commas.
   */
  static cleanJsonText(rawText: string): string {
    if (!rawText) return '{}';
    let cleaned = rawText.trim();

    // Match code block ```json ... ``` or ``` ... ```
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleaned = codeBlockMatch[1].trim();
    } else {
      // Find outer braces or brackets
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    }

    // Clean common JSON trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    return cleaned;
  }

  /**
   * Standard chat completion
   */
  static async getCompletion(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<string> {
    const model = options.model || 'gpt-4o-mini';
    const temperature = options.temperature ?? 0.3;

    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: options.maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      logger.error(`[AIClient] Chat completion error: ${error.message || error}`);
      throw error;
    }
  }

  /**
   * Structured completion: executes prompt, parses JSON, validates through parser, or uses fallback.
   */
  static async getStructuredCompletion<T>(
    messages: ChatMessage[],
    parser: (raw: any) => T,
    fallback: () => T,
    options: CompletionOptions = {}
  ): Promise<T> {
    try {
      const rawText = await this.getCompletion(messages, options);
      const cleaned = this.cleanJsonText(rawText);
      const parsedJson = JSON.parse(cleaned);
      return parser(parsedJson);
    } catch (error: any) {
      logger.warn(`[AIClient] Structured completion failed or returned invalid JSON (${error.message}). Invoking fallback.`);
      return fallback();
    }
  }
}
