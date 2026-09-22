import { Request, Response } from 'express';
import { InterviewService } from '../services/InterviewService';
import { ProctoringService } from '../services/ProctoringService';

export class InterviewController {
  static async start(req: Request, res: Response) {
    try {
      const { candidateName, candidateEmail } = req.body;
      const result = await InterviewService.startInterview(candidateName, candidateEmail);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async respond(req: Request, res: Response) {
    try {
      const { sessionId, text } = req.body;
      const result = await InterviewService.respondToInterview(sessionId, text);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async evaluate(req: Request, res: Response) {
    try {
      const { sessionId, videoEngagementScore, cheatFlags } = req.body;
      const result = await InterviewService.evaluateSession(sessionId, videoEngagementScore, cheatFlags);
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
      console.log(`[PROCTOR] Incoming image prefix: ${image ? image.substring(0, 40) : 'undefined'}`);
      const result = await ProctoringService.analyzeFrame(image);
      res.status(200).json({ success: true, data: result });
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
}

