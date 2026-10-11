const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: 'test_hod@mail.in', mode: 'insensitive' } },
    include: {
      role: true,
      teacherProfile: {
        include: {
          department: true,
          hodAssignments: true,
          tgSections: true
        }
      }
    }
  });
  console.log('USER:', JSON.stringify(user, null, 2));

  const roles = await prisma.role.findMany();
  console.log('ROLES:', JSON.stringify(roles, null, 2));

  const hods = await prisma.hOD.findMany({
    include: { teacher: true, department: true }
  });
  console.log('HOD RECORDS:', JSON.stringify(hods, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
