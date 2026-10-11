const jwt = require('jsonwebtoken');
const path = require('path');
let registerAgentHandlers = null;
try {
  registerAgentHandlers = require(path.resolve(__dirname, '../../../gateway/src/socket/agentHandlers')).registerAgentHandlers;
} catch (e) {
  console.warn('[Socket.IO] Note: gateway agentHandlers import note:', e.message);
}

let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // If handshake carries JWT, decode identity and attach agent handlers
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '6LP4FBmCAQIy9KCbpbaTwLIGZC55bMeNiBFB2rW9GtMwLSgIbwJipqbw77i');
        socket.user = {
          userId: String(decoded.id || decoded.sub || decoded.userId || ''),
          role: String(decoded.role || 'STUDENT').toUpperCase(),
          permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
          tenantId: String(decoded.departmentId || 'CSE'),
          rawToken: token
        };
        socket.join(`user:${socket.user.userId}`);
        if (registerAgentHandlers) {
          registerAgentHandlers(io, socket);
        }
      } catch (err) {
        console.warn(`[Socket.IO] Handshake auth note: ${err.message}`);
      }
    }

    // Join user-specific room
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        socket.join(`user:${userId}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined user_${userId}`);
      }
    });

    // Join role room (student, teacher, tg, hod, admin)
    socket.on('join_role', (role) => {
      if (role) {
        socket.join(`role_${role.toLowerCase()}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined role_${role}`);
      }
    });

    // Join section room (e.g. 'CSE-3A')
    socket.on('join_section', (section) => {
      if (section) {
        socket.join(`section_${section}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined section_${section}`);
      }
    });

    // Handle ping/liveness
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};

const getIO = () => ioInstance;

const emitNotification = (recipientRoleOrId, notification) => {
  if (!ioInstance) return;

  // Emit to role room or specific user room
  if (['student', 'teacher', 'tg', 'hod', 'admin'].includes(recipientRoleOrId.toLowerCase())) {
    ioInstance.to(`role_${recipientRoleOrId.toLowerCase()}`).emit('new_notification', notification);
  } else {
    ioInstance.to(`user_${recipientRoleOrId}`).emit('new_notification', notification);
  }
  
  // Also broadcast general event
  ioInstance.emit('notification_broadcast', notification);
};

const emitAttendanceUpdate = (section, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`section_${section}`).emit('attendance_updated', payload);
  ioInstance.to('role_teacher').emit('attendance_updated', payload);
  ioInstance.to('role_hod').emit('attendance_updated', payload);
};

const emitLeaveUpdate = (payload) => {
  if (!ioInstance) return;
  ioInstance.to('role_tg').emit('leave_updated', payload);
  ioInstance.to('role_hod').emit('leave_updated', payload);
  if (payload.studentId) {
    ioInstance.to(`user_${payload.studentId}`).emit('leave_updated', payload);
  }
};

const emitTimetableUpdate = (section, payload) => {
  if (!ioInstance) return;
  if (section) {
    ioInstance.to(`section_${section}`).emit('timetable_updated', payload);
  }
  ioInstance.emit('timetable_updated', payload);
};

const emitAgentStep = (channel, stepPayload) => {
  if (!ioInstance) return;
  ioInstance.emit(`agent_step_${channel}`, stepPayload);
};

module.exports = {
  initSocket,
  getIO,
  emitNotification,
  emitAttendanceUpdate,
  emitLeaveUpdate,
  emitTimetableUpdate,
  emitAgentStep
};
