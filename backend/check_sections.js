const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sections = await prisma.section.findMany({
    include: { semester: true, tgTeacher: true, _count: { select: { students: true } } }
  });
  console.log('SECTIONS:', JSON.stringify(sections, null, 2));
}

main().finally(() => prisma.$disconnect());
