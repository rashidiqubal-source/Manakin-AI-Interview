import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { EmailService } from './EmailService';
import { logger } from '../config/logger';

export class InvitationService {
  /**
   * Create an interview invitation for an applicant by a recruiter
   */
  static async createInvitation(recruiterId: string, jobDescriptionId: string, applicantEmail: string) {
    const recruiter = await prisma.user.findUnique({ where: { id: recruiterId } });
    if (!recruiter || recruiter.role !== 'RECRUITER') {
      throw new AppError('Only recruiters can create interview invitations', 403);
    }

    const jd = await prisma.jobDescription.findUnique({ where: { id: jobDescriptionId } });
    if (!jd) {
      throw new AppError('Job Description not found', 404);
    }

    // Find if applicant user already exists in DB
    const existingApplicant = await prisma.user.findUnique({ where: { email: applicantEmail.trim().toLowerCase() } });

    // Create Invitation record
    const invitation = await prisma.interviewInvitation.create({
      data: {
        jobDescriptionId: jd.id,
        recruiterId: recruiter.id,
        applicantEmail: applicantEmail.trim().toLowerCase(),
        applicantId: existingApplicant ? existingApplicant.id : null,
        status: 'PENDING'
      },
      include: {
        jobDescription: true,
        recruiter: true
      }
    });

    // Asynchronously dispatch invitation email
    EmailService.sendInvitationEmail(applicantEmail, jd.title, invitation.token).catch(err => {
      logger.error(`Failed to send invitation email asynchronously: ${err.message}`);
    });

    return invitation;
  }

  /**
   * Resolve an invitation by unique token for the public invitation landing page
   */
  static async resolveInvitation(token: string) {
    const invitation = await prisma.interviewInvitation.findUnique({
      where: { token },
      include: {
        jobDescription: {
          select: { id: true, title: true, aiSummary: true, aiAnalysis: true }
        },
        applicant: {
          select: { id: true, email: true, name: true }
        },
        applicantResume: {
          select: { id: true, fileName: true, aiSummary: true, aiAnalysis: true, createdAt: true }
        },
        interviewSession: {
          select: { id: true, status: true, applicationStatus: true }
        }
      }
    });

    if (!invitation) {
      throw new AppError('Invalid or expired interview link token', 404);
    }

    // If applicantId is not linked yet, automatically find or create candidate user without requiring login
    if (!invitation.applicantId) {
      let candidateUser = await prisma.user.findUnique({
        where: { email: invitation.applicantEmail.toLowerCase().trim() },
      });

      if (!candidateUser) {
        candidateUser = await prisma.user.create({
          data: {
            email: invitation.applicantEmail.toLowerCase().trim(),
            name: invitation.applicantEmail.split('@')[0],
            role: 'APPLICANT',
            emailVerified: true,
          },
        });
      }

      const updated = await prisma.interviewInvitation.update({
        where: { id: invitation.id },
        data: {
          applicantId: candidateUser.id,
          status: invitation.status === 'PENDING' ? 'ACCEPTED' : invitation.status,
        },
        include: {
          jobDescription: {
            select: { id: true, title: true, aiSummary: true, aiAnalysis: true },
          },
          applicant: {
            select: { id: true, email: true, name: true },
          },
          applicantResume: {
            select: { id: true, fileName: true, aiSummary: true, aiAnalysis: true, createdAt: true },
          },
          interviewSession: {
            select: { id: true, status: true, applicationStatus: true },
          },
        },
      });

      return updated;
    }

    return invitation;
  }

  /**
   * Claim an invitation when applicant signs in / registers with the unique link token
   */
  static async claimInvitation(token: string, applicantId: string) {
    const invitation = await prisma.interviewInvitation.findUnique({ where: { token } });
    if (!invitation) {
      throw new AppError('Invalid invitation token', 404);
    }

    const applicantUser = await prisma.user.findUnique({ where: { id: applicantId } });
    if (!applicantUser) {
      throw new AppError('User profile not found. Please log in first.', 401);
    }

    // Update invitation status to ACCEPTED and link applicantId
    const updatedInvitation = await prisma.interviewInvitation.update({
      where: { id: invitation.id },
      data: {
        applicantId: applicantUser.id,
        status: invitation.status === 'PENDING' ? 'ACCEPTED' : invitation.status
      },
      include: {
        jobDescription: true,
        applicantResume: true,
        interviewSession: true
      }
    });

    return updatedInvitation;
  }

  /**
   * Attach applicant resume to invitation
   */
  static async attachResume(invitationId: string, resumeId: string) {
    return await prisma.interviewInvitation.update({
      where: { id: invitationId },
      data: { applicantResumeId: resumeId }
    });
  }
}
