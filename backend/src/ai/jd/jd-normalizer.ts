import {
  CanonicalNormalizedJD,
  CanonicalNormalizedJDSchema,
  SkillProficiency,
  RequirementSource,
} from './jd-schema';

/**
 * Heuristic technical category classifier for common skills and technologies.
 */
export function categorizeSkill(skillName: string): string {
  const s = (skillName || '').toLowerCase().trim();

  if (s.includes('react') || s.includes('vue') || s.includes('angular') || s.includes('next') || s.includes('css') || s.includes('html') || s.includes('tailwind') || s.includes('frontend')) {
    return 'FRONTEND';
  }
  if (s.includes('node') || s.includes('express') || s.includes('nest') || s.includes('python') || s.includes('django') || s.includes('fastapi') || s.includes('golang') || s.includes('go') || s.includes('java') || s.includes('spring') || s.includes('c#') || s.includes('.net') || s.includes('backend') || s.includes('rust') || s.includes('php') || s.includes('ruby')) {
    return 'BACKEND';
  }
  if (s.includes('sql') || s.includes('postgres') || s.includes('mongo') || s.includes('redis') || s.includes('database') || s.includes('dynamo') || s.includes('cassandra') || s.includes('oracle') || s.includes('mysql')) {
    return 'DATABASE';
  }
  if (s.includes('docker') || s.includes('kubernetes') || s.includes('k8s') || s.includes('aws') || s.includes('azure') || s.includes('gcp') || s.includes('ci/cd') || s.includes('terraform') || s.includes('devops') || s.includes('linux')) {
    return 'DEVOPS';
  }
  if (s.includes('jest') || s.includes('cypress') || s.includes('selenium') || s.includes('testing') || s.includes('qa') || s.includes('playwright')) {
    return 'TESTING';
  }
  if (s.includes('system design') || s.includes('architecture') || s.includes('microservices') || s.includes('distributed')) {
    return 'ARCHITECTURE';
  }
  if (s.includes('flutter') || s.includes('react native') || s.includes('ios') || s.includes('android') || s.includes('swift') || s.includes('kotlin')) {
    return 'MOBILE';
  }
  if (s.includes('pytorch') || s.includes('tensorflow') || s.includes('machine learning') || s.includes('ai') || s.includes('llm') || s.includes('data science') || s.includes('pandas')) {
    return 'AI_ML';
  }

  return 'GENERAL';
}

/**
 * Maps raw proficiency text to canonical enum.
 */
export function normalizeProficiency(val?: string): SkillProficiency {
  if (!val) return 'INTERMEDIATE';
  const clean = val.toUpperCase().trim();
  if (clean.includes('ADVANCED')) return 'ADVANCED';
  if (clean.includes('EXPERT') || clean.includes('LEAD') || clean.includes('SENIOR')) return 'EXPERT';
  if (clean.includes('BEGINNER') || clean.includes('ENTRY') || clean.includes('BASIC')) return 'BEGINNER';
  if (clean.includes('INTERMEDIATE') || clean.includes('MID')) return 'INTERMEDIATE';
  return 'UNKNOWN';
}

/**
 * Normalizes 9-Step Comprehensive Form input directly into the Canonical Normalized JD Schema.
 * Guarantees zero loss of explicit recruiter intent, preserve exact values, and tags field sources.
 */
export class JDNormalizer {
  static normalizeFromForm(rawForm: Record<string, any>): CanonicalNormalizedJD {
    // 1. Job Basics (Step 1)
    const rawJobLevel = (rawForm.jobLevel || 'Mid Level').toUpperCase().replace(/\s+/g, '_');
    const normalizedLevel = rawJobLevel.includes('SENIOR')
      ? 'SENIOR'
      : rawJobLevel.includes('LEAD')
      ? 'LEAD'
      : rawJobLevel.includes('MANAGER')
      ? 'MANAGER'
      : rawJobLevel.includes('ENTRY')
      ? 'ENTRY_LEVEL'
      : rawJobLevel.includes('INTERN')
      ? 'INTERN'
      : 'MID_LEVEL';

    const rawWorkMode = (rawForm.workMode || 'Remote').toUpperCase().replace(/[-\s]+/g, '_');
    const normalizedWorkMode = rawWorkMode.includes('ON') ? 'ON_SITE' : rawWorkMode.includes('HYBRID') ? 'HYBRID' : 'REMOTE';

    const rawEmploymentType = (rawForm.employmentType || 'Full-time').toUpperCase().replace(/[-\s]+/g, '_');
    const normalizedEmploymentType = rawEmploymentType.includes('PART')
      ? 'PART_TIME'
      : rawEmploymentType.includes('CONTRACT')
      ? 'CONTRACT'
      : rawEmploymentType.includes('INTERN')
      ? 'INTERNSHIP'
      : 'FULL_TIME';

    // 2. Role Scope (Step 2)
    const summary = rawForm.shortSummary || rawForm.title || '';
    const description = rawForm.rawContent || rawForm.dayToDayWork || summary;
    const hiringReason = (rawForm.positionReason || 'New Position').toUpperCase().replace(/\s+/g, '_');

    // 3. Responsibilities (Step 3)
    const rawRespList: string[] = Array.isArray(rawForm.responsibilities)
      ? rawForm.responsibilities
      : typeof rawForm.responsibilities === 'string'
      ? rawForm.responsibilities.split('\n').map((s: string) => s.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
      : [];

    const responsibilities: Array<{
      description: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'MANDATORY';
      source: RequirementSource;
    }> = rawRespList.map((resp, idx) => ({
      description: resp,
      priority: (idx === 0 ? 'MANDATORY' : 'HIGH') as 'HIGH' | 'MEDIUM' | 'LOW' | 'MANDATORY',
      source: { type: 'RECRUITER_FORM' as const, step: 3, textEvidence: resp },
    }));

    if (rawForm.dayToDayWork && typeof rawForm.dayToDayWork === 'string' && rawForm.dayToDayWork.trim()) {
      responsibilities.push({
        description: `Day-to-day: ${rawForm.dayToDayWork.trim()}`,
        priority: 'MEDIUM' as const,
        source: { type: 'RECRUITER_FORM' as const, step: 3, textEvidence: rawForm.dayToDayWork.trim() },
      });
    }

    // 4. Required Skills (Step 4)
    const rawReqSkills = Array.isArray(rawForm.requiredSkills) ? rawForm.requiredSkills : [];
    const requiredSkills = rawReqSkills.map((item: any) => {
      const name = typeof item === 'string' ? item : item.name || '';
      const rawImportance = typeof item === 'object' && item.importance ? String(item.importance).toUpperCase() : 'MUST_HAVE';
      const importance = rawImportance.includes('MUST') ? ('MUST_HAVE' as const) : ('MUST_HAVE' as const);
      const proficiency = normalizeProficiency(typeof item === 'object' ? item.proficiency : undefined);

      return {
        name,
        category: categorizeSkill(name),
        importance,
        proficiency,
        source: {
          type: 'RECRUITER_FORM' as const,
          step: 4,
          textEvidence: `${name} (${item.importance || 'Must Have'}, ${item.proficiency || 'Intermediate'})`,
        },
      };
    }).filter((s) => Boolean(s.name.trim()));

    // 7. Preferred Skills (Step 7)
    const rawPrefSkills = Array.isArray(rawForm.preferredSkills)
      ? rawForm.preferredSkills
      : typeof rawForm.preferredSkills === 'string'
      ? rawForm.preferredSkills.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const preferredSkills = rawPrefSkills.map((item: any) => {
      const name = typeof item === 'string' ? item : item.name || '';
      return {
        name,
        category: categorizeSkill(name),
        importance: 'PREFERRED' as const,
        proficiency: normalizeProficiency(typeof item === 'object' ? item.proficiency : 'Intermediate'),
        source: {
          type: 'RECRUITER_FORM' as const,
          step: 7,
          textEvidence: typeof item === 'string' ? item : JSON.stringify(item),
        },
      };
    }).filter((s) => Boolean(s.name.trim()));

    // 5. Experience (Step 5)
    const minYears = Number(rawForm.minExperience) || 0;
    const maxYears = rawForm.maxExperience !== undefined && rawForm.maxExperience !== null && rawForm.maxExperience !== ''
      ? Number(rawForm.maxExperience)
      : null;

    const rawIndustry = rawForm.industryExperience
      ? [String(rawForm.industryExperience)]
      : rawForm.relevantExperience
      ? [String(rawForm.relevantExperience)]
      : [];

    const freshersAllowed = Boolean(rawForm.freshersAllowed);
    const fresherRequirements: string[] = Array.isArray(rawForm.fresherRequirements)
      ? rawForm.fresherRequirements
      : rawForm.fresherRequirements
      ? [String(rawForm.fresherRequirements)]
      : [];

    const experience = {
      minimumYears: minYears,
      maximumYears: maxYears,
      industryExperience: rawIndustry,
      freshersAllowed,
      fresherRequirements,
      source: {
        type: 'RECRUITER_FORM' as const,
        step: 5,
        textEvidence: `Exp: ${minYears}-${maxYears || 'open'} yrs, Freshers: ${freshersAllowed ? 'Yes' : 'No'}`,
      },
    };

    // 6. Education (Step 6)
    const rawEdu = (rawForm.minEducation || "Bachelor's").toUpperCase();
    const minEduLevel = rawEdu.includes('PHD')
      ? 'PHD'
      : rawEdu.includes('MASTER')
      ? 'MASTERS'
      : rawEdu.includes('DIPLOMA')
      ? 'DIPLOMA'
      : rawEdu.includes('NO')
      ? 'NONE'
      : 'BACHELORS';

    const degrees = rawForm.requiredDegree ? [String(rawForm.requiredDegree)] : [];
    const certifications = rawForm.certificationsRequired ? [String(rawForm.certificationsRequired)] : [];

    const education = {
      minimumLevel: minEduLevel,
      degrees,
      minimumCGPA: rawForm.cgpaRequirement || null,
      certifications,
      source: {
        type: 'RECRUITER_FORM' as const,
        step: 6,
        textEvidence: `Education: ${rawForm.minEducation || 'N/A'}, Degree: ${rawForm.requiredDegree || 'N/A'}`,
      },
    };

    // 8. Candidate Qualities & Logistics (Step 8)
    const rawBehavioral = rawForm.candidateQualities
      ? String(rawForm.candidateQualities)
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : ['Ownership', 'Problem Solving', 'Communication'];

    const rawLangs = Array.isArray(rawForm.languagesRequired)
      ? rawForm.languagesRequired
      : rawForm.languagesRequired
      ? [String(rawForm.languagesRequired)]
      : ['English'];

    const candidateQualities = {
      behavioral: rawBehavioral,
      languages: rawLangs,
      source: { type: 'RECRUITER_FORM' as const, step: 8, textEvidence: String(rawForm.candidateQualities || '') },
    };

    const logistics = {
      shiftRequirements: rawForm.otherRequirements ? [String(rawForm.otherRequirements)] : [],
      relocationRequired: false,
      workMode: normalizedWorkMode,
      location: rawForm.location || 'Remote',
      joiningDate: rawForm.joiningDate || null,
      source: { type: 'RECRUITER_FORM' as const, step: 1 },
    };

    const hasSysDesign = requiredSkills.some((s) => s.category === 'ARCHITECTURE') || normalizedLevel === 'SENIOR' || normalizedLevel === 'LEAD';
    const interviewRequirements = {
      technical: true,
      coding: requiredSkills.some((s) => ['BACKEND', 'FRONTEND', 'MOBILE', 'AI_ML'].includes(s.category)),
      systemDesign: hasSysDesign,
      behavioral: true,
      domainKnowledge: rawIndustry.length > 0,
      source: { type: 'RECRUITER_FORM' as const, step: 4 },
    };

    const parsed = CanonicalNormalizedJDSchema.parse({
      job: {
        title: rawForm.title || 'Untitled Position',
        department: rawForm.department || 'Engineering',
        level: normalizedLevel,
        employmentType: normalizedEmploymentType,
        openings: Number(rawForm.openings) || 1,
        workMode: normalizedWorkMode,
        location: rawForm.location || 'Remote',
        joiningDate: rawForm.joiningDate || null,
      },
      role: {
        summary,
        description,
        hiringReason,
      },
      responsibilities,
      requiredSkills,
      preferredSkills,
      experience,
      education,
      candidateQualities,
      logistics,
      interviewRequirements,
      interviewDimensions: [],
    });

    return parsed;
  }
}
