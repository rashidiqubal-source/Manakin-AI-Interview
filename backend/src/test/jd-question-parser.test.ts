import { parseClarificationQuestions } from '../ai/jd/jd-question-parser';

describe('Clarification Question Regex Parser', () => {
  it('parses standard 1. 2. 3. formatted questions', () => {
    const raw = `
1. Which cloud platform is mandatory?
2. Should Kubernetes be considered mandatory or preferred?
3. Is 3+ years experience a hard requirement?
`;
    const result = parseClarificationQuestions(raw);
    expect(result.questionCount).toBe(3);
    expect(result.questions).toEqual([
      { number: 1, text: 'Which cloud platform is mandatory?' },
      { number: 2, text: 'Should Kubernetes be considered mandatory or preferred?' },
      { number: 3, text: 'Is 3+ years experience a hard requirement?' },
    ]);
  });

  it('handles numbering gaps and renumbers sequentially', () => {
    const raw = `
1. Question A
3. Question B
7. Question C
`;
    const result = parseClarificationQuestions(raw);
    expect(result.questionCount).toBe(3);
    expect(result.largestExtractedNumber).toBe(7);
    expect(result.questions).toEqual([
      { number: 1, text: 'Question A' },
      { number: 2, text: 'Question B' },
      { number: 3, text: 'Question C' },
    ]);
  });

  it('returns zero questions for clear JDs', () => {
    const result = parseClarificationQuestions('');
    expect(result.questionCount).toBe(0);
    expect(result.questions).toEqual([]);
  });
});
