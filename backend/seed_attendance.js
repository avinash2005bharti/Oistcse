const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAttendance() {
  const sectionId = '057b2755-342a-408c-babb-480f772c3792'; // Section B
  const teacherId = '28996515-16ca-4b43-9efb-fb5431d20077'; // Test Teacher
  const subject = await prisma.subject.findFirst();

  if (!subject) {
    console.log('No subject found');
    return;
  }

  const students = await prisma.student.findMany({
    where: { sectionId }
  });

  console.log(`Found ${students.length} students in Section B:`, students.map(s => s.firstName));

  // Remove existing attendance for this section to prevent duplicates
  const existingAtt = await prisma.attendance.findMany({ where: { sectionId } });
  if (existingAtt.length > 0) {
    await prisma.attendanceRecord.deleteMany({
      where: { attendanceId: { in: existingAtt.map(a => a.id) } }
    });
    await prisma.attendance.deleteMany({ where: { sectionId } });
  }

  const today = new Date();

  // Create 10 attendance sessions over past 2 weeks
  for (let i = 1; i <= 10; i++) {
    const lectureDate = new Date(today);
    lectureDate.setDate(today.getDate() - i);
    lectureDate.setHours(10, 0, 0, 0);

    const att = await prisma.attendance.create({
      data: {
        subjectId: subject.id,
        teacherId,
        sectionId,
        date: lectureDate,
        periodNumber: (i % 4) + 1,
        totalStudents: students.length,
        presentCount: 0,
        absentCount: 0
      }
    });

    let present = 0;
    let absent = 0;

    for (const st of students) {
      let isPresent = true;
      // Stagger attendance:
      // Ayushi: absent on lecture 10 (90%)
      // Avinash: absent on lecture 9 & 10 (80%)
      // Deepak: absent on lecture 8, 9, 10 (70%)
      // Ayush: absent on lecture 7, 8, 9, 10 (60%)
      if (st.firstName === 'Ayushi' && i === 10) isPresent = false;
      if (st.firstName === 'Avinash' && (i === 9 || i === 10)) isPresent = false;
      if (st.firstName === 'Deepak' && (i >= 8)) isPresent = false;
      if (st.firstName === 'Ayush' && (i >= 7)) isPresent = false;

      if (isPresent) present++; else absent++;

      await prisma.attendanceRecord.create({
        data: {
          attendanceId: att.id,
          studentId: st.id,
          status: isPresent ? 'PRESENT' : 'ABSENT',
          verificationMethod: 'MANUAL',
          markedAt: lectureDate
        }
      });
    }

    await prisma.attendance.update({
      where: { id: att.id },
      data: { presentCount: present, absentCount: absent }
    });
  }

  console.log('Successfully seeded 10 real attendance sessions with real records for Section B students.');
}

seedAttendance()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
