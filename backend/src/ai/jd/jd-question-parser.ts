export interface ClarificationQuestion {
  number: number;
  text: string;
}

export interface ParsedQuestionsResult {
  questions: ClarificationQuestion[];
  questionCount: number;
  largestExtractedNumber: number;
}

/**
 * Robust regex-based clarification question parser.
 * Supports "1. Question", "1) Question", "1 - Question", multiline parsing.
 * Renumbers questions sequentially and returns authoritative count.
 */
export function parseClarificationQuestions(rawText: string): ParsedQuestionsResult {
  if (!rawText || typeof rawText !== 'string') {
    return { questions: [], questionCount: 0, largestExtractedNumber: 0 };
  }

  const lines = rawText.split(/\r?\n/);
  const parsedItems: Array<{ originalNum: number; text: string }> = [];
  let largestExtractedNumber = 0;

  // Regex pattern matching: leading whitespace, digit(s), optional separator (. / ) / -), question text
  const questionRegex = /^\s*(\d+)\s*[.)\-]?\s*(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(questionRegex);
    if (match && match[1] && match[2]) {
      const extractedNum = parseInt(match[1], 10);
      const questionText = match[2].trim();

      if (extractedNum > largestExtractedNumber) {
        largestExtractedNumber = extractedNum;
      }

      parsedItems.push({
        originalNum: extractedNum,
        text: questionText,
      });
    }
  }

  // Renumber questions sequentially 1..N (authoritative count)
  const questions: ClarificationQuestion[] = parsedItems.map((item, index) => ({
    number: index + 1,
    text: item.text,
  }));

  return {
    questions,
    questionCount: questions.length,
    largestExtractedNumber,
  };
}
