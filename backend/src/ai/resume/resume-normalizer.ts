import {
  AcademicScore,
  AcademicScoreType,
  DateRange,
  ProjectType,
  ResumeSkill,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
  CanonicalNormalizedResume,
} from './resume-schema';

/**
 * Known CS & Software Engineering canonical technical skills and their alias mappings.
 */
const SKILL_ALIAS_MAP: Record<string, { canonical: string; category: string }> = {
  // Languages
  'js': { canonical: 'JavaScript', category: 'LANGUAGES' },
  'javascript': { canonical: 'JavaScript', category: 'LANGUAGES' },
  'java script': { canonical: 'JavaScript', category: 'LANGUAGES' },

  'ts': { canonical: 'TypeScript', category: 'LANGUAGES' },
  'typescript': { canonical: 'TypeScript', category: 'LANGUAGES' },
  'type script': { canonical: 'TypeScript', category: 'LANGUAGES' },

  'python': { canonical: 'Python', category: 'LANGUAGES' },
  'python3': { canonical: 'Python', category: 'LANGUAGES' },
  'python 3': { canonical: 'Python', category: 'LANGUAGES' },

  'java': { canonical: 'Java', category: 'LANGUAGES' },

  'golang': { canonical: 'Go', category: 'LANGUAGES' },
  'go': { canonical: 'Go', category: 'LANGUAGES' },
  'go language': { canonical: 'Go', category: 'LANGUAGES' },

  'c++': { canonical: 'C++', category: 'LANGUAGES' },
  'cpp': { canonical: 'C++', category: 'LANGUAGES' },

  'c#': { canonical: 'C#', category: 'LANGUAGES' },
  'csharp': { canonical: 'C#', category: 'LANGUAGES' },
  'c sharp': { canonical: 'C#', category: 'LANGUAGES' },

  'c': { canonical: 'C', category: 'LANGUAGES' },
  'rust': { canonical: 'Rust', category: 'LANGUAGES' },
  'php': { canonical: 'PHP', category: 'LANGUAGES' },
  'ruby': { canonical: 'Ruby', category: 'LANGUAGES' },

  // Runtime & Backend Frameworks
  'node': { canonical: 'Node.js', category: 'BACKEND' },
  'nodejs': { canonical: 'Node.js', category: 'BACKEND' },
  'node js': { canonical: 'Node.js', category: 'BACKEND' },
  'node.js': { canonical: 'Node.js', category: 'BACKEND' },

  'express': { canonical: 'Express.js', category: 'BACKEND' },
  'expressjs': { canonical: 'Express.js', category: 'BACKEND' },
  'express.js': { canonical: 'Express.js', category: 'BACKEND' },

  'nestjs': { canonical: 'NestJS', category: 'BACKEND' },
  'nest.js': { canonical: 'NestJS', category: 'BACKEND' },
  'nest js': { canonical: 'NestJS', category: 'BACKEND' },

  'django': { canonical: 'Django', category: 'BACKEND' },
  'fastapi': { canonical: 'FastAPI', category: 'BACKEND' },
  'flask': { canonical: 'Flask', category: 'BACKEND' },
  'spring': { canonical: 'Spring Boot', category: 'BACKEND' },
  'spring boot': { canonical: 'Spring Boot', category: 'BACKEND' },

  // Frontend
  'react': { canonical: 'React', category: 'FRONTEND' },
  'reactjs': { canonical: 'React', category: 'FRONTEND' },
  'react.js': { canonical: 'React', category: 'FRONTEND' },
  'react js': { canonical: 'React', category: 'FRONTEND' },

  'react native': { canonical: 'React Native', category: 'FRONTEND' },
  'react-native': { canonical: 'React Native', category: 'FRONTEND' },

  'next': { canonical: 'Next.js', category: 'FRONTEND' },
  'nextjs': { canonical: 'Next.js', category: 'FRONTEND' },
  'next.js': { canonical: 'Next.js', category: 'FRONTEND' },

  'vue': { canonical: 'Vue.js', category: 'FRONTEND' },
  'vuejs': { canonical: 'Vue.js', category: 'FRONTEND' },
  'vue.js': { canonical: 'Vue.js', category: 'FRONTEND' },

  'angular': { canonical: 'Angular', category: 'FRONTEND' },
  'tailwind': { canonical: 'Tailwind CSS', category: 'FRONTEND' },
  'tailwindcss': { canonical: 'Tailwind CSS', category: 'FRONTEND' },
  'tailwind css': { canonical: 'Tailwind CSS', category: 'FRONTEND' },

  // Databases
  'postgres': { canonical: 'PostgreSQL', category: 'DATABASE' },
  'postgresql': { canonical: 'PostgreSQL', category: 'DATABASE' },
  'postgre sql': { canonical: 'PostgreSQL', category: 'DATABASE' },
  'postgre': { canonical: 'PostgreSQL', category: 'DATABASE' },

  'mongo': { canonical: 'MongoDB', category: 'DATABASE' },
  'mongodb': { canonical: 'MongoDB', category: 'DATABASE' },
  'mongo db': { canonical: 'MongoDB', category: 'DATABASE' },

  'redis': { canonical: 'Redis', category: 'DATABASE' },
  'mysql': { canonical: 'MySQL', category: 'DATABASE' },
  'sql': { canonical: 'SQL', category: 'DATABASE' },
  'sqlite': { canonical: 'SQLite', category: 'DATABASE' },
  'dynamodb': { canonical: 'DynamoDB', category: 'DATABASE' },

  // Cloud & DevOps
  'k8s': { canonical: 'Kubernetes', category: 'DEVOPS' },
  'kubernetes': { canonical: 'Kubernetes', category: 'DEVOPS' },
  'docker': { canonical: 'Docker', category: 'DEVOPS' },

  'aws': { canonical: 'AWS', category: 'DEVOPS' },
  'amazon web services': { canonical: 'AWS', category: 'DEVOPS' },

  'gcp': { canonical: 'GCP', category: 'DEVOPS' },
  'google cloud platform': { canonical: 'GCP', category: 'DEVOPS' },
  'google cloud': { canonical: 'GCP', category: 'DEVOPS' },

  'azure': { canonical: 'Azure', category: 'DEVOPS' },
  'microsoft azure': { canonical: 'Azure', category: 'DEVOPS' },

  'ci/cd': { canonical: 'CI/CD', category: 'DEVOPS' },
  'cicd': { canonical: 'CI/CD', category: 'DEVOPS' },
  'github actions': { canonical: 'GitHub Actions', category: 'DEVOPS' },
  'linux': { canonical: 'Linux', category: 'DEVOPS' },
  'terraform': { canonical: 'Terraform', category: 'DEVOPS' },

  // Messaging & Architecture
  'kafka': { canonical: 'Apache Kafka', category: 'BACKEND' },
  'apache kafka': { canonical: 'Apache Kafka', category: 'BACKEND' },
  'rabbitmq': { canonical: 'RabbitMQ', category: 'BACKEND' },
  'graphql': { canonical: 'GraphQL', category: 'BACKEND' },
  'rest': { canonical: 'REST APIs', category: 'BACKEND' },
  'rest api': { canonical: 'REST APIs', category: 'BACKEND' },
  'rest apis': { canonical: 'REST APIs', category: 'BACKEND' },
  'restful': { canonical: 'REST APIs', category: 'BACKEND' },
  'microservices': { canonical: 'Microservices', category: 'BACKEND' },
  'grpc': { canonical: 'gRPC', category: 'BACKEND' },
  'prisma': { canonical: 'Prisma', category: 'DATABASE' },

  // AI & ML
  'pytorch': { canonical: 'PyTorch', category: 'AI_ML' },
  'tensorflow': { canonical: 'TensorFlow', category: 'AI_ML' },
  'langchain': { canonical: 'LangChain', category: 'AI_ML' },
  'faiss': { canonical: 'FAISS', category: 'AI_ML' },
  'rag': { canonical: 'RAG', category: 'AI_ML' },
  'llm': { canonical: 'LLMs', category: 'AI_ML' },
  'llms': { canonical: 'LLMs', category: 'AI_ML' },

  // Testing & Tools
  'jest': { canonical: 'Jest', category: 'TESTING' },
  'cypress': { canonical: 'Cypress', category: 'TESTING' },
  'git': { canonical: 'Git', category: 'TOOLS' },
  'github': { canonical: 'GitHub', category: 'TOOLS' },
  'gitlab': { canonical: 'GitLab', category: 'TOOLS' },

  // CS Fundamentals
  'system design': { canonical: 'System Design', category: 'CS_FUNDAMENTALS' },
  'dsa': { canonical: 'Data Structures & Algorithms', category: 'CS_FUNDAMENTALS' },
  'data structures': { canonical: 'Data Structures & Algorithms', category: 'CS_FUNDAMENTALS' },
  'algorithms': { canonical: 'Data Structures & Algorithms', category: 'CS_FUNDAMENTALS' },
  'oop': { canonical: 'OOP', category: 'CS_FUNDAMENTALS' },
  'dbms': { canonical: 'DBMS', category: 'CS_FUNDAMENTALS' },
  'os': { canonical: 'Operating Systems', category: 'CS_FUNDAMENTALS' },
  'operating systems': { canonical: 'Operating Systems', category: 'CS_FUNDAMENTALS' },
  'computer networks': { canonical: 'Computer Networks', category: 'CS_FUNDAMENTALS' },
};

export class ResumeNormalizer {
  /**
   * Semantically normalizes academic performance without converting scales or guessing unstated scales.
   */
  static normalizeAcademicScore(inputRaw?: string | null, scoreObj?: Partial<AcademicScore> | null): AcademicScore {
    const raw = (inputRaw || scoreObj?.raw || '').trim();

    if (!raw && !scoreObj?.value && !scoreObj?.grade) {
      return {
        value: null,
        scale: null,
        type: 'UNKNOWN',
        grade: null,
        raw: '',
        evidence: '',
      };
    }

    // Check letter grade (e.g. "Grade: A+", "Final Grade: A+", "Grade A", "A+")
    const gradeAfterKeyword = raw.match(/(?:grade\s*(?:is|:)?\s*)([A-DF][+-]?)/i);
    const standaloneGrade = raw.trim().match(/^[A-DF][+-]?$/i);

    if (!/\d/.test(raw) && (gradeAfterKeyword || standaloneGrade)) {
      const gradeLetter = (gradeAfterKeyword ? gradeAfterKeyword[1] : standaloneGrade![0]).toUpperCase();
      return {
        value: null,
        scale: null,
        type: 'GRADE',
        grade: gradeLetter,
        raw,
        evidence: raw,
      };
    }

    // Check Percentage (e.g. "82%", "82.5 %", "Percentage: 82")
    const percentMatch = raw.match(/(\d+(?:\.\d+)?)\s*%/i) || (raw.toLowerCase().includes('percent') ? raw.match(/(\d+(?:\.\d+)?)/) : null);
    if (percentMatch) {
      return {
        value: parseFloat(percentMatch[1]),
        scale: 100,
        type: 'PERCENTAGE',
        grade: null,
        raw,
        evidence: raw,
      };
    }

    // Check Fraction notation (e.g. "8.1/10", "3.7/4.0", "3.8 / 4", "8.2/10.0")
    const fractionMatch = raw.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (fractionMatch) {
      const val = parseFloat(fractionMatch[1]);
      const scale = parseFloat(fractionMatch[2]);

      let type: AcademicScoreType = 'UNKNOWN';
      if (/cgpa/i.test(raw) || /cumulative/i.test(raw)) {
        type = 'CGPA';
      } else if (/gpa/i.test(raw) || /grade\s+point/i.test(raw)) {
        type = 'GPA';
      } else if (/marks/i.test(raw) || /score/i.test(raw)) {
        type = 'MARKS';
      } else if (scale === 10) {
        type = 'CGPA';
      } else if (scale === 4) {
        type = 'GPA';
      }

      return {
        value: val,
        scale,
        type,
        grade: null,
        raw,
        evidence: raw,
      };
    }

    // Check CGPA prefix without explicit scale (e.g. "CGPA: 8.1", "CGPA 8.4", "C.G.P.A.: 9.2")
    const cgpaMatch = raw.match(/(?:c\.?g\.?p\.?a\.?|cumulative\s+(?:grade\s+point\s+average|gpa))\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
    if (cgpaMatch) {
      return {
        value: parseFloat(cgpaMatch[1]),
        scale: null, // DO NOT assume /10 if not stated
        type: 'CGPA',
        grade: null,
        raw,
        evidence: raw,
      };
    }

    // Check GPA prefix without explicit scale (e.g. "GPA: 3.7", "Grade Point Average: 3.5")
    const gpaMatch = raw.match(/(?:g\.?p\.?a\.?|grade\s+point\s+average)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
    if (gpaMatch) {
      return {
        value: parseFloat(gpaMatch[1]),
        scale: null, // DO NOT assume /4 if not stated
        type: 'GPA',
        grade: null,
        raw,
        evidence: raw,
      };
    }

    // Check Marks prefix (e.g. "Marks: 450", "Score: 85")
    const marksMatch = raw.match(/(?:marks?|score)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
    if (marksMatch) {
      return {
        value: parseFloat(marksMatch[1]),
        scale: null,
        type: 'MARKS',
        grade: null,
        raw,
        evidence: raw,
      };
    }

    // If pre-provided in scoreObj, preserve without inventing scale
    if (scoreObj && scoreObj.value !== undefined && scoreObj.value !== null) {
      return {
        value: scoreObj.value,
        scale: scoreObj.scale ?? null,
        type: scoreObj.type || 'UNKNOWN',
        grade: scoreObj.grade || null,
        raw: raw || String(scoreObj.value),
        evidence: raw || String(scoreObj.value),
      };
    }

    return {
      value: null,
      scale: null,
      type: 'UNKNOWN',
      grade: null,
      raw,
      evidence: raw,
    };
  }

  /**
   * Deterministic Technical Skill Alias Resolver.
   * Maps variants to canonical name while strictly preserving original text and enforcing non-equivalence.
   */
  static resolveSkillAlias(rawName: string): {
    name: string;
    canonicalName: string;
    category: string;
    aliases: string[];
    rawText: string;
  } {
    const trimmed = (rawName || '').trim();
    const key = trimmed.toLowerCase();

    // Check explicit non-equivalence cases first
    if (key === 'java') {
      return {
        name: trimmed,
        canonicalName: 'Java',
        category: 'LANGUAGES',
        aliases: [trimmed],
        rawText: trimmed,
      };
    }
    if (key === 'react native' || key === 'react-native') {
      return {
        name: trimmed,
        canonicalName: 'React Native',
        category: 'FRONTEND',
        aliases: [trimmed],
        rawText: trimmed,
      };
    }

    const match = SKILL_ALIAS_MAP[key];
    if (match) {
      return {
        name: trimmed,
        canonicalName: match.canonical,
        category: match.category,
        aliases: [trimmed],
        rawText: trimmed,
      };
    }

    // Default: keep as is
    return {
      name: trimmed,
      canonicalName: trimmed,
      category: 'GENERAL',
      aliases: [trimmed],
      rawText: trimmed,
    };
  }

  /**
   * Deduplicates equivalent skills while preserving original aliases and merging evidence.
   */
  static deduplicateSkills(skills: ResumeSkill[]): ResumeSkill[] {
    const canonicalMap = new Map<string, ResumeSkill>();

    const sourcePriority: Record<string, number> = {
      'PROJECT': 5,
      'EXPERIENCE': 4,
      'CERTIFICATION': 3,
      'EDUCATION': 2,
      'SKILLS_SECTION': 1,
      'INFERRED': 0,
    };

    for (const skill of skills) {
      const resolved = this.resolveSkillAlias(skill.name);
      const canonicalKey = resolved.canonicalName.toLowerCase();

      if (!canonicalMap.has(canonicalKey)) {
        canonicalMap.set(canonicalKey, {
          ...skill,
          name: skill.name || resolved.canonicalName,
          canonicalName: resolved.canonicalName,
          category: resolved.category !== 'GENERAL' ? resolved.category : skill.category || 'GENERAL',
          aliases: Array.from(new Set([skill.name, resolved.canonicalName, ...(skill.aliases || [])])),
          rawText: skill.rawText || skill.name,
          evidence: Array.from(new Set(skill.evidence || [])),
        });
      } else {
        const existing = canonicalMap.get(canonicalKey)!;

        // Merge aliases
        const mergedAliases = Array.from(
          new Set([...(existing.aliases || []), skill.name, ...(skill.aliases || [])])
        );

        // Merge evidence quotes
        const mergedEvidence = Array.from(
          new Set([...existing.evidence, ...(skill.evidence || [])])
        );

        // Determine if this instance has a higher-priority source
        const existingScore = sourcePriority[existing.source] || 0;
        const newScore = sourcePriority[skill.source] || 0;

        const bestSource = newScore > existingScore ? skill.source : existing.source;
        const bestConfidence = Math.max(existing.confidence, skill.confidence);
        const bestProficiency = (existing.proficiency === 'UNKNOWN' && skill.proficiency !== 'UNKNOWN')
          ? skill.proficiency
          : existing.proficiency;

        canonicalMap.set(canonicalKey, {
          ...existing,
          aliases: mergedAliases,
          evidence: mergedEvidence,
          source: bestSource,
          confidence: bestConfidence,
          proficiency: bestProficiency,
          yearsOfExperience: existing.yearsOfExperience || skill.yearsOfExperience,
        });
      }
    }

    return Array.from(canonicalMap.values());
  }

  /**
   * Normalizes experience date strings into structured DateRange objects with isCurrent detection.
   */
  static normalizeDateRange(rawDuration?: string | null): DateRange {
    const raw = (rawDuration || '').trim();
    if (!raw) {
      return { startDate: null, endDate: null, isCurrent: false, raw: '' };
    }

    const currentKeywords = ['present', 'current', 'till date', 'till now', 'ongoing', 'current role', 'now'];
    const isCurrent = currentKeywords.some((keyword) => raw.toLowerCase().includes(keyword));

    const parts = raw.split(/\s*[-–—to]+\s*/i);
    const startDate = parts[0] ? parts[0].trim() : null;
    let endDate = parts[1] ? parts[1].trim() : null;

    if (isCurrent) {
      endDate = 'Present';
    }

    return {
      startDate,
      endDate,
      isCurrent,
      raw,
    };
  }

  /**
   * Classifies project types deterministically based on surrounding evidence or keywords.
   */
  static classifyProjectType(project: Partial<ResumeProject>): ProjectType {
    const text = `${project.name || ''} ${project.description || ''} ${(project.highlights || []).join(' ')} ${(project.evidence || []).join(' ')}`.toLowerCase();

    if (text.includes('hackathon') || text.includes('hack')) return 'HACKATHON';
    if (text.includes('thesis') || text.includes('research') || text.includes('publication') || text.includes('ieee') || text.includes('arxiv')) return 'RESEARCH';
    if (text.includes('open source') || text.includes('opensource') || (project.githubUrl && text.includes('contributor'))) return 'OPEN_SOURCE';
    if (text.includes('academic') || text.includes('coursework') || text.includes('university project') || text.includes('capstone')) return 'ACADEMIC';
    if (text.includes('freelance') || text.includes('client')) return 'FREELANCE';
    if (text.includes('production') || text.includes('company') || text.includes('internal tool') || text.includes('enterprise')) return 'PROFESSIONAL';
    if (text.includes('personal') || text.includes('side project') || text.includes('hobby')) return 'PERSONAL';

    return 'UNKNOWN';
  }

  /**
   * Full pipeline normalizer: accepts extracted facts from the single LLM call and returns a sanitized canonical resume.
   */
  static normalize(rawFacts: any, rawExtractedText: string): CanonicalNormalizedResume {
    // 1. Profile
    const profile = {
      name: rawFacts.profile?.name || '',
      email: rawFacts.profile?.email || '',
      phone: rawFacts.profile?.phone || null,
      location: rawFacts.profile?.location || null,
      links: Array.isArray(rawFacts.profile?.links) ? rawFacts.profile.links : [],
    };

    // 2. Education with AcademicScore normalization
    const education: ResumeEducation[] = (Array.isArray(rawFacts.education) ? rawFacts.education : []).map((edu: any) => {
      const academicScore = this.normalizeAcademicScore(
        edu.academicScore?.raw || edu.gpa || edu.evidence,
        edu.academicScore
      );

      return {
        degree: edu.degree || 'Degree',
        major: edu.major || '',
        institution: edu.institution || '',
        graduationYear: edu.graduationYear || null,
        gpa: edu.gpa || academicScore.raw || null,
        academicScore,
        honors: Array.isArray(edu.honors) ? edu.honors : [],
        evidence: edu.evidence || '',
      };
    });

    // 3. Experience with DateRange normalization
    const experience: ResumeExperience[] = (Array.isArray(rawFacts.experience) ? rawFacts.experience : []).map((exp: any) => {
      const dateRange = this.normalizeDateRange(exp.duration || exp.dateRange?.raw);
      const isCurrent = exp.current ?? dateRange.isCurrent;

      return {
        company: exp.company || '',
        role: exp.role || '',
        location: exp.location || '',
        duration: exp.duration || dateRange.raw,
        dateRange,
        current: isCurrent,
        highlights: Array.isArray(exp.highlights) ? exp.highlights : [],
        technologies: Array.isArray(exp.technologies) ? exp.technologies : [],
        measurableAchievements: Array.isArray(exp.measurableAchievements) ? exp.measurableAchievements : [],
        evidence: Array.isArray(exp.evidence) ? exp.evidence : [],
      };
    });

    // 4. Skills with Alias Resolution & Deduplication
    const rawSkillsList: ResumeSkill[] = (Array.isArray(rawFacts.skills) ? rawFacts.skills : []).map((skill: any) => {
      const name = typeof skill === 'string' ? skill : skill.name || '';
      const resolved = this.resolveSkillAlias(name);

      return {
        name: resolved.name,
        canonicalName: resolved.canonicalName,
        aliases: [resolved.name],
        category: resolved.category !== 'GENERAL' ? resolved.category : skill.category || 'GENERAL',
        proficiency: skill.proficiency || 'UNKNOWN',
        yearsOfExperience: skill.yearsOfExperience || null,
        evidence: Array.isArray(skill.evidence) ? skill.evidence : skill.evidence ? [skill.evidence] : [],
        evidenceType: skill.evidenceType || (Array.isArray(skill.evidence) && skill.evidence.length > 0 ? 'EXPLICIT' : 'INFERRED'),
        source: skill.source || 'SKILLS_SECTION',
        confidence: typeof skill.confidence === 'number' ? skill.confidence : 0.8,
        rawText: name,
      };
    }).filter((s: any) => Boolean(s.name && s.name.trim()));

    const skills = this.deduplicateSkills(rawSkillsList);

    // 5. Projects with Type Classification
    const projects: ResumeProject[] = (Array.isArray(rawFacts.projects) ? rawFacts.projects : []).map((p: any) => {
      const projectType = p.projectType && p.projectType !== 'UNKNOWN' ? p.projectType : this.classifyProjectType(p);

      return {
        name: p.name || 'Project',
        description: p.description || '',
        role: p.role || '',
        projectType,
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
        highlights: Array.isArray(p.highlights) ? p.highlights : [],
        measurableAchievements: Array.isArray(p.measurableAchievements) ? p.measurableAchievements : [],
        liveUrl: p.liveUrl || null,
        githubUrl: p.githubUrl || null,
        evidence: Array.isArray(p.evidence) ? p.evidence : p.evidence ? [p.evidence] : [],
      };
    });

    // 6. Certifications & Achievements
    const certifications = Array.isArray(rawFacts.certifications) ? rawFacts.certifications : [];
    const achievements = Array.isArray(rawFacts.achievements) ? rawFacts.achievements : [];
    const technologies = Array.from(new Set(skills.map((s: ResumeSkill) => s.canonicalName || s.name)));
    const domains = Array.isArray(rawFacts.domains) ? rawFacts.domains : [];

    return {
      profile,
      summary: rawFacts.summary || '',
      education,
      experience,
      skills,
      projects,
      certifications,
      achievements,
      technologies,
      domains,
    };
  }
}
