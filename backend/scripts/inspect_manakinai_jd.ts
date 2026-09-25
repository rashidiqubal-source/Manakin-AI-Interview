import { prisma } from '../src/config/prisma';

async function main() {
  const jd = await prisma.jobDescription.findFirst({
    where: { recruiter: { email: 'kunal.srivastava@manakinai.com' } },
  });

  console.log('--- MANAKINAI JD ---');
  console.log('ID:', jd?.id);
  console.log('Title:', jd?.title);
  console.log('Department:', jd?.department);
  console.log('RawContent preview:', jd?.rawContent?.slice(0, 150));
  console.log('RequiredSkills:', jd?.requiredSkills);
  console.log('Responsibilities:', jd?.responsibilities);
  console.log('PreferredSkills:', jd?.preferredSkills);
}

main().catch(console.error).finally(() => prisma.$disconnect());
