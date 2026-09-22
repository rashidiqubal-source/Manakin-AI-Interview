import { z, ZodSchema } from 'zod';
import { logger } from '../../config/logger';

export class StructuredOutputValidator {
  /**
   * Validates raw data against a Zod schema with detailed logging.
   */
  static validate<T>(
    schema: ZodSchema<T>,
    data: unknown,
    contextName: string = 'StructuredOutput'
  ): { success: boolean; data?: T; errors?: string[] } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }

    const formattedErrors = result.error.issues.map(
      (issue) => `[${issue.path.join('.') || 'root'}]: ${issue.message}`
    );

    logger.warn(
      `[${contextName}] Validation failed (${formattedErrors.length} issues):\n${formattedErrors.slice(0, 5).join('\n')}`
    );

    return { success: false, errors: formattedErrors };
  }

  /**
   * Validates or returns fallback value if validation fails.
   */
  static validateOrFallback<T>(
    schema: ZodSchema<T>,
    data: unknown,
    fallback: T,
    contextName: string = 'StructuredOutput'
  ): T {
    const res = this.validate(schema, data, contextName);
    if (res.success && res.data) {
      return res.data;
    }
    return fallback;
  }
}
