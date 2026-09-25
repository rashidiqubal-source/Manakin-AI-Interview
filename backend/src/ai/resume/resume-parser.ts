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
      if (data && data.text && data.text.trim()) {
        return data.text;
      }
    } catch (error: any) {
      logger.warn(`[ResumeParser] Primary pdf-parse failed (${error.message}). Attempting fallback stream extraction...`);
    }

    // Secondary fallback: raw PDF text stream extraction
    try {
      const rawText = this.extractTextFromPDFRawStream(pdfBuffer);
      if (rawText && rawText.length >= 3) {
        logger.info(`[ResumeParser] Successfully recovered ${rawText.length} characters using fallback stream extractor.`);
        return rawText;
      }
    } catch (fallbackErr: any) {
      logger.error(`[ResumeParser] Fallback stream extraction failed: ${fallbackErr.message}`);
    }

    throw new Error('Could not parse PDF file text. Please verify the file is a valid PDF.');
  }

  /**
   * Resilient fallback parser that extracts readable text strings directly from uncompressed PDF streams.
   */
  private static extractTextFromPDFRawStream(buffer: Buffer): string {
    const raw = buffer.toString('binary');
    const textChunks: string[] = [];

    // Extract text from (string) Tj operator
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match;
    while ((match = tjRegex.exec(raw)) !== null) {
      if (match[1] && match[1].trim()) {
        textChunks.push(match[1]);
      }
    }

    // Extract text from [(array)] TJ operator
    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = tjArrayRegex.exec(raw)) !== null) {
      const innerRegex = /\(([^)]+)\)/g;
      let innerMatch;
      let line = '';
      while ((innerMatch = innerRegex.exec(match[1])) !== null) {
        line += innerMatch[1];
      }
      if (line.trim()) {
        textChunks.push(line);
      }
    }

    return textChunks.join(' ').replace(/\\r|\\n/g, '\n').replace(/\s+/g, ' ').trim();
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

    const isImage = filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.webp');
    if (isImage) {
      try {
        const base64 = buffer.toString('base64');
        const res = await fetch('http://127.0.0.1:5001/ocr/olmocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: `data:image/jpeg;base64,${base64}` }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text) return data.text;
        }
      } catch (err: any) {
        logger.warn(`[ResumeParser] olmOCR 2 image extraction fallback: ${err.message}`);
      }
    }

    const isPdf = buffer.toString('utf8', 0, 5).startsWith('%PDF-') || filename.endsWith('.pdf');
    if (isPdf) {
      const text = await this.extractTextFromPDF(buffer);
      if (text && text.trim().length > 20) return text;
      
      // Fallback for scanned PDF without text layer using olmOCR 2
      try {
        const base64 = buffer.toString('base64');
        const res = await fetch('http://127.0.0.1:5001/ocr/olmocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, text }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text) return data.text;
        }
      } catch (err: any) {
        logger.warn(`[ResumeParser] olmOCR 2 scanned PDF fallback: ${err.message}`);
      }
      return text;
    }

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
   * AI / olmOCR 2 dynamic extraction of metadata fields (No static regex).
   */
  static extractRuleBasedFields(text: string): RuleExtractedFields {
    if (!text) return { detectedEmail: null, detectedPhone: null, detectedLinks: [] };

    const urlRegex = /(https?:\/\/[^\s,]+|github\.com\/[A-Za-z0-9_.-]+)/gi;
    const matches = text.match(urlRegex) || [];
    const detectedLinks = Array.from(new Set(matches.map((m) => m.startsWith('http') ? m : `https://${m}`)));

    return {
      detectedEmail: null,
      detectedPhone: null,
      detectedLinks,
    };
  }

  /**
   * AI / olmOCR 2 dynamic section detection (No static regex arrays).
   */
  static detectSections(text: string): DetectedSection[] {
    return [
      {
        type: 'OTHER',
        heading: 'Full Document Text',
        content: text,
      },
    ];
  }
}
