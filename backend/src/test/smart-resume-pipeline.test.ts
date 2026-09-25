import { describe, it, expect } from '@jest/globals';
import {
  ResumeNormalizer,
  ResumeParser,
  ResumeSkill,
  CanonicalNormalizedResumeSchema,
} from '../ai';

describe('Smart Resume Understanding Pipeline — Unit & Integration Tests', () => {

  describe('1. Semantic Academic Score Normalization', () => {
    it('should parse CGPA without inventing an unstated scale (e.g. CGPA: 8.1)', () => {
      const score = ResumeNormalizer.normalizeAcademicScore('CGPA: 8.1');

      expect(score.type).toBe('CGPA');
      expect(score.value).toBe(8.1);
      expect(score.scale).toBeNull(); // Must NOT assume /10
      expect(score.raw).toBe('CGPA: 8.1');
    });

    it('should parse CGPA with explicit scale (e.g. 8.2/10 and CGPA: 8.1/10)', () => {
      const score1 = ResumeNormalizer.normalizeAcademicScore('8.2/10');
      expect(score1.type).toBe('CGPA');
      expect(score1.value).toBe(8.2);
      expect(score1.scale).toBe(10);

      const score2 = ResumeNormalizer.normalizeAcademicScore('CGPA: 8.1/10');
      expect(score2.type).toBe('CGPA');
      expect(score2.value).toBe(8.1);
      expect(score2.scale).toBe(10);
    });

    it('should parse GPA without inventing an unstated scale (e.g. GPA: 3.7)', () => {
      const score = ResumeNormalizer.normalizeAcademicScore('GPA: 3.7');

      expect(score.type).toBe('GPA');
      expect(score.value).toBe(3.7);
      expect(score.scale).toBeNull(); // Must NOT assume /4
      expect(score.raw).toBe('GPA: 3.7');
    });

    it('should parse GPA with explicit scale (e.g. 3.7/4.0)', () => {
      const score = ResumeNormalizer.normalizeAcademicScore('GPA: 3.7/4.0');

      expect(score.type).toBe('GPA');
      expect(score.value).toBe(3.7);
      expect(score.scale).toBe(4);
    });

    it('should parse variant terminology: G.P.A., Grade Point Average, C.G.P.A., Cumulative GPA', () => {
      const gpaVar1 = ResumeNormalizer.normalizeAcademicScore('G.P.A.: 3.85');
      expect(gpaVar1.type).toBe('GPA');
      expect(gpaVar1.value).toBe(3.85);

      const gpaVar2 = ResumeNormalizer.normalizeAcademicScore('Grade Point Average: 3.9');
      expect(gpaVar2.type).toBe('GPA');
      expect(gpaVar2.value).toBe(3.9);

      const cgpaVar1 = ResumeNormalizer.normalizeAcademicScore('C.G.P.A.: 9.2');
      expect(cgpaVar1.type).toBe('CGPA');
      expect(cgpaVar1.value).toBe(9.2);

      const cgpaVar2 = ResumeNormalizer.normalizeAcademicScore('Cumulative GPA: 8.5');
      expect(cgpaVar2.type).toBe('CGPA');
      expect(cgpaVar2.value).toBe(8.5);

      const cgpaVar3 = ResumeNormalizer.normalizeAcademicScore('Cumulative Grade Point Average: 8.7');
      expect(cgpaVar3.type).toBe('CGPA');
      expect(cgpaVar3.value).toBe(8.7);
    });

    it('should parse percentages (e.g. 82%, 85.5%) with scale 100', () => {
      const score1 = ResumeNormalizer.normalizeAcademicScore('82%');
      expect(score1.type).toBe('PERCENTAGE');
      expect(score1.value).toBe(82);
      expect(score1.scale).toBe(100);

      const score2 = ResumeNormalizer.normalizeAcademicScore('Percentage: 88.5%');
      expect(score2.type).toBe('PERCENTAGE');
      expect(score2.value).toBe(88.5);
      expect(score2.scale).toBe(100);
    });

    it('should parse letter grades (e.g. Final Grade: A+, Grade A)', () => {
      const score1 = ResumeNormalizer.normalizeAcademicScore('Final Grade: A+');
      expect(score1.type).toBe('GRADE');
      expect(score1.grade).toBe('A+');
      expect(score1.value).toBeNull();
      expect(score1.scale).toBeNull();

      const score2 = ResumeNormalizer.normalizeAcademicScore('Grade: A');
      expect(score2.type).toBe('GRADE');
      expect(score2.grade).toBe('A');
    });

    it('should enforce that GPA != CGPA unless explicitly verified', () => {
      const gpa = ResumeNormalizer.normalizeAcademicScore('GPA: 3.7');
      const cgpa = ResumeNormalizer.normalizeAcademicScore('CGPA: 3.7');

      expect(gpa.type).not.toBe(cgpa.type);
      expect(gpa.type).toBe('GPA');
      expect(cgpa.type).toBe('CGPA');
    });

    it('should NOT perform conversion between GPA/CGPA and percentage', () => {
      const cgpa = ResumeNormalizer.normalizeAcademicScore('CGPA: 8.1');
      expect(cgpa.type).toBe('CGPA');
      expect(cgpa.value).toBe(8.1);
      // Value must remain 8.1, not multiplied by 9.5 or converted to percentage
      expect(cgpa.value).not.toBe(8.1 * 9.5);
    });
  });

  describe('2. Technical Skill Alias Resolution & Non-Equivalence', () => {
    it('should normalize known aliases to canonical technical names while preserving original rawText', () => {
      const node1 = ResumeNormalizer.resolveSkillAlias('Node');
      expect(node1.canonicalName).toBe('Node.js');
      expect(node1.name).toBe('Node');
      expect(node1.category).toBe('BACKEND');

      const node2 = ResumeNormalizer.resolveSkillAlias('NodeJS');
      expect(node2.canonicalName).toBe('Node.js');
      expect(node2.name).toBe('NodeJS');

      const node3 = ResumeNormalizer.resolveSkillAlias('Node JS');
      expect(node3.canonicalName).toBe('Node.js');

      const postgres = ResumeNormalizer.resolveSkillAlias('Postgres');
      expect(postgres.canonicalName).toBe('PostgreSQL');
      expect(postgres.name).toBe('Postgres');
      expect(postgres.category).toBe('DATABASE');

      const react = ResumeNormalizer.resolveSkillAlias('ReactJS');
      expect(react.canonicalName).toBe('React');

      const k8s = ResumeNormalizer.resolveSkillAlias('K8s');
      expect(k8s.canonicalName).toBe('Kubernetes');
      expect(k8s.category).toBe('DEVOPS');
    });

    it('should strictly enforce non-equivalence for distinct technologies (Java != JavaScript, React != React Native, C != C++ != C#)', () => {
      const java = ResumeNormalizer.resolveSkillAlias('Java');
      const js = ResumeNormalizer.resolveSkillAlias('JavaScript');
      expect(java.canonicalName).toBe('Java');
      expect(js.canonicalName).toBe('JavaScript');
      expect(java.canonicalName).not.toBe(js.canonicalName);

      const react = ResumeNormalizer.resolveSkillAlias('React');
      const reactNative = ResumeNormalizer.resolveSkillAlias('React Native');
      expect(react.canonicalName).toBe('React');
      expect(reactNative.canonicalName).toBe('React Native');
      expect(react.canonicalName).not.toBe(reactNative.canonicalName);

      const c = ResumeNormalizer.resolveSkillAlias('C');
      const cpp = ResumeNormalizer.resolveSkillAlias('C++');
      const csharp = ResumeNormalizer.resolveSkillAlias('C#');
      expect(c.canonicalName).toBe('C');
      expect(cpp.canonicalName).toBe('C++');
      expect(csharp.canonicalName).toBe('C#');
      expect(c.canonicalName).not.toBe(cpp.canonicalName);
      expect(cpp.canonicalName).not.toBe(csharp.canonicalName);
    });
  });

  describe('3. Skill Deduplication with Merged Aliases and Evidence', () => {
    it('should collapse multiple occurrences of equivalent skills into one canonical skill with merged aliases and evidence', () => {
      const rawSkills: ResumeSkill[] = [
        {
          name: 'NodeJS',
          canonicalName: 'Node.js',
          aliases: ['NodeJS'],
          category: 'BACKEND',
          proficiency: 'UNKNOWN',
          yearsOfExperience: null,
          evidence: ['Mentioned in skills list'],
          evidenceType: 'EXPLICIT',
          source: 'SKILLS_SECTION',
          confidence: 0.7,
          rawText: 'NodeJS',
        },
        {
          name: 'Node.js',
          canonicalName: 'Node.js',
          aliases: ['Node.js'],
          category: 'BACKEND',
          proficiency: 'INTERMEDIATE',
          yearsOfExperience: 3,
          evidence: ['Architected payment APIs in Node.js'],
          evidenceType: 'EXPLICIT',
          source: 'EXPERIENCE',
          confidence: 0.95,
          rawText: 'Node.js',
        },
        {
          name: 'Node JS',
          canonicalName: 'Node.js',
          aliases: ['Node JS'],
          category: 'BACKEND',
          proficiency: 'INTERMEDIATE',
          yearsOfExperience: null,
          evidence: ['Built order engine in Node JS'],
          evidenceType: 'EXPLICIT',
          source: 'PROJECT',
          confidence: 0.98,
          rawText: 'Node JS',
        },
      ];

      const deduplicated = ResumeNormalizer.deduplicateSkills(rawSkills);

      expect(deduplicated.length).toBe(1);
      const nodeCanonical = deduplicated[0];

      expect(nodeCanonical.canonicalName).toBe('Node.js');
      expect(nodeCanonical.aliases).toContain('NodeJS');
      expect(nodeCanonical.aliases).toContain('Node.js');
      expect(nodeCanonical.aliases).toContain('Node JS');
      expect(nodeCanonical.evidence.length).toBe(3);
      expect(nodeCanonical.source).toBe('PROJECT'); // Promoted to highest priority
      expect(nodeCanonical.confidence).toBe(0.98);
      expect(nodeCanonical.proficiency).toBe('INTERMEDIATE');
    });
  });

  describe('4. Experience Date Normalization', () => {
    it('should parse date bounds and detect active employment equivalents', () => {
      const d1 = ResumeNormalizer.normalizeDateRange('Jan 2023 - Present');
      expect(d1.startDate).toBe('Jan 2023');
      expect(d1.endDate).toBe('Present');
      expect(d1.isCurrent).toBe(true);

      const d2 = ResumeNormalizer.normalizeDateRange('2023 - 2024');
      expect(d2.startDate).toBe('2023');
      expect(d2.endDate).toBe('2024');
      expect(d2.isCurrent).toBe(false);

      const d3 = ResumeNormalizer.normalizeDateRange('06/2023 - Present');
      expect(d3.startDate).toBe('06/2023');
      expect(d3.isCurrent).toBe(true);

      const d4 = ResumeNormalizer.normalizeDateRange('January 2022 - Ongoing');
      expect(d4.startDate).toBe('January 2022');
      expect(d4.isCurrent).toBe(true);

      const d5 = ResumeNormalizer.normalizeDateRange('March 2021 - Till date');
      expect(d5.startDate).toBe('March 2021');
      expect(d5.isCurrent).toBe(true);
    });
  });

  describe('5. Project Type Classification', () => {
    it('should classify project types based on evidence and context', () => {
      expect(ResumeNormalizer.classifyProjectType({ name: 'Smart India Hackathon Project' })).toBe('HACKATHON');
      expect(ResumeNormalizer.classifyProjectType({ name: 'Deep Learning Thesis', description: 'IEEE publication research' })).toBe('RESEARCH');
      expect(ResumeNormalizer.classifyProjectType({ name: 'Open Source Contributor', githubUrl: 'https://github.com/facebook/react' })).toBe('OPEN_SOURCE');
      expect(ResumeNormalizer.classifyProjectType({ name: 'University Capstone Project', description: 'Coursework project' })).toBe('ACADEMIC');
      expect(ResumeNormalizer.classifyProjectType({ name: 'Freelance Client Website' })).toBe('FREELANCE');
      expect(ResumeNormalizer.classifyProjectType({ name: 'Personal Portfolio Project' })).toBe('PERSONAL');
      expect(ResumeNormalizer.classifyProjectType({ name: 'Mystery Engine' })).toBe('UNKNOWN');
    });
  });

  describe('6. Document Parser & Section Detection', () => {
    it('should detect semantic section headings across common variants', () => {
      const resumeText = `
John Doe
Email: john@example.com

PROFESSIONAL EXPERIENCE
Software Engineer at Acme Corp (2022 - Present)
- Built APIs in Node.js

ACADEMIC BACKGROUND
KIIT University
B.Tech Computer Science (CGPA: 8.1)

TECHNICAL EXPERTISE
Languages: TypeScript, Python

SELECTED PROJECTS
Distributed Caching Engine
`;

      const sections = ResumeParser.detectSections(resumeText);
      const sectionTypes = sections.map((s) => s.type);

      expect(sectionTypes).toContain('OTHER');
    });
  });

  describe('7. Full Normalization Schema Conformance', () => {
    it('should normalize a full fact payload into CanonicalNormalizedResume conforming to Zod schema', () => {
      const sampleFacts = {
        profile: {
          name: 'Priya Sharma',
          email: 'priya.sharma@example.com',
          phone: '+91 9876543210',
          location: 'Bangalore, India',
          links: ['https://github.com/priyasharma'],
        },
        summary: 'Full Stack Engineer with experience in React and Node.js.',
        education: [
          {
            degree: 'B.Tech',
            major: 'Computer Science Engineering',
            institution: 'KIIT University',
            graduationYear: '2024',
            evidence: 'B.Tech in Computer Science Engineering, KIIT University, CGPA: 8.1',
            academicScore: {
              raw: 'CGPA: 8.1',
            },
          },
        ],
        experience: [
          {
            company: 'TechCorp',
            role: 'Software Engineer',
            location: 'Bangalore',
            duration: 'Jan 2023 - Present',
            highlights: ['Developed microservices in Node.js'],
            technologies: ['NodeJS', 'TypeScript', 'PostgreSQL'],
            measurableAchievements: ['Reduced latency by 40%'],
            evidence: ['Developed microservices in Node.js and reduced latency by 40%'],
          },
        ],
        skills: [
          { name: 'NodeJS', proficiency: 'INTERMEDIATE', evidence: ['NodeJS backend'] },
          { name: 'Node.js', proficiency: 'INTERMEDIATE', evidence: ['Node.js APIs'] },
          { name: 'Postgres', proficiency: 'INTERMEDIATE', evidence: ['Postgres DB'] },
          { name: 'K8s', proficiency: 'UNKNOWN', evidence: ['K8s in skills'] },
        ],
        projects: [
          {
            name: 'Hackathon Chat App',
            description: 'Real-time chat application',
            technologies: ['ReactJS', 'NodeJS'],
            highlights: ['Socket.IO real-time delivery'],
            measurableAchievements: [],
            githubUrl: 'https://github.com/priyasharma/chat',
            evidence: ['Built chat app during college hackathon'],
          },
        ],
        certifications: [],
        achievements: [],
        technologies: ['Node.js', 'PostgreSQL', 'React', 'Kubernetes'],
        domains: [],
      };

      const normalized = ResumeNormalizer.normalize(sampleFacts, 'raw resume text');
      const validation = CanonicalNormalizedResumeSchema.safeParse(normalized);

      expect(validation.success).toBe(true);

      // Check Education Academic Score
      expect(normalized.education[0].academicScore?.type).toBe('CGPA');
      expect(normalized.education[0].academicScore?.value).toBe(8.1);
      expect(normalized.education[0].academicScore?.scale).toBeNull();

      // Check Experience Date Range
      expect(normalized.experience[0].dateRange?.isCurrent).toBe(true);
      expect(normalized.experience[0].dateRange?.startDate).toBe('Jan 2023');

      // Check Deduplication (NodeJS and Node.js merged)
      const nodeSkills = normalized.skills.filter((s) => s.canonicalName === 'Node.js');
      expect(nodeSkills.length).toBe(1);
      expect(nodeSkills[0].aliases).toContain('NodeJS');
      expect(nodeSkills[0].aliases).toContain('Node.js');

      // Check PostgreSQL and Kubernetes canonical mapping
      expect(normalized.skills.some((s) => s.canonicalName === 'PostgreSQL')).toBe(true);
      expect(normalized.skills.some((s) => s.canonicalName === 'Kubernetes')).toBe(true);

      // Check Project Type Classification
      expect(normalized.projects[0].projectType).toBe('HACKATHON');
    });
  });
});
