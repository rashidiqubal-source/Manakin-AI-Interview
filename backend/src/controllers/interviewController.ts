import { Request, Response } from 'express';
import { InterviewService } from '../services/InterviewService';
import { inferenceService } from '../ml/services/inferenceService';
import { KokoroTTSService } from '../services/KokoroTTSService';

export class InterviewController {
  static async start(req: Request, res: Response) {
    try {
      const { candidateName, candidateEmail, isDemo } = req.body;
      const result = await InterviewService.startInterview(
        candidateName,
        candidateEmail,
        undefined,
        undefined,
        Boolean(isDemo)
      );
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async respond(req: Request, res: Response) {
    try {
      const { sessionId, text, silenceDurationSec, ttsDurationSec, codeSubmission } = req.body;
      const result = await InterviewService.respondToInterview(
        sessionId,
        text,
        { silenceDurationSec, ttsDurationSec },
        codeSubmission
      );
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async evaluate(req: Request, res: Response) {
    try {
      const { sessionId, videoEngagementScore, cheatFlags, eyeTrackingTelemetry } = req.body;
      const result = await InterviewService.evaluateSession(sessionId, videoEngagementScore, cheatFlags, eyeTrackingTelemetry);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async concludeEarly(req: Request, res: Response) {
    try {
      const { sessionId, reason } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, message: 'sessionId is required' });
      }
      const result = await InterviewService.concludeEarlyAndReject(sessionId, reason);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async submitFeedback(req: Request, res: Response) {
    try {
      const { sessionId, feedback } = req.body;
      const result = await InterviewService.submitFeedback(sessionId, feedback);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getSessionsByEmail(req: Request, res: Response) {
    try {
      const { email } = req.params;
      const result = await InterviewService.getSessionsByEmail(email as string);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async proctorFrame(req: Request, res: Response) {
    try {
      const { sessionId, image } = req.body;
      const result = await inferenceService.runDetection(image, { runFace: true, runObject: true });
      if (!result.success) {
        return res.status(200).json({ success: true, data: { faceDetected: true, phoneDetected: false } });
      }
      const faceDetected = Boolean(result.faces && result.faces.length > 0);
      const phoneDetected = Boolean(
        (result.objects || []).some(
          (obj) =>
            ['cell phone', 'phone', 'remote', 'book', 'laptop', 'tablet'].includes(obj.class) &&
            obj.confidence >= 0.2
        )
      );
      res.status(200).json({ success: true, data: { faceDetected, phoneDetected } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async generateQuestions(req: Request, res: Response) {
    try {
      const { jobDescriptionId, applicantResumeId, normalizedJD, normalizedResume, candidateName } = req.body;
      let jd = normalizedJD;
      let resume = normalizedResume;
      let name = candidateName;

      const { prisma } = require('../config/prisma');
      const { QuestionEngine } = require('../ai');

      if (jobDescriptionId) {
        const jdRecord = await prisma.jobDescription.findUnique({ where: { id: jobDescriptionId } });
        if (jdRecord) {
          jd = (jdRecord.normalizedJD as any) || jd;
        }
      }

      if (applicantResumeId) {
        const resumeRecord = await prisma.applicantResume.findUnique({ where: { id: applicantResumeId } });
        if (resumeRecord) {
          resume = (resumeRecord.normalizedResume as any) || resume;
          if (!name && resumeRecord.aiAnalysis) {
            name = (resumeRecord.aiAnalysis as any).candidateName;
          }
        }
      }

      if (!jd || !resume) {
        return res.status(400).json({
          success: false,
          message: 'Both Job Description and Applicant Resume (or their respective IDs) are required.',
        });
      }

      const plan = await QuestionEngine.generateQuestions(jd, resume, name);
      res.status(200).json({ success: true, data: plan });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async generateTTS(req: Request, res: Response) {
    try {
      const { text, voice, speed } = req.body;
      if (!text) {
        return res.status(400).json({ success: false, message: 'Text is required for TTS synthesis' });
      }
      const result = await KokoroTTSService.synthesizeSpeech({ text, voice, speed });
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getExplainableReport(req: Request, res: Response) {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
      if (!id) {
        return res.status(400).json({ success: false, message: 'Session ID is required' });
      }
      const report = await InterviewService.getExplainableReport(id as string);
      res.status(200).json({ success: true, data: report });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }
}

