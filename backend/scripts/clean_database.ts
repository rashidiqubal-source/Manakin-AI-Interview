import { prisma } from '../src/config/prisma';

async function cleanDatabase() {
  console.log('--- STARTING DATABASE PURGE ---');

  // 1. Locate manakinai user
  const manakinaiUser = await prisma.user.findFirst({
    where: { email: 'kunal.srivastava@manakinai.com' },
  });

  if (!manakinaiUser) {
    throw new Error('FATAL: kunal.srivastava@manakinai.com not found in database!');
  }

  console.log(`Found ManakinAI user: ${manakinaiUser.name} <${manakinaiUser.email}> (ID: ${manakinaiUser.id})`);

  // 2. Locate manakinai JD
  const manakinaiJD = await prisma.jobDescription.findFirst({
    where: { recruiterId: manakinaiUser.id },
  });

  if (!manakinaiJD) {
    throw new Error('FATAL: Job Description for manakinai user not found!');
  }

  console.log(`Found ManakinAI JD: "${manakinaiJD.title}" (ID: ${manakinaiJD.id})`);

  // 3. Delete interview messages and proctoring detection events
  const deletedMessages = await prisma.message.deleteMany();
  console.log(`✓ Deleted ${deletedMessages.count} messages.`);

  const deletedEvents = await prisma.detectionEvent.deleteMany();
  console.log(`✓ Deleted ${deletedEvents.count} detection events.`);

  // 4. Delete interview invitations
  const deletedInvitations = await prisma.interviewInvitation.deleteMany();
  console.log(`✓ Deleted ${deletedInvitations.count} interview invitations.`);

  // 5. Delete interview sessions
  const deletedSessions = await prisma.interviewSession.deleteMany();
  console.log(`✓ Deleted ${deletedSessions.count} interview sessions.`);

  // 6. Delete applicant resumes
  const deletedResumes = await prisma.applicantResume.deleteMany();
  console.log(`✓ Deleted ${deletedResumes.count} applicant resumes.`);

  // 7. Delete all other JDs
  const deletedJDs = await prisma.jobDescription.deleteMany({
    where: { id: { not: manakinaiJD.id } },
  });
  console.log(`✓ Deleted ${deletedJDs.count} other job descriptions.`);

  // 8. Delete auth sessions and tokens for other users
  const deletedAuthSessions = await prisma.session.deleteMany({
    where: { userId: { not: manakinaiUser.id } },
  });
  console.log(`✓ Deleted ${deletedAuthSessions.count} other user auth sessions.`);

  const deletedEmailTokens = await prisma.emailVerificationToken.deleteMany({
    where: { userId: { not: manakinaiUser.id } },
  });
  console.log(`✓ Deleted ${deletedEmailTokens.count} other email verification tokens.`);

  const deletedResetTokens = await prisma.passwordResetToken.deleteMany({
    where: { userId: { not: manakinaiUser.id } },
  });
  console.log(`✓ Deleted ${deletedResetTokens.count} other password reset tokens.`);

  // 9. Delete all other users
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { not: manakinaiUser.id } },
  });
  console.log(`✓ Deleted ${deletedUsers.count} other users.`);

  // 10. Enrich the ManakinAI JD with structured technical competencies
  await prisma.jobDescription.update({
    where: { id: manakinaiJD.id },
    data: {
      requiredSkills: [
        { name: "TypeScript & JavaScript", importance: "MANDATORY", proficiency: "ADVANCED" },
        { name: "Node.js & Express / REST APIs", importance: "MANDATORY", proficiency: "ADVANCED" },
        { name: "React & Next.js", importance: "MANDATORY", proficiency: "INTERMEDIATE" },
        { name: "PostgreSQL & Database Optimization", importance: "MANDATORY", proficiency: "INTERMEDIATE" },
        { name: "Git & CI/CD Pipelines", importance: "MANDATORY", proficiency: "INTERMEDIATE" },
        { name: "System Architecture & API Design", importance: "PREFERRED", proficiency: "INTERMEDIATE" },
      ],
      responsibilities: [
        "Develop scalable full-stack web applications and RESTful APIs",
        "Design relational database schemas and optimize PostgreSQL queries",
        "Implement secure authentication mechanisms and authorization workflows",
        "Collaborate on architectural discussions, code reviews, and production deployments",
      ],
      preferredSkills: [
        "Docker & Containerization",
        "Redis & Distributed Caching",
        "Cloud Services (AWS / GCP)",
        "Unit Testing & Integration Testing",
      ],
      jobLevel: "Intern",
      employmentType: "Full-time",
      workMode: "Hybrid",
      location: "Bengaluru, India",
      minEducation: "Bachelor's",
      minExperience: 0,
      maxExperience: 1,
      freshersAllowed: true,
    },
  });
  console.log(`✓ Enriched ManakinAI JD with structured technical skills and metadata.`);

  // 11. Verification Query
  const remainingUsers = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  const remainingJDs = await prisma.jobDescription.findMany({ select: { id: true, title: true, recruiterId: true } });
  const totalInvitations = await prisma.interviewInvitation.count();
  const totalSessions = await prisma.interviewSession.count();
  const totalResumes = await prisma.applicantResume.count();

  console.log('\n--- FINAL VERIFIED DATABASE STATE ---');
  console.log('Remaining Users (should be 1):', remainingUsers);
  console.log('Remaining JDs (should be 1):', remainingJDs);
  console.log('Invitations Count:', totalInvitations);
  console.log('Sessions Count:', totalSessions);
  console.log('Resumes Count:', totalResumes);
  console.log('--- PURGE COMPLETE ---');
}

cleanDatabase()
  .catch((err) => {
    console.error('Database purge failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
