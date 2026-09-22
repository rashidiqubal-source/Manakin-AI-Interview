import {
  CanonicalNormalizedJD,
  InterviewBlueprint,
  InterviewBlueprintSchema,
  InterviewDimension,
} from './jd-schema';
import { PromptRunner } from '../core/prompt-runner';
import {
  JD_ANALYZER_SYSTEM_PROMPT,
  JD_ANALYZER_RULES,
} from './jd-prompts';

export class JDAnalyzer {
  /**
   * Deterministic test area lookup for common skills and technologies.
   */
  static getDefaultTestAreas(skill: string): { testAreas: string[]; sampleProbes: string[] } {
    const s = skill.toLowerCase();

    if (s.includes('node')) {
      return {
        testAreas: ['Event loop & asynchronous patterns', 'Stream & buffer handling', 'API design & middleware', 'Error handling & memory leaks'],
        sampleProbes: ['How do you handle unhandled promise rejections and process crashes in production Node.js services?'],
      };
    }
    if (s.includes('typescript')) {
      return {
        testAreas: ['Generics & utility types', 'Strict type safety & unknown vs any', 'Discriminated unions', 'Type narrowing & guards'],
        sampleProbes: ['How do you model complex domain entities using discriminated unions rather than multiple optional fields?'],
      };
    }
    if (s.includes('postgres') || s.includes('sql')) {
      return {
        testAreas: ['Schema design & foreign keys', 'Index types (B-tree, GIN) & query planning', 'ACID transactions & isolation levels', 'Query optimization & connection pooling'],
        sampleProbes: ['How would you troubleshoot a query that suddenly degraded from 15ms to 12s under peak load?'],
      };
    }
    if (s.includes('redis')) {
      return {
        testAreas: ['Caching strategies (Cache-aside, Write-through)', 'TTL & key eviction policies', 'Cache invalidation & stampede mitigation', 'Pub/Sub & distributed locking'],
        sampleProbes: ['What strategy do you use to prevent cache thundering herd / stampedes when hot keys expire?'],
      };
    }
    if (s.includes('system design') || s.includes('distributed')) {
      return {
        testAreas: ['Horizontal scalability & load balancing', 'High availability & failover', 'Data partitioning & sharding', 'Microservices vs monolithic trade-offs'],
        sampleProbes: ['Walk through designing a notification dispatch system capable of sending 50,000 requests/sec with idempotency.'],
      };
    }
    if (s.includes('docker') || s.includes('container')) {
      return {
        testAreas: ['Multi-stage builds', 'Image layer optimization & caching', 'Container networking', 'Security & non-root user runtime'],
        sampleProbes: ['How do you optimize container images for both build speed in CI and minimal production attack surface?'],
      };
    }
    if (s.includes('react')) {
      return {
        testAreas: ['Hook lifecycle & dependency arrays', 'State management & store patterns', 'Rendering performance & memoization', 'Server-side rendering & hydration'],
        sampleProbes: ['How do you diagnose and resolve unnecessary re-render cascades in deeply nested component trees?'],
      };
    }

    return {
      testAreas: ['Core fundamentals & standard conventions', 'Real-world implementation decisions', 'Error handling & edge cases', 'Performance optimization'],
      sampleProbes: [`What was the most challenging bug or performance bottleneck you solved involving ${skill}?`],
    };
  }

  /**
   * Generates a deterministic fallback blueprint
   */
  private static generateFallbackBlueprint(jd: CanonicalNormalizedJD): InterviewBlueprint {
    const dimensions: InterviewDimension[] = [];

    // Map required skills
    for (const skill of jd.requiredSkills) {
      const defaults = this.getDefaultTestAreas(skill.name);
      dimensions.push({
        skill: skill.name,
        category: skill.category,
        importance: 'MUST_HAVE',
        testAreas: defaults.testAreas,
        sampleProbes: defaults.sampleProbes,
      });
    }

    // Map preferred skills (up to 3)
    for (const skill of jd.preferredSkills.slice(0, 3)) {
      const defaults = this.getDefaultTestAreas(skill.name);
      dimensions.push({
        skill: skill.name,
        category: skill.category,
        importance: 'PREFERRED',
        testAreas: defaults.testAreas,
        sampleProbes: defaults.sampleProbes,
      });
    }

    // System design dimension if required
    if (jd.interviewRequirements.systemDesign && !dimensions.some((d) => d.skill.toLowerCase().includes('design'))) {
      const defaults = this.getDefaultTestAreas('System Design');
      dimensions.push({
        skill: 'System Design',
        category: 'ARCHITECTURE',
        importance: 'MUST_HAVE',
        testAreas: defaults.testAreas,
        sampleProbes: defaults.sampleProbes,
      });
    }

    return {
      roleTitle: jd.job.title,
      roleOverview: jd.role.summary || `Interview assessment blueprint for ${jd.job.title}`,
      interviewDimensions: dimensions,
      recommendedFocusAreas: dimensions.slice(0, 4).map((d) => d.skill),
      codingRequired: jd.interviewRequirements.coding,
      systemDesignRequired: jd.interviewRequirements.systemDesign,
      behavioralRequired: jd.interviewRequirements.behavioral,
      domainFocus: jd.experience.industryExperience,
    };
  }

  /**
   * Analyzes a Canonical Normalized JD to produce an enriched Interview Blueprint.
   */
  static async generateInterviewBlueprint(jd: CanonicalNormalizedJD): Promise<{
    blueprint: InterviewBlueprint;
    enrichedJD: CanonicalNormalizedJD;
  }> {
    const schemaDesc = `{
  "roleTitle": "${jd.job.title}",
  "roleOverview": "1-2 sentence overview of interview goals",
  "interviewDimensions": [
    {
      "skill": "Skill Name",
      "category": "TECHNICAL | ARCHITECTURE | DATABASE | BEHAVIORAL",
      "importance": "MUST_HAVE | PREFERRED",
      "testAreas": ["Test area 1", "Test area 2", "Test area 3"],
      "sampleProbes": ["Deep probing question"]
    }
  ],
  "recommendedFocusAreas": ["Key area 1", "Key area 2"],
  "codingRequired": true,
  "systemDesignRequired": ${jd.interviewRequirements.systemDesign},
  "behavioralRequired": true,
  "domainFocus": ${JSON.stringify(jd.experience.industryExperience)}
}`;

    const blueprint = await PromptRunner.execute(
      {
        name: 'JDInterviewBlueprintGenerator',
        systemInstruction: JD_ANALYZER_SYSTEM_PROMPT,
        rules: JD_ANALYZER_RULES,
        outputSchema: InterviewBlueprintSchema,
        schemaDescription: schemaDesc,
        fallbackGenerator: (input) => this.generateFallbackBlueprint(input),
      },
      jd,
      (inp) => `
Analyze this Normalized Job Description and synthesize the Interview Blueprint:

Job Title: ${inp.job.title} (Level: ${inp.job.level}, Dept: ${inp.job.department})
Summary: ${inp.role.summary}

Required Skills:
${inp.requiredSkills.map((s) => `- ${s.name} (${s.category}, ${s.proficiency})`).join('\n')}

Preferred Skills:
${inp.preferredSkills.map((s) => `- ${s.name} (${s.category})`).join('\n')}

Responsibilities:
${inp.responsibilities.map((r) => `- ${r.description}`).join('\n')}

Industry / Domain:
${inp.experience.industryExperience.join(', ') || 'General Software'}

Generate the comprehensive InterviewBlueprint JSON now.
`
    );

    // Merge generated dimensions back into the normalized JD representation
    const enrichedJD: CanonicalNormalizedJD = {
      ...jd,
      interviewDimensions: blueprint.interviewDimensions,
    };

    return { blueprint, enrichedJD };
  }
}
