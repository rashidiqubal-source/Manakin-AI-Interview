import { ZodSchema } from 'zod';
import { AIClient, ChatMessage, CompletionOptions } from './ai-client';
import { StructuredOutputValidator } from './structured-output';
import { logger } from '../../config/logger';

export interface PromptRunnerConfig<TInput, TOutput> {
  name: string;
  systemInstruction: string;
  rules: string[];
  outputSchema: ZodSchema<TOutput>;
  schemaDescription: string;
  fallbackGenerator: (input: TInput) => TOutput;
  options?: CompletionOptions;
}

export class PromptRunner {
  /**
   * Executes a structured AI task following the standard pattern:
   * System Instructions + Structured Input + Explicit Rules + Output Schema + Validation
   */
  static async execute<TInput, TOutput>(
    config: PromptRunnerConfig<TInput, TOutput>,
    input: TInput,
    userPromptBuilder: (input: TInput) => string
  ): Promise<TOutput> {
    const formattedRules = config.rules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n');

    const systemMessage = `${config.systemInstruction}

CRITICAL RULES:
${formattedRules}

OUTPUT FORMAT SPECIFICATION:
You MUST respond with a RAW, VALID JSON OBJECT ONLY (no markdown backticks, no markdown code blocks, no explanatory text).
The JSON object must match this schema specification:
${config.schemaDescription}
`;

    const userMessage = userPromptBuilder(input);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ];

    try {
      const rawText = await AIClient.getCompletion(messages, config.options);
      const cleaned = AIClient.cleanJsonText(rawText);
      const parsedJson = JSON.parse(cleaned);

      const validation = StructuredOutputValidator.validate(
        config.outputSchema,
        parsedJson,
        config.name
      );

      if (validation.success && validation.data) {
        return validation.data;
      }

      logger.warn(`[${config.name}] Validation had errors, attempting fallback.`);
      return config.fallbackGenerator(input);
    } catch (error: any) {
      logger.error(`[${config.name}] Execution error: ${error.message}. Returning fallback.`);
      return config.fallbackGenerator(input);
    }
  }
}
