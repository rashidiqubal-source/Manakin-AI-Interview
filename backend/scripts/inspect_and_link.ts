import { prisma } from '../src/config/prisma';

async function main() {
  const recruiterEmail = 'kunal.srivastava@manakinai.com';

  // 1. Find or verify recruiter
  let recruiter = await prisma.user.findUnique({
    where: { email: recruiterEmail },
    include: { jobDescriptions: true },
  });

  console.log('Recruiter search result:', recruiter ? {
    id: recruiter.id,
    email: recruiter.email,
    name: recruiter.name,
    role: recruiter.role,
    jds: recruiter.jobDescriptions.map(j => ({ id: j.id, title: j.title })),
  } : 'NOT FOUND');

  // Also list all other users with recruiter role or any JDs
  const allJds = await prisma.jobDescription.findMany({
    include: { recruiter: { select: { email: true, name: true } } },
  });
  console.log('Total JDs in DB:', allJds.length);
  allJds.forEach(j => {
    console.log(`- JD [${j.id}] "${j.title}" by ${j.recruiter.email}`);
  });

  // Check dummy applicants
  const dummyEmails = [
    'alex.rivera@demo.com',
    'priya.sharma@demo.com',
    'liam.oconnor@demo.com',
    'maya.lin@demo.com',
    'jordan.taylor@demo.com',
  ];

  const applicants = await prisma.user.findMany({
    where: { email: { in: dummyEmails } },
    include: { resumes: true },
  });
  console.log('Found dummy applicants:', applicants.map(a => ({
    email: a.email,
    name: a.name,
    resumesCount: a.resumes.length,
    resumeId: a.resumes[0]?.id,
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
