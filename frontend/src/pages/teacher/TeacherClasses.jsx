import React from 'react';
import { useERP } from '../../context/ERPContext';
import { Link } from 'react-router-dom';
import { BookOpen, Users, CheckSquare, Calendar, ArrowRight, Clock } from 'lucide-react';
import { PageHeader, Card, Badge, Button, EmptyState } from '../../components/common';

export default function TeacherClasses() {
  const { currentUser, students, timetable, dashboardData, subjects } = useERP();

  // Extract assigned courses from timetable slots
  const allSlots = [
    ...(timetable.Monday || []),
    ...(timetable.Tuesday || []),
    ...(timetable.Wednesday || []),
    ...(timetable.Thursday || []),
    ...(timetable.Friday || [])
  ];

  // Map unique courses
  const courseMap = {};
  allSlots.forEach((slot) => {
    const key = `${slot.subject}-${slot.room}`;
    if (!courseMap[key]) {
      courseMap[key] = {
        code: slot.code || 'CS',
        name: slot.subject,
        room: slot.room || 'Room not assigned',
        type: slot.type || 'Lecture',
        faculty: slot.faculty,
        timeSlots: []
      };
    }
    courseMap[key].timeSlots.push(slot.time);
  });

  const courseList = Object.values(courseMap);

  return (
    <div className="page-wrapper">
      <div className="flex flex-col gap-5">
        <PageHeader
          title="My Assigned Classes & Sections"
          description="Teaching courses, laboratory sessions, and active classroom assignments."
          badge={<Badge variant="primary" size="sm">Active Roster</Badge>}
        />

        {courseList.length === 0 ? (
          <Card className="text-center py-10">
            <EmptyState
              icon={<BookOpen size={36} className="text-slate-400" />}
              title="No Courses Assigned"
              description="No teaching classes or laboratory batches assigned in current timetable."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseList.map((course, idx) => (
              <Card key={idx} className="flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-primary">
                        {course.code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 m-0">
                        {course.name}
                      </h3>
                    </div>
                    <Badge variant="purple" size="xs">{course.type}</Badge>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned Venue</span>
                      <span className="font-semibold text-slate-800">{course.room}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Weekly Sessions</span>
                      <span className="font-bold text-primary">{course.timeSlots.length} periods/week</span>
                    </div>
                  </div>
                </div>

                <Link
                  to="/teacher/attendance"
                  className="btn btn-outline text-xs py-2 px-3 flex items-center justify-between no-underline"
                >
                  <span>Take Live Attendance</span>
                  <ArrowRight size={14} />
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
