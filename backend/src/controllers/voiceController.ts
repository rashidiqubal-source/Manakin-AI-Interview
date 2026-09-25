import { Request, Response } from 'express';
import { OpenAIService } from '../services/OpenAIService';
import { AppError } from '../utils/AppError';
import fs from 'fs';

export class VoiceController {
  static async processInput(req: Request, res: Response) {
    if (!req.file) {
      return res.status(200).json({ success: true, data: { transcript: '' } });
    }

    try {
      const transcript = await OpenAIService.transcribeAudio(req.file.path);

      // Clean up the temp file after processing
      fs.unlink(req.file.path, (err) => {
        if (err) console.error(`Failed to delete temp file: ${err.message}`);
      });

      return res.status(200).json({ success: true, data: { transcript: transcript || '' } });
    } catch (error: any) {
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(200).json({ success: true, data: { transcript: '' } });
    }
  }
}
