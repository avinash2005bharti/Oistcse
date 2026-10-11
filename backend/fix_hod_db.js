const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixHodInDb() {
  const hodEmail = 'test_hod@mail.in';
  const hodRole = await prisma.role.findFirst({
    where: { name: { equals: 'HOD', mode: 'insensitive' } }
  });

  if (!hodRole) {
    throw new Error('HOD role not found in database');
  }

  const user = await prisma.user.findUnique({
    where: { email: hodEmail },
    include: { teacherProfile: true }
  });

  if (!user) {
    throw new Error(`User ${hodEmail} not found`);
  }

  console.log('Found user:', user.email, 'Current roleId:', user.roleId);

  // 1. Ensure user roleId is strictly HOD
  await prisma.user.update({
    where: { id: user.id },
    data: { roleId: hodRole.id }
  });
  console.log('User role updated to HOD:', hodRole.id);

  if (user.teacherProfile) {
    const teacherId = user.teacherProfile.id;
    const departmentId = user.teacherProfile.departmentId;

    // 2. Unset isTG on HOD teacher profile
    await prisma.teacher.update({
      where: { id: teacherId },
      data: { isTG: false }
    });
    console.log('Teacher isTG set to false');

    // 3. Unlink any section where HOD was mistakenly assigned as TG
    const unlinked = await prisma.section.updateMany({
      where: { tgTeacherId: teacherId },
      data: { tgTeacherId: null }
    });
    console.log(`Unlinked ${unlinked.count} sections from HOD as TG`);

    await prisma.student.updateMany({
      where: { tgTeacherId: teacherId },
      data: { tgTeacherId: null }
    });

    // 4. Upsert record in HOD table
    const existingHodRecord = await prisma.hOD.findFirst({
      where: { teacherId, departmentId, isCurrent: true }
    });

    if (!existingHodRecord) {
      const createdHod = await prisma.hOD.create({
        data: {
          teacherId,
          departmentId,
          isCurrent: true
        }
      });
      console.log('Created HOD table record:', createdHod.id);
    } else {
      console.log('HOD table record already exists:', existingHodRecord.id);
    }
  }

  console.log('HOD record restoration complete.');
}

fixHodInDb()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
