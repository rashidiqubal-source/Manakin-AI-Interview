import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { JDAnalysisService } from '../../services/JDAnalysisService';
import { InvitationService } from '../../services/InvitationService';
import { optionalAuth } from '../../middlewares/requireAuth';

const router = Router();
router.use(optionalAuth);

/**
 * Helper to resolve recruiter user from session context or provided ID
 */
async function resolveRecruiter(req: any, fallbackId?: string) {
  const userId = fallbackId || req.user?.id;
  if (!userId) {
    throw new AppError('Recruiter authentication or ID is required', 400);
  }

  let recruiter = await prisma.user.findUnique({ where: { id: userId } });
  if (!recruiter) {
    throw new AppError('Recruiter account not found', 404);
  }

  // Ensure user has RECRUITER permissions
  if (recruiter.role !== 'RECRUITER') {
    recruiter = await prisma.user.update({
      where: { id: recruiter.id },
      data: { role: 'RECRUITER' }
    });
  }

  return recruiter;
}


/**
 * POST /api/v1/recruiter/jd/create
 * Recruiter creates a structured Job Description (Draft or Published)
 */
router.post('/jd/create', async (req, res, next) => {
  try {
    const {
      recruiterId,
      userId,
      title,
      department,
      jobLevel,
      employmentType,
      openings,
      location,
      workMode,
      joiningDate,
      shortSummary,
      rawContent,
      positionReason,
      responsibilities,
      dayToDayWork,
      requiredSkills,
      minExperience,
      maxExperience,
      relevantExperience,
      industryExperience,
      freshersAllowed,
      fresherRequirements,
      minEducation,
      requiredDegree,
      cgpaRequirement,
      certificationsRequired,
      preferredSkills,
      preferredExperience,
      otherPreferredSkills,
      candidateQualities,
      languagesRequired,
      otherRequirements,
      isDraft
    } = req.body;

    const recruiter = await resolveRecruiter(req, recruiterId || userId);

    if (!title && !isDraft) {
      throw new AppError('Job Title is required', 400);
    }

    // Compile readable full text if rawContent is not directly provided
    const compiledContent = rawContent || `
Job Title: ${title || 'Untitled'}
Department: ${department || 'N/A'} | Level: ${jobLevel || 'N/A'} | Type: ${employmentType || 'N/A'} | Work Mode: ${workMode || 'N/A'} | Location: ${location || 'N/A'}
Openings: ${openings || 1} | Expected Joining: ${joiningDate || 'ASAP'}

SUMMARY:
${shortSummary || 'N/A'}

PRIMARY RESPONSIBILITIES:
${Array.isArray(responsibilities) ? responsibilities.map((r: any) => `• ${r}`).join('\n') : 'N/A'}

DAY-TO-DAY WORK:
${dayToDayWork || 'N/A'}

REQUIRED TECHNICAL SKILLS:
${Array.isArray(requiredSkills) ? requiredSkills.map((s: any) => `• ${s.name || s} (${s.importance || 'Must Have'}, ${s.proficiency || 'Intermediate'})`).join('\n') : 'N/A'}

EXPERIENCE & EDUCATION:
• Experience: ${minExperience || 0} to ${maxExperience ? maxExperience + ' yrs' : 'open'} | Industry: ${industryExperience || 'Relevant'}
• Freshers Allowed: ${freshersAllowed ? 'Yes' : 'No'} ${fresherRequirements ? `(Requires: ${Array.isArray(fresherRequirements) ? fresherRequirements.join(', ') : fresherRequirements})` : ''}
• Minimum Education: ${minEducation || 'N/A'} | Degree: ${requiredDegree || 'N/A'} | CGPA: ${cgpaRequirement || 'N/A'}

PREFERRED SKILLS & QUALIFICATIONS:
• Preferred Skills: ${Array.isArray(preferredSkills) ? preferredSkills.join(', ') : preferredSkills || 'N/A'}
• Preferred Experience: ${preferredExperience || 'N/A'}
• Other Preferred: ${otherPreferredSkills || 'N/A'}

CANDIDATE QUALITIES & REQUIREMENTS:
• Key Qualities: ${candidateQualities || 'N/A'}
• Languages: ${Array.isArray(languagesRequired) ? languagesRequired.join(', ') : languagesRequired || 'N/A'}
• Additional Requirements: ${otherRequirements || 'N/A'}
    `.trim();

    const compiledSummary = shortSummary || `${title || 'Job Opening'} position in ${department || 'General'} department (${workMode || 'Hybrid'}, ${location || 'Remote'}). Requirements: ${minExperience || 0}+ years exp, ${minEducation || "Bachelor's"}.`;

    // Perform Canonical Normalization & Interview Blueprint Analysis (Preserves explicit recruiter inputs)
    const analysis = await JDAnalysisService.normalizeAndAnalyzeFormJD(req.body);

    const jd = await prisma.jobDescription.create({
      data: {
        recruiterId: recruiter.id,
        title: title || 'Untitled Job Draft',
        rawContent: compiledContent,
        aiSummary: analysis.aiSummary || compiledSummary,
        aiAnalysis: analysis.aiAnalysis as any,
        normalizedJD: analysis.normalizedJD as any,
        interviewBlueprint: analysis.interviewBlueprint as any,
        contentHash: analysis.contentHash,
        analysisVersion: 'v2',
        department,
        jobLevel,
        employmentType,
        openings: openings ? parseInt(String(openings), 10) : 1,
        location,
        workMode,
        joiningDate,
        shortSummary,
        positionReason,
        responsibilities,
        dayToDayWork,
        requiredSkills,
        minExperience: minExperience ? parseFloat(String(minExperience)) : 0,
        maxExperience: maxExperience ? parseFloat(String(maxExperience)) : null,
        relevantExperience,
        industryExperience,
        freshersAllowed: Boolean(freshersAllowed),
        fresherRequirements,
        minEducation,
        requiredDegree,
        cgpaRequirement,
        certificationsRequired,
        preferredSkills,
        preferredExperience,
        otherPreferredSkills,
        candidateQualities,
        languagesRequired,
        otherRequirements,
        isDraft: Boolean(isDraft)
      }
    });

    return res.status(201).json({ status: 'success', data: jd });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/recruiter/jd/upload
 * Recruiter uploads Quick-Paste Job Description -> AI JD Parser -> Canonical Normalized JD -> Interview Blueprint -> stored in DB
 */
router.post('/jd/upload', async (req, res, next) => {
  try {
    const { recruiterId, userId, title, content } = req.body;

    const recruiter = await resolveRecruiter(req, recruiterId || userId);

    if (!title || !content) {
      throw new AppError('Job title and content are required', 400);
    }

    // AI Analysis producing identical Canonical Normalized JD and Blueprint
    const analysis = await JDAnalysisService.analyzeQuickPasteJD(content, title);
    const norm = analysis.normalizedJD;

    // Save in DB with both normalized schemas and individual fields
    const jd = await prisma.jobDescription.create({
      data: {
        recruiterId: recruiter.id,
        title: title || norm.job.title,
        rawContent: content,
        aiSummary: analysis.aiSummary,
        aiAnalysis: analysis.aiAnalysis as any,
        normalizedJD: norm as any,
        interviewBlueprint: analysis.interviewBlueprint as any,
        contentHash: analysis.contentHash,
        analysisVersion: 'v2',
        department: norm.job.department,
        jobLevel: norm.job.level,
        employmentType: norm.job.employmentType,
        openings: norm.job.openings,
        location: norm.job.location,
        workMode: norm.job.workMode,
        shortSummary: norm.role.summary,
        responsibilities: norm.responsibilities.map((r) => r.description),
        requiredSkills: norm.requiredSkills as any,
        preferredSkills: norm.preferredSkills.map((s) => s.name) as any,
        minExperience: norm.experience.minimumYears,
        maxExperience: norm.experience.maximumYears,
        freshersAllowed: norm.experience.freshersAllowed,
        minEducation: norm.education.minimumLevel,
        candidateQualities: norm.candidateQualities.behavioral.join(', '),
        languagesRequired: norm.candidateQualities.languages as any,
        isDraft: false,
      }
    });

    return res.status(201).json({ status: 'success', data: jd });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/recruiter/jd/:id/blueprint
 * Get Interview Blueprint & Normalized JD for a specific job opening
 */
router.get('/jd/:id/blueprint', async (req, res, next) => {
  try {
    const { id } = req.params;
    const jd = await prisma.jobDescription.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        normalizedJD: true,
        interviewBlueprint: true,
        aiSummary: true,
        aiAnalysis: true,
      },
    });

    if (!jd) {
      throw new AppError('Job Description not found', 404);
    }

    return res.status(200).json({ status: 'success', data: jd });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/recruiter/jds/:recruiterId
 * List all JDs uploaded by a recruiter
 */
router.get('/jds/:recruiterId', async (req, res, next) => {
  try {
    const { recruiterId } = req.params;
    const recruiter = await resolveRecruiter(req, recruiterId);

    const jds = await prisma.jobDescription.findMany({
      where: { recruiterId: recruiter.id },
      orderBy: { createdAt: 'desc' },
      include: {
        invitations: {
          select: { id: true, applicantEmail: true, status: true, createdAt: true }
        }
      }
    });

    return res.status(200).json({ status: 'success', data: jds });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/recruiter/invite
 * Recruiter sends an invitation link to an applicant email
 */
router.post('/invite', async (req, res, next) => {
  try {
    const { recruiterId, userId, jobDescriptionId, applicantEmail } = req.body;

    const recruiter = await resolveRecruiter(req, recruiterId || userId);

    if (!jobDescriptionId || !applicantEmail) {
      throw new AppError('jobDescriptionId and applicantEmail are required', 400);
    }

    const invitation = await InvitationService.createInvitation(recruiter.id, jobDescriptionId, applicantEmail);
    return res.status(201).json({ status: 'success', data: invitation });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/recruiter/invitations/:recruiterId
 * List all invitations sent by recruiter with statuses and applicant details
 */
router.get('/invitations/:recruiterId', async (req, res, next) => {
  try {
    const { recruiterId } = req.params;
    const recruiter = await resolveRecruiter(req, recruiterId);

    const invitations = await prisma.interviewInvitation.findMany({
      where: { recruiterId: recruiter.id },
      orderBy: { createdAt: 'desc' },
      include: {
        jobDescription: { select: { id: true, title: true, aiSummary: true } },
        applicant: { select: { id: true, name: true, email: true } },
        applicantResume: { select: { id: true, fileName: true, aiSummary: true, aiAnalysis: true } },
        interviewSession: {
          select: {
            id: true,
            status: true,
            applicationStatus: true,
            totalScore: true,
            overallRecommendation: true,
            evaluationData: true
          }
        }
      }
    });

    return res.status(200).json({ status: 'success', data: invitations });
  } catch (error) {
    next(error);
  }
});

export default router;
