import { prisma } from '../src/config/prisma';

async function inspect() {
  const users = await prisma.user.findMany({
    include: {
      jobDescriptions: true,
      resumes: true,
      interviewInvitations: true,
      receivedInvitations: true,
    },
  });

  console.log('--- USERS ---');
  for (const u of users) {
    console.log(`User: ${u.email} (${u.role}, ID: ${u.id})`);
    console.log(`  JDs (${u.jobDescriptions.length}):`, u.jobDescriptions.map(j => `${j.title} (${j.id})`));
    console.log(`  Resumes: ${u.resumes.length}`);
    console.log(`  Sent Invites: ${u.interviewInvitations.length}`);
    console.log(`  Received Invites: ${u.receivedInvitations.length}`);
  }

  const allJDs = await prisma.jobDescription.findMany();
  console.log('\n--- ALL JDS ---');
  for (const jd of allJDs) {
    console.log(`JD: ${jd.title} (ID: ${jd.id}, RecruiterId: ${jd.recruiterId})`);
  }

  const sessionsCount = await prisma.interviewSession.count();
  const messagesCount = await prisma.message.count();
  const detectionEventsCount = await prisma.detectionEvent.count();
  const invitationsCount = await prisma.interviewInvitation.count();
  const resumesCount = await prisma.applicantResume.count();
  const tokensCount = await prisma.session.count();
  const emailVerifCount = await prisma.emailVerificationToken.count();
  const passwordResetCount = await prisma.passwordResetToken.count();

  console.log('\n--- TOTAL COUNTS ---');
  console.log({
    users: users.length,
    jds: allJDs.length,
    sessions: sessionsCount,
    messages: messagesCount,
    detectionEvents: detectionEventsCount,
    invitations: invitationsCount,
    resumes: resumesCount,
    sessions_auth: tokensCount,
    emailVerifications: emailVerifCount,
    passwordResets: passwordResetCount,
  });
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
