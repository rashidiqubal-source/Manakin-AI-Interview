import {
  EvidenceGraph,
  EvidenceNode,
  EvidenceEdge,
  ProvenanceRecord,
  EvidenceSourceType,
} from './evidence-types';

export class EvidenceGraphBuilder {
  /**
   * Initializes a new Evidence Graph from JD Requirements, Resume Claims, and optional GitHub data.
   */
  static buildInitialGraph(params: {
    normalizedJD: any;
    normalizedResume?: any;
    githubAnalysis?: any;
  }): EvidenceGraph {
    const nodes: EvidenceNode[] = [];
    const edges: EvidenceEdge[] = [];
    const now = new Date().toISOString();

    const { normalizedJD, normalizedResume, githubAnalysis } = params;

    // 1. Add JD Requirement Nodes
    if (normalizedJD?.requiredSkills && Array.isArray(normalizedJD.requiredSkills)) {
      normalizedJD.requiredSkills.forEach((reqSkill: any, index: number) => {
        const skillName = typeof reqSkill === 'string' ? reqSkill : reqSkill.name;
        const importance = typeof reqSkill === 'object' ? reqSkill.importance : 'MUST_HAVE';
        const nodeId = `jd-skill-${index}-${skillName.toLowerCase().replace(/\s+/g, '-')}`;

        const provenance: ProvenanceRecord = {
          id: `prov-${nodeId}`,
          sourceType: 'JD',
          sourceId: normalizedJD.job?.title || 'JD Document',
          referenceExcerpt: `Required skill: ${skillName} (${importance})`,
          competency: skillName,
          conclusion: `Mandatory recruitment requirement`,
          confidence: 1.0,
          createdAt: now,
        };

        nodes.push({
          id: nodeId,
          label: `JD: ${skillName} (${importance})`,
          type: 'JD_REQUIREMENT',
          sourceType: 'JD',
          metadata: { skillName, importance, category: reqSkill.category || 'TECHNICAL' },
          provenance,
        });
      });
    }

    // 2. Add Resume Claim Nodes & Link to JD Requirements
    if (normalizedResume?.skills && Array.isArray(normalizedResume.skills)) {
      normalizedResume.skills.forEach((resSkill: any, index: number) => {
        const skillName = resSkill.name || resSkill.canonicalName;
        const evidenceQuote = (resSkill.evidence && resSkill.evidence[0]) || `Stated in skills: ${skillName}`;
        const nodeId = `resume-skill-${index}-${skillName.toLowerCase().replace(/\s+/g, '-')}`;

        const provenance: ProvenanceRecord = {
          id: `prov-${nodeId}`,
          sourceType: 'RESUME',
          sourceId: normalizedResume.profile?.name || 'Resume Document',
          referenceExcerpt: evidenceQuote,
          competency: skillName,
          conclusion: `Resume documented experience (${resSkill.source || 'SKILLS_SECTION'})`,
          confidence: resSkill.confidence || 0.8,
          createdAt: now,
        };

        nodes.push({
          id: nodeId,
          label: `Resume: ${skillName}`,
          type: 'RESUME_CLAIM',
          sourceType: 'RESUME',
          metadata: { skillName, proficiency: resSkill.proficiency, source: resSkill.source },
          provenance,
        });

        // Link to matching JD requirement node if present
        const matchingJdNode = nodes.find(
          (n) => n.type === 'JD_REQUIREMENT' && n.metadata?.skillName.toLowerCase() === skillName.toLowerCase()
        );
        if (matchingJdNode) {
          edges.push({
            id: `edge-${matchingJdNode.id}-${nodeId}`,
            source: matchingJdNode.id,
            target: nodeId,
            relationship: 'CORROBORATES',
          });
        }
      });
    }

    // 3. Add GitHub Evidence Nodes & Link to Skills
    if (githubAnalysis?.analyzedRepos && Array.isArray(githubAnalysis.analyzedRepos)) {
      githubAnalysis.analyzedRepos.forEach((repo: any, index: number) => {
        const repoNodeId = `github-repo-${index}-${repo.repoName.toLowerCase().replace(/\s+/g, '-')}`;

        nodes.push({
          id: repoNodeId,
          label: `GitHub: ${repo.repoName}`,
          type: 'GITHUB_EVIDENCE',
          sourceType: 'GITHUB',
          metadata: { repoName: repo.repoName, technologies: repo.relevantTechnologies, description: repo.description },
          provenance: {
            id: `prov-${repoNodeId}`,
            sourceType: 'GITHUB',
            sourceId: repo.repoName,
            referenceExcerpt: repo.readmeSummary || repo.description || `Public repository ${repo.repoName}`,
            competency: repo.relevantTechnologies.join(', '),
            conclusion: `Public repository code evidence`,
            confidence: 0.9,
            createdAt: now,
          },
        });

        // Link GitHub node to matching Resume claims & JD requirements
        repo.relevantTechnologies?.forEach((tech: string) => {
          const matchingResumeNode = nodes.find(
            (n) => n.type === 'RESUME_CLAIM' && n.metadata?.skillName.toLowerCase() === tech.toLowerCase()
          );
          if (matchingResumeNode) {
            edges.push({
              id: `edge-${matchingResumeNode.id}-${repoNodeId}`,
              source: matchingResumeNode.id,
              target: repoNodeId,
              relationship: 'CROSS_CORROBORATES',
            });
          }
        });
      });
    }

    return { nodes, edges };
  }

  /**
   * Appends an interview turn (Question + Answer + Micro Evaluation) into the graph with full provenance.
   */
  static addInterviewTurn(
    graph: EvidenceGraph,
    turn: {
      questionId: string;
      questionText: string;
      competency: string;
      sourceType: EvidenceSourceType;
      answerText: string;
      microEval: {
        clarity?: number;
        warmth?: number;
        simplicity?: number;
        patience?: number;
        fluency?: number;
        engagement?: number;
        technicalDepth?: string;
        reasoning?: string;
      };
    }
  ): EvidenceGraph {
    const now = new Date().toISOString();
    const qNodeId = `question-${turn.questionId}`;
    const aNodeId = `answer-${turn.questionId}`;
    const evalNodeId = `eval-${turn.questionId}`;

    // Question Node
    const qNode: EvidenceNode = {
      id: qNodeId,
      label: `Q: ${turn.questionText.slice(0, 50)}...`,
      type: 'INTERVIEW_QUESTION',
      sourceType: turn.sourceType,
      metadata: { competency: turn.competency, fullText: turn.questionText },
      provenance: {
        id: `prov-${qNodeId}`,
        sourceType: turn.sourceType,
        sourceId: turn.questionId,
        referenceExcerpt: turn.questionText,
        competency: turn.competency,
        conclusion: `Interview probe for ${turn.competency}`,
        confidence: 1.0,
        createdAt: now,
      },
    };

    // Answer Node
    const aNode: EvidenceNode = {
      id: aNodeId,
      label: `Ans: ${turn.answerText.slice(0, 50)}...`,
      type: 'CANDIDATE_ANSWER',
      sourceType: 'ANSWER',
      metadata: { fullText: turn.answerText },
      provenance: {
        id: `prov-${aNodeId}`,
        sourceType: 'ANSWER',
        sourceId: turn.questionId,
        referenceExcerpt: turn.answerText,
        competency: turn.competency,
        conclusion: `Candidate spoken response`,
        confidence: 0.9,
        createdAt: now,
      },
    };

    // Evaluation Node
    const evalNode: EvidenceNode = {
      id: evalNodeId,
      label: `Eval: ${turn.competency} (${turn.microEval.technicalDepth || 'PROBED'})`,
      type: 'EVALUATION',
      sourceType: 'INTERVIEW',
      metadata: turn.microEval,
      provenance: {
        id: `prov-${evalNodeId}`,
        sourceType: 'INTERVIEW',
        sourceId: turn.questionId,
        referenceExcerpt: turn.microEval.reasoning || `Evaluated technical response on ${turn.competency}`,
        competency: turn.competency,
        conclusion: turn.microEval.reasoning || `Response evaluation`,
        confidence: 0.85,
        createdAt: now,
      },
    };

    const newNodes = [...graph.nodes, qNode, aNode, evalNode];
    const newEdges = [
      ...graph.edges,
      { id: `edge-${qNodeId}-${aNodeId}`, source: qNodeId, target: aNodeId, relationship: 'PROBES' },
      { id: `edge-${aNodeId}-${evalNodeId}`, source: aNodeId, target: evalNodeId, relationship: 'EVALUATES' },
    ];

    // Connect to matching JD requirement node if available
    const jdNode = graph.nodes.find(
      (n) => n.type === 'JD_REQUIREMENT' && n.metadata?.skillName.toLowerCase() === turn.competency.toLowerCase()
    );
    if (jdNode) {
      newEdges.push({
        id: `edge-${evalNodeId}-${jdNode.id}`,
        source: evalNodeId,
        target: jdNode.id,
        relationship: 'VERIFIES',
      });
    }

    return { nodes: newNodes, edges: newEdges };
  }
}
