const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const notifs = await prisma.notification.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log('NOTIFICATIONS:', JSON.stringify(notifs, null, 2));

  // Also check students and their semester/section
  const students = await prisma.student.findMany({
    include: { section: { include: { semester: true } } }
  });
  console.log('STUDENTS:', students.map(s => ({
    name: `${s.firstName} ${s.lastName || ''}`.trim(),
    rollNo: s.rollNo,
    enrollmentNo: s.enrollmentNo,
    semester: s.semester,
    section: s.section?.name,
    secSemester: s.section?.semester?.semesterNumber,
    tgTeacherId: s.tgTeacherId
  })));

  // Check TG teachers
  const tgs = await prisma.teacher.findMany({
    where: { OR: [{ isTG: true }, { tgSections: { some: {} } }] },
    include: {
      tgSections: { include: { semester: true } }
    }
  });
  console.log('TGS:', tgs.map(t => ({
    id: t.id,
    name: `${t.firstName} ${t.lastName || ''}`.trim(),
    email: t.email,
    isTG: t.isTG,
    sections: t.tgSections.map(s => ({
      name: s.name,
      semester: s.semester?.semesterNumber
    }))
  })));
}

main().finally(() => prisma.$disconnect());
