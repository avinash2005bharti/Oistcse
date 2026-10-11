const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncStudents() {
  const students = await prisma.student.findMany({
    include: { section: { include: { semester: true } } }
  });

  for (const s of students) {
    if (s.section?.semester?.semesterNumber && s.semester !== s.section.semester.semesterNumber) {
      console.log(`Updating student ${s.firstName} ${s.lastName || ''} semester from ${s.semester} to ${s.section.semester.semesterNumber}`);
      await prisma.student.update({
        where: { id: s.id },
        data: { semester: s.section.semester.semesterNumber }
      });
    }
  }

  // Also assign Test Teacher (test_teacher@mail.in) as TG to Section B (Semester 8)
  const testTeacher = await prisma.teacher.findFirst({
    where: { email: 'test_teacher@mail.in' }
  });

  const secB = await prisma.section.findFirst({
    where: { name: 'B', semester: { semesterNumber: 8 } }
  });

  if (testTeacher && secB) {
    console.log(`Assigning Section B (Sem 8) to Test Teacher (${testTeacher.id})`);
    await prisma.section.update({
      where: { id: secB.id },
      data: { tgTeacherId: testTeacher.id }
    });

    // Ensure all students in Section B have tgTeacherId set to testTeacher.id
    const updated = await prisma.student.updateMany({
      where: { sectionId: secB.id },
      data: { tgTeacherId: testTeacher.id }
    });
    console.log(`Updated ${updated.count} students in Section B with TG Test Teacher`);
  }
}

syncStudents().finally(() => prisma.$disconnect());
