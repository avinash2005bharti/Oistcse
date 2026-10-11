const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function testLogin() {
  const cleanEmail = 'test_hod@mail.in';
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
    include: {
      role: true,
      department: true,
      studentProfile: {
        include: {
          section: true,
          tutorGuardian: true
        }
      },
      teacherProfile: {
        include: {
          hodAssignments: {
            where: { isCurrent: true }
          }
        }
      }
    }
  });

  const baseRole = (user.role?.name || 'STUDENT').toUpperCase();
  const isHod = (user.teacherProfile?.hodAssignments && user.teacherProfile.hodAssignments.length > 0) || baseRole === 'HOD';
  const isTg = Boolean(user.teacherProfile?.isTG);

  let effectiveRole = baseRole;
  if (isHod) effectiveRole = 'HOD';
  else if (isTg && baseRole !== 'ADMIN') effectiveRole = 'TG';

  console.log({
    baseRole,
    isHod,
    isTg,
    effectiveRole,
    hodAssignments: user.teacherProfile?.hodAssignments
  });
}

testLogin().finally(() => prisma.$disconnect());
