import { prisma } from '../src/config/prisma';
import { InvitationService } from '../src/services/InvitationService';

async function testFlow() {
  const recruiter = await prisma.user.findFirst({
    where: { email: 'kunal.srivastava@manakinai.com' },
  });
  if (!recruiter) throw new Error('Recruiter not found');

  const jd = await prisma.jobDescription.findFirst({
    where: { recruiterId: recruiter.id },
  });
  if (!jd) throw new Error('JD not found');

  const testEmail = 'alex.rivera.dev@gmail.com';
  console.log(`Creating invitation for ${testEmail} under JD "${jd.title}"...`);

  const invitation = await InvitationService.createInvitation(recruiter.id, jd.id, testEmail);
  console.log(`✓ Invitation created! Token: ${invitation.token}`);
  console.log(`Direct Link: http://localhost:3001/invite/${invitation.token}`);

  // Now resolve invitation
  const resolved = await InvitationService.resolveInvitation(invitation.token);
  console.log(`✓ Resolved invitation without login:`, {
    token: resolved.token,
    applicantEmail: resolved.applicantEmail,
    applicantId: resolved.applicantId,
    jobTitle: resolved.jobDescription?.title,
  });
}

testFlow()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
