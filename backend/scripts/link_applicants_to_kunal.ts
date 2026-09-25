import { prisma } from '../src/config/prisma';

async function main() {
  const recruiterEmail = 'kunal.srivastava@manakinai.com';

  const recruiter = await prisma.user.findUnique({
    where: { email: recruiterEmail },
    include: { jobDescriptions: true },
  });

  if (!recruiter) {
    throw new Error(`Recruiter ${recruiterEmail} not found`);
  }

  const jd = recruiter.jobDescriptions[0];
  if (!jd) {
    throw new Error(`No Job Description found for recruiter ${recruiterEmail}`);
  }

  console.log(`Linking applicants to JD: "${jd.title}" (ID: ${jd.id}) owned by ${recruiter.name || recruiter.email}`);

  const dummyApplicants = [
    {
      name: 'Alex Rivera',
      email: 'alex.rivera@demo.com',
      githubUrl: 'https://github.com/alexrivera-dev',
    },
    {
      name: 'Priya Sharma',
      email: 'priya.sharma@demo.com',
      githubUrl: 'https://github.com/priyasharma-ops',
    },
    {
      name: "Liam O'Connor",
      email: 'liam.oconnor@demo.com',
      githubUrl: 'https://github.com/liam-ml',
    },
    {
      name: 'Maya Lin',
      email: 'maya.lin@demo.com',
      githubUrl: 'https://github.com/mayalin-systems',
    },
    {
      name: 'Jordan Taylor',
      email: 'jordan.taylor@demo.com',
      githubUrl: 'https://github.com/jordantaylor-sec',
    },
  ];

  const results = [];

  for (const item of dummyApplicants) {
    const user = await prisma.user.findUnique({
      where: { email: item.email },
      include: { resumes: true },
    });

    if (!user) {
      console.warn(`User ${item.email} not found in database!`);
      continue;
    }

    const resume = user.resumes[0];

    // Find existing invitation or create new one
    let invitation = await prisma.interviewInvitation.findFirst({
      where: {
        jobDescriptionId: jd.id,
        applicantEmail: item.email,
      },
    });

    if (invitation) {
      invitation = await prisma.interviewInvitation.update({
        where: { id: invitation.id },
        data: {
          recruiterId: recruiter.id,
          applicantId: user.id,
          applicantResumeId: resume?.id || null,
          githubUrl: item.githubUrl,
        },
      });
      console.log(`✓ Updated existing invitation for ${item.name} (${item.email})`);
    } else {
      invitation = await prisma.interviewInvitation.create({
        data: {
          jobDescriptionId: jd.id,
          recruiterId: recruiter.id,
          applicantEmail: item.email,
          applicantId: user.id,
          applicantResumeId: resume?.id || null,
          githubUrl: item.githubUrl,
          status: 'PENDING',
        },
      });
      console.log(`+ Created new invitation for ${item.name} (${item.email})`);
    }

    results.push({
      candidate: item.name,
      email: item.email,
      githubUrl: item.githubUrl,
      invitationId: invitation.id,
      token: invitation.token,
      inviteUrl: `http://localhost:3001/invite/${invitation.token}`,
      resumeLinked: Boolean(resume?.id),
    });
  }

  console.log('\n=== LINKING SUMMARY ===');
  console.table(results.map(r => ({
    Candidate: r.candidate,
    Email: r.email,
    'Resume Linked': r.resumeLinked,
    'Invite URL': r.inviteUrl,
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
