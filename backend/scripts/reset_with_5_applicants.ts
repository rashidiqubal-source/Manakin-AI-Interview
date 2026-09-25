import { prisma } from '../src/config/prisma';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

async function resetWith5Applicants() {
  console.log('=== STARTING DATABASE CLEANUP & 5 APPLICANT PROVISIONING ===');

  // 1. Locate recruiter kunal.srivastava@manakinai.com
  const recruiter = await prisma.user.findFirst({
    where: { email: 'kunal.srivastava@manakinai.com' },
  });

  if (!recruiter) {
    throw new Error('FATAL: kunal.srivastava@manakinai.com not found in database!');
  }

  console.log(`✓ Recruiter found: ${recruiter.name} <${recruiter.email}> (ID: ${recruiter.id})`);

  // 2. Locate ManakinAI Job Description
  const jd = await prisma.jobDescription.findFirst({
    where: { recruiterId: recruiter.id },
  });

  if (!jd) {
    throw new Error('FATAL: Job Description for ManakinAI not found in database!');
  }

  console.log(`✓ Job Description found: "${jd.title}" (ID: ${jd.id})`);

  // 3. Purge all telemetry, messages, proctoring events, and sessions
  const deletedMessages = await prisma.message.deleteMany();
  console.log(`✓ Purged ${deletedMessages.count} messages.`);

  const deletedEvents = await prisma.detectionEvent.deleteMany();
  console.log(`✓ Purged ${deletedEvents.count} proctoring detection events.`);

  const deletedInvitations = await prisma.interviewInvitation.deleteMany();
  console.log(`✓ Purged ${deletedInvitations.count} old invitations.`);

  const deletedSessions = await prisma.interviewSession.deleteMany();
  console.log(`✓ Purged ${deletedSessions.count} old interview sessions.`);

  const deletedResumes = await prisma.applicantResume.deleteMany();
  console.log(`✓ Purged ${deletedResumes.count} old resumes.`);

  // 4. Delete all other JDs except the ManakinAI JD
  const deletedJDs = await prisma.jobDescription.deleteMany({
    where: { id: { not: jd.id } },
  });
  console.log(`✓ Deleted ${deletedJDs.count} non-ManakinAI job descriptions.`);

  // 5. Delete all other users except the recruiter
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { not: recruiter.id } },
  });
  console.log(`✓ Deleted ${deletedUsers.count} other users.`);

  // 6. Define 5 diverse, high-quality test applicants with relevant full-stack skills and resumes
  const applicantSeeds = [
    {
      name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      githubUrl: "https://github.com/aarav-sharma-dev",
      skills: ["TypeScript", "Next.js", "Node.js", "PostgreSQL", "Redis"],
      projects: ["Distributed Task Queue with Redis & Node", "Full-Stack SaaS Analytics Dashboard with Next.js"],
      summary: "Full stack developer intern candidate with 2 production-grade projects in Next.js, Node.js, and Redis caching.",
    },
    {
      name: "Priya Patel",
      email: "priya.patel@example.com",
      githubUrl: "https://github.com/priya-patel-code",
      skills: ["TypeScript", "React", "Express.js", "PostgreSQL", "Docker"],
      projects: ["Secure JWT Authentication & Role-Based RBAC Gateway", "PostgreSQL Query Performance Tuning Workbench"],
      summary: "Backend-focused developer with strong grounding in relational database schemas, REST API security, and Docker.",
    },
    {
      name: "Rohan Gupta",
      email: "rohan.gupta@example.com",
      githubUrl: "https://github.com/rohan-gupta-fullstack",
      skills: ["JavaScript", "TypeScript", "Node.js", "React", "MongoDB", "PostgreSQL"],
      projects: ["E-commerce Microservices Engine with Event-Driven Architecture", "Real-time Collaborative Whiteboard via WebSockets"],
      summary: "Full-stack engineer with hands-on experience in real-time WebSockets, microservices communication, and modern frontend hooks.",
    },
    {
      name: "Ananya Iyer",
      email: "ananya.iyer@example.com",
      githubUrl: "https://github.com/ananya-iyer-tech",
      skills: ["TypeScript", "React 19", "Next.js 15", "Tailwind CSS", "Prisma ORM"],
      projects: ["Modern AI-Powered Note Summarizer with Server Actions", "High-Throughput RESTful API with Zod Validation & Prisma"],
      summary: "Frontend and full-stack specialist proficient with Next.js App Router, Prisma ORM data modeling, and clean UI/UX components.",
    },
    {
      name: "Vikram Malhotra",
      email: "vikram.malhotra@example.com",
      githubUrl: "https://github.com/vikram-malhotra-systems",
      skills: ["Go", "TypeScript", "Node.js", "PostgreSQL", "Kafka", "Docker"],
      projects: ["High-Concurrency Rate Limiter Middleware", "Distributed Log Aggregation Pipeline"],
      summary: "Systems-oriented full stack intern candidate with strong algorithms, concurrency paradigms, and distributed systems fundamentals.",
    },
  ];

  console.log('\n--- CREATING 5 TEST APPLICANTS WITH INVITATIONS & RESUMES ---');

  const createdApplicantEntries = [];

  for (let i = 0; i < applicantSeeds.length; i++) {
    const seed = applicantSeeds[i];

    // Create User record
    const userRecord = await prisma.user.create({
      data: {
        name: seed.name,
        email: seed.email,
        role: 'APPLICANT',
        emailVerified: true,
      },
    });

    // Create normalized ApplicantResume record
    const resumeRecord = await prisma.applicantResume.create({
      data: {
        applicantId: userRecord.id,
        fileName: `${seed.name.toLowerCase().replace(/\s+/g, '_')}_resume.pdf`,
        rawContent: `Resume for ${seed.name}\nEmail: ${seed.email}\nGitHub: ${seed.githubUrl}\nSkills: ${seed.skills.join(', ')}\nSummary: ${seed.summary}\nProjects:\n${seed.projects.map(p => `- ${p}`).join('\n')}`,
        aiSummary: seed.summary,
        aiAnalysis: {
          candidateName: seed.name,
          email: seed.email,
          skills: seed.skills,
          projects: seed.projects,
          strengths: ["Clean Code Architecture", "REST API Development", "Database Indexing & Schema Design"],
        },
        normalizedResume: {
          candidateName: seed.name,
          email: seed.email,
          skills: seed.skills.map(s => ({ name: s, level: "INTERMEDIATE" })),
          projects: seed.projects.map(p => ({ title: p, description: `Production implementation of ${p}` })),
        },
      },
    });

    // Generate unique invitation token
    const token = crypto.randomUUID();

    // Create InterviewInvitation record linked to ManakinAI JD & Recruiter
    const invitationRecord = await prisma.interviewInvitation.create({
      data: {
        token,
        jobDescriptionId: jd.id,
        recruiterId: recruiter.id,
        applicantEmail: seed.email,
        applicantId: userRecord.id,
        applicantResumeId: resumeRecord.id,
        githubUrl: seed.githubUrl,
        status: 'PENDING',
      },
    });

    const inviteLink = `http://localhost:3001/invite/${token}`;

    console.log(`[${i + 1}/5] Provisioned: ${seed.name} (${seed.email})`);
    console.log(`      Invite Link: ${inviteLink}`);

    createdApplicantEntries.push({
      number: i + 1,
      name: seed.name,
      email: seed.email,
      githubUrl: seed.githubUrl,
      token,
      inviteLink,
      skills: seed.skills.join(', '),
      projects: seed.projects.join('; '),
    });
  }

  // 7. Write test_applicant_links.txt to the root directory
  const rootDir = path.resolve(__dirname, '../../');
  const txtFilePath = path.join(rootDir, 'test_applicant_links.txt');

  let fileContent = `================================================================================\n`;
  fileContent += `MANAKIN.AI - CANDIDATE TEST INVITATION LINKS\n`;
  fileContent += `Generated: ${new Date().toLocaleString()}\n`;
  fileContent += `================================================================================\n\n`;
  fileContent += `RECRUITER CREDENTIALS:\n`;
  fileContent += `  Email:    kunal.srivastava@manakinai.com\n`;
  fileContent += `  Portal:   http://localhost:3001/recruiter/sign-in\n`;
  fileContent += `  JD:       ${jd.title} (ID: ${jd.id})\n\n`;
  fileContent += `--------------------------------------------------------------------------------\n`;
  fileContent += `5 TEST APPLICANT INVITATION LINKS (Click to test):\n`;
  fileContent += `--------------------------------------------------------------------------------\n\n`;

  createdApplicantEntries.forEach((app) => {
    fileContent += `[APPLICANT ${app.number}] ${app.name}\n`;
    fileContent += `  Email:       ${app.email}\n`;
    fileContent += `  GitHub:      ${app.githubUrl}\n`;
    fileContent += `  Skills:      ${app.skills}\n`;
    fileContent += `  Projects:    ${app.projects}\n`;
    fileContent += `  Status:      PENDING (Ready for test)\n`;
    fileContent += `  Invite Link: ${app.inviteLink}\n`;
    fileContent += `\n`;
  });

  fileContent += `================================================================================\n`;
  fileContent += `TESTING INSTRUCTIONS:\n`;
  fileContent += `1. Open any of the 5 links above in your browser (e.g. http://localhost:3001/invite/...).\n`;
  fileContent += `2. You will enter the Dual Readiness Hub (Resume is pre-attached or you can upload new).\n`;
  fileContent += `3. Verify your camera & mic, then click "Start Interview Now".\n`;
  fileContent += `4. Candidate will see a distraction-free technical interview.\n`;
  fileContent += `5. When finished, candidate will ONLY see "Thank You for Taking the Exam!".\n`;
  fileContent += `6. Log in as kunal.srivastava@manakinai.com at http://localhost:3001/recruiter to inspect the full evaluation dossier!\n`;
  fileContent += `================================================================================\n`;

  fs.writeFileSync(txtFilePath, fileContent, 'utf-8');
  console.log(`\n✓ Saved test links to: ${txtFilePath}`);
  console.log('=== DATABASE RESET & PROVISIONING COMPLETED SUCCESSFULLY ===');
}

resetWith5Applicants()
  .catch((err) => {
    console.error('Fatal error during reset:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
