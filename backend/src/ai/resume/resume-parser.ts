import { logger } from '../../config/logger';

export interface RuleExtractedFields {
  detectedEmail: string | null;
  detectedPhone: string | null;
  detectedLinks: string[];
}

export interface DetectedSection {
  type: 'EXPERIENCE' | 'EDUCATION' | 'PROJECTS' | 'SKILLS' | 'CERTIFICATIONS' | 'ACHIEVEMENTS' | 'SUMMARY' | 'OTHER';
  heading: string;
  content: string;
}

export class ResumeParser {
  /**
   * Extracts text from PDF buffer using pdf-parse.
   */
  static async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(pdfBuffer);
      return data.text || '';
    } catch (error: any) {
      logger.error(`[ResumeParser] pdf-parse extraction error: ${error.message}`);
      throw new Error('Could not parse PDF file text. Please verify the file is a valid PDF.');
    }
  }

  /**
   * Extracts text from DOCX buffer using mammoth.
   */
  static async extractTextFromDOCX(docxBuffer: Buffer): Promise<string> {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      return result.value || '';
    } catch (error: any) {
      logger.error(`[ResumeParser] mammoth DOCX extraction error: ${error.message}`);
      throw new Error('Could not parse DOCX file text. Please verify the file is a valid Word document.');
    }
  }

  /**
   * Automatically detects file format (PDF, DOCX, or Plain Text) from buffer magic bytes or file extension.
   */
  static async extractText(buffer: Buffer, originalName?: string): Promise<string> {
    const filename = (originalName || '').toLowerCase();

    // Check magic bytes
    const isDocx = (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) ||
      filename.endsWith('.docx');

    if (isDocx) {
      try {
        return await this.extractTextFromDOCX(buffer);
      } catch (err: any) {
        logger.warn(`[ResumeParser] DOCX extraction failed, trying PDF fallback: ${err.message}`);
      }
    }

    const isPdf = buffer.toString('utf8', 0, 5).startsWith('%PDF-') || filename.endsWith('.pdf');
    if (isPdf) {
      return await this.extractTextFromPDF(buffer);
    }

    // Default to PDF parsing or UTF-8 text
    try {
      return await this.extractTextFromPDF(buffer);
    } catch {
      return buffer.toString('utf8');
    }
  }

  /**
   * Cleans text and removes irregular whitespace/artifacts while preserving line and bullet boundaries.
   */
  static cleanExtractedText(text: string): string {
    return (text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Regex-based extraction of emails, phone numbers, and web links.
   */
  static extractRuleBasedFields(text: string): RuleExtractedFields {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

    const linkRegex = /https?:\/\/[^\s<>"]+|github\.com\/[a-zA-Z0-9_-]+|linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi;
    const linkMatches = text.match(linkRegex) || [];

    const normalizedLinks = Array.from(
      new Set(
        linkMatches.map((l) => (l.startsWith('http') ? l : `https://${l}`))
      )
    );

    return {
      detectedEmail: emailMatch ? emailMatch[0].toLowerCase() : null,
      detectedPhone: phoneMatch ? phoneMatch[0] : null,
      detectedLinks: normalizedLinks,
    };
  }

  /**
   * Semantic Section Detection: Identifies standard and variant resume section boundaries.
   */
  static detectSections(text: string): DetectedSection[] {
    const lines = text.split('\n');
    const sections: DetectedSection[] = [];

    const sectionPatterns: Array<{
      type: DetectedSection['type'];
      regex: RegExp;
    }> = [
      {
        type: 'EXPERIENCE',
        regex: /^(?:(?:work|professional|career|employment)\s+experience|experience|employment(?:\s+history)?|work\s+history)$/i,
      },
      {
        type: 'EDUCATION',
        regex: /^(?:education(?:al\s+background)?|academic\s+(?:background|qualifications|history)|qualifications)$/i,
      },
      {
        type: 'PROJECTS',
        regex: /^(?:(?:personal|academic|selected|key|technical)\s+projects|projects)$/i,
      },
      {
        type: 'SKILLS',
        regex: /^(?:(?:technical|core|key)\s+(?:skills|competencies|expertise)|skills(?:\s+&\s+abilities)?|technologies|tech\s+stack)$/i,
      },
      {
        type: 'CERTIFICATIONS',
        regex: /^(?:certifications?|certificates?|licenses(?:\s+&\s+certifications)?)$/i,
      },
      {
        type: 'ACHIEVEMENTS',
        regex: /^(?:achievements?|honors(?:\s+&\s+awards)?|accomplishments?|awards)$/i,
      },
      {
        type: 'SUMMARY',
        regex: /^(?:professional\s+summary|summary|profile|about\s+me|career\s+objective)$/i,
      },
    ];

    let currentSection: DetectedSection = {
      type: 'OTHER',
      heading: 'Header / Intro',
      content: '',
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Check if this line looks like a section header (short line, standalone heading)
      const cleanHeader = line.replace(/[:\-_#=*]+$/, '').trim();
      let matchedType: DetectedSection['type'] | null = null;

      if (cleanHeader.length <= 40 && !cleanHeader.includes('.')) {
        for (const pattern of sectionPatterns) {
          if (pattern.regex.test(cleanHeader)) {
            matchedType = pattern.type;
            break;
          }
        }
      }

      if (matchedType) {
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection, content: currentSection.content.trim() });
        }
        currentSection = {
          type: matchedType,
          heading: cleanHeader,
          content: '',
        };
      } else {
        currentSection.content += `${rawLine}\n`;
      }
    }

    if (currentSection.content.trim()) {
      sections.push({ ...currentSection, content: currentSection.content.trim() });
    }

    return sections;
  }
}
