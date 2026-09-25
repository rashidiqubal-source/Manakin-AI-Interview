import { CanonicalNormalizedJD } from '../jd/jd-schema';
import { CanonicalNormalizedResume } from '../resume/resume-schema';

export interface JobFitResult {
  overallScore: number; // 0 to 100
  jdMatchScore: number; // 70% max weight
  resumeScore: number;  // 30% max weight
  status: 'HIGH_FIT' | 'MODERATE_FIT' | 'LOW_FIT';
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  recommendation: string;
}

/**
 * Calculates weighted Job Fit evaluation.
 * JD Requirements are weighted at 70%, Candidate Resume background at 30%.
 */
export function calculateJobFitScore(
  jd: CanonicalNormalizedJD,
  resume: CanonicalNormalizedResume
): JobFitResult {
  const resumeSkillNames = new Set(
    resume.skills.map((s) => s.name.toLowerCase().trim())
  );
  const resumeTechNames = new Set(
    resume.technologies.map((t) => t.toLowerCase().trim())
  );

  const isSkillMatched = (skillName: string) => {
    const clean = skillName.toLowerCase().trim();
    return resumeSkillNames.has(clean) || resumeTechNames.has(clean);
  };

  // 1. JD Required Skills Evaluation (40% of total score)
  const totalRequired = jd.requiredSkills.length || 1;
  const matchedRequiredSkills: string[] = [];
  const missingRequiredSkills: string[] = [];

  for (const req of jd.requiredSkills) {
    if (isSkillMatched(req.name)) {
      matchedRequiredSkills.push(req.name);
    } else {
      missingRequiredSkills.push(req.name);
    }
  }

  const requiredSkillRatio = matchedRequiredSkills.length / totalRequired;
  const requiredSkillPoints = requiredSkillRatio * 40;

  // 2. JD Experience & Education Evaluation (30% of total score)
  const candidateYears = (resume.experience || []).reduce((acc, exp) => acc + (exp.duration ? 1 : 1), 0);
  const minYears = jd.experience.minimumYears || 0;
  const experienceRatio = minYears === 0 ? 1 : Math.min(candidateYears / minYears, 1);
  const experiencePoints = experienceRatio * 20;

  const educationMatch = (resume.education || []).length > 0 ? 10 : 0;
  const jdMatchScore = Math.round(requiredSkillPoints + experiencePoints + educationMatch); // Max 70

  // 3. Resume General Background Evaluation (30% of total score)
  const projectPoints = Math.min((resume.projects || []).length * 5, 15);
  const achievementPoints = Math.min((resume.achievements || []).length * 5, 15);
  const resumeScore = projectPoints + achievementPoints; // Max 30

  const overallScore = Math.min(100, jdMatchScore + resumeScore);

  let status: JobFitResult['status'] = 'LOW_FIT';
  if (overallScore >= 75) status = 'HIGH_FIT';
  else if (overallScore >= 50) status = 'MODERATE_FIT';

  const recommendation =
    status === 'HIGH_FIT'
      ? 'Strong candidate match. Highly recommended for technical interview.'
      : status === 'MODERATE_FIT'
      ? 'Good candidate fit. Recommend probing gap skills during interview.'
      : 'Low alignment with core JD requirements. Review gap skills before proceeding.';

  return {
    overallScore,
    jdMatchScore,
    resumeScore,
    status,
    matchedRequiredSkills,
    missingRequiredSkills,
    recommendation,
  };
}
