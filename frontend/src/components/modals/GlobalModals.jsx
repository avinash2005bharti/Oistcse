import React from 'react';
import { createPortal } from 'react-dom';
import { useERP } from '../../context/ERPContext';
import ApplyLeaveModal from './ApplyLeaveModal';
import CreateAssignmentModal from './CreateAssignmentModal';
import SubmitAssignmentModal from './SubmitAssignmentModal';
import SendNoticeModal from './SendNoticeModal';
import ScheduleLectureModal from './ScheduleLectureModal';
import StudentFeedbackModal from './StudentFeedbackModal';
import StudentDetailModal from './StudentDetailModal';
import RequestConsiderationModal from './RequestConsiderationModal';
import NoticeDetailModal from './NoticeDetailModal';
import GoogleSheetSyncModal from './GoogleSheetSyncModal';
import FormalApplicationModal from './FormalApplicationModal';
import AttendanceLeaveReportsModal from './AttendanceLeaveReportsModal';

export default function GlobalModals() {
  const { modalState, closeModal } = useERP();

  if (!modalState || !modalState.name) return null;

  let modalContent = null;

  switch (modalState.name) {
    case 'applyLeave':
      modalContent = <ApplyLeaveModal data={modalState.data} onClose={closeModal} />;
      break;
    case 'requestConsideration':
      modalContent = <RequestConsiderationModal data={modalState.data} onClose={closeModal} />;
      break;
    case 'attendanceLeaveReports':
    case 'attendanceConsiderationReports':
      modalContent = (
        <AttendanceLeaveReportsModal
          isOpen={true}
          onClose={closeModal}
          initialTab={modalState.data?.initialTab || modalState.data?.tab || 'attendance'}
          initialSemester={modalState.data?.semester || 'ALL'}
          initialSection={modalState.data?.section || 'ALL'}
          userRole={modalState.data?.role || 'all'}
        />
      );
      break;
    case 'createAssignment':
      modalContent = <CreateAssignmentModal data={modalState.data} onClose={closeModal} />;
      break;
    case 'submitAssignment':
      modalContent = <SubmitAssignmentModal data={modalState.data} onClose={closeModal} />;
      break;
    case 'sendNotice':
      modalContent = <SendNoticeModal data={modalState.data} onClose={closeModal} />;
      break;
    case 'viewNotice':
      modalContent = <NoticeDetailModal notice={modalState.data} onClose={closeModal} />;
      break;
    case 'scheduleLecture':
      modalContent = <ScheduleLectureModal data={modalState.data} onClose={closeModal} />;
      break;
    case 'studentFeedback':
      modalContent = <StudentFeedbackModal data={modalState.data} onClose={closeModal} />;
      break;
    case 'studentDetail':
      modalContent = <StudentDetailModal data={modalState.data} onClose={closeModal} />;
      break;
    case 'googleSheet':
      modalContent = <GoogleSheetSyncModal data={modalState.data} onClose={closeModal} />;
      break;
    case 'formalApplication':
      modalContent = <FormalApplicationModal request={modalState.data?.request || modalState.data} onClose={closeModal} />;
      break;
    default:
      return null;
  }

  if (!modalContent) return null;
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
