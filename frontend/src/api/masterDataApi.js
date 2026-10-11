// ============================================================================
// Master Data Management API
// Real endpoints for Teachers, Students, Subjects, Classrooms & Timetables
// Supports Add, Edit, Delete, Bulk CSV/Excel Preview, Confirm & Export
// ============================================================================

import { apiClient } from './client';

export const masterDataApi = {
  // --- Teachers ---
  getTeachers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/faculty${query ? `?${query}` : ''}`);
  },

  createTeacher(data) {
    return apiClient.post('/master-data/teachers', data);
  },

  updateTeacher(id, data) {
    return apiClient.put(`/faculty/${id}`, data);
  },

  deleteTeacher(id) {
    return apiClient.delete(`/faculty/${id}`);
  },

  // --- Students ---
  getStudents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/students${query ? `?${query}` : ''}`);
  },

  createStudent(data) {
    return apiClient.post('/master-data/students', data);
  },

  updateStudent(id, data) {
    return apiClient.put(`/students/${id}`, data);
  },

  deleteStudent(id) {
    return apiClient.delete(`/students/${id}`);
  },

  // --- Subjects ---
  getSubjects(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/academic/subjects${query ? `?${query}` : ''}`);
  },

  createSubject(data) {
    return apiClient.post('/master-data/subjects', data);
  },

  deleteSubject(id) {
    return apiClient.delete(`/academic/subjects/${id}`);
  },

  // --- Classrooms / Labs ---
  getClassrooms(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/classrooms${query ? `?${query}` : ''}`);
  },

  createClassroom(data) {
    return apiClient.post('/classrooms', data);
  },

  updateClassroom(id, data) {
    return apiClient.put(`/classrooms/${id}`, data);
  },

  deleteClassroom(id) {
    return apiClient.delete(`/classrooms/${id}`);
  },

  // --- Timetables ---
  getTimetables(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/master-data/timetables${query ? `?${query}` : ''}`);
  },

  deleteTimetable(id) {
    return apiClient.delete(`/master-data/timetables/${id}`);
  },

  // --- Bulk Import: Preview (Step 1) ---
  previewImport(type, file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/master-data/import/preview?type=${type}`, formData);
  },

  // --- Bulk Import: Confirm (Step 2) ---
  confirmImport(type, records) {
    return apiClient.post(`/master-data/import/confirm?type=${type}`, { records });
  },

  // --- Excel Export ---
  async exportData(type) {
    const blob = await apiClient.get(`/master-data/export/${type}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([blob], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}_master_data_${new Date().toISOString().slice(0, 10)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // --- Sample Template Download (.xlsx or .csv) ---
  async downloadSampleTemplate(type, format = 'xlsx') {
    const blob = await apiClient.get(`/master-data/sample-template/${type}?format=${format}`, { responseType: 'blob' });
    const mimeType = format === 'csv'
      ? 'text/csv;charset=utf-8;'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const url = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}_import_sample_template.${ext}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};
