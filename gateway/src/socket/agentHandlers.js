const aiClient = require('../services/aiClient');

// Active stream abort controllers per sessionId
const activeStreams = new Map();

/**
 * Registers Socket.IO agent event listeners implementing Section 6 Realtime Contract.
 */
function registerAgentHandlers(io, socket) {
  const user = socket.user;
  const userRoom = `user:${user.userId}`;

  // 1. Client -> Server: agent:message
  socket.on('agent:message', async (payload) => {
    const { sessionId, text, fileUrls, feature } = payload || {};
    if (!sessionId || !text) {
      socket.emit('agent:error', {
        sessionId: sessionId || 'unknown',
        code: 'INVALID_PAYLOAD',
        message: 'sessionId and text are required.'
      });
      return;
    }

    // Cancel any previous stream on this session
    if (activeStreams.has(sessionId)) {
      activeStreams.get(sessionId).abort();
      activeStreams.delete(sessionId);
    }

    const abortController = new AbortController();
    activeStreams.set(sessionId, abortController);

    try {
      await aiClient.streamChat({
        sessionId,
        text,
        fileUrls,
        feature,
        userToken: user.rawToken,
        signal: abortController.signal,
        onEvent: (event) => {
          // Map FastAPI stream event to Socket.IO events (§6)
          switch (event.type) {
            case 'start':
              io.to(userRoom).emit('agent:start', {
                sessionId,
                agent: event.agent,
                displayName: event.display_name
              });
              break;

            case 'token':
              io.to(userRoom).emit('agent:token', {
                sessionId,
                delta: event.delta
              });
              break;

            case 'tool':
              io.to(userRoom).emit('agent:tool', {
                sessionId,
                name: event.name,
                status: event.status
              });
              break;

            case 'proposal':
              io.to(userRoom).emit('agent:proposal', {
                sessionId,
                proposalId: event.proposalId,
                action: event.action,
                summary: event.summary,
                payload: event.payload
              });
              break;

            case 'done':
              io.to(userRoom).emit('agent:done', {
                sessionId,
                usage: event.usage
              });
              break;

            case 'error':
              io.to(userRoom).emit('agent:error', {
                sessionId,
                code: event.code || 'AI_ERROR',
                message: event.message
              });
              break;
          }
        }
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[Socket.IO] Stream aborted for session ${sessionId}`);
      } else {
        console.error(`[Socket.IO Error] ${err.message}`);
        io.to(userRoom).emit('agent:error', {
          sessionId,
          code: 'STREAM_FAILED',
          message: err.message
        });
      }
    } finally {
      activeStreams.delete(sessionId);
    }
  });

  // 2. Client -> Server: agent:confirm
  socket.on('agent:confirm', async (payload) => {
    const { sessionId, proposalId, approved, edits } = payload || {};
    if (!sessionId || !proposalId) {
      socket.emit('agent:error', {
        sessionId: sessionId || 'unknown',
        code: 'INVALID_PAYLOAD',
        message: 'sessionId and proposalId are required.'
      });
      return;
    }

    try {
      const outcome = await aiClient.confirmProposal({
        sessionId,
        proposalId,
        approved: Boolean(approved),
        edits,
        userToken: user.rawToken
      });

      io.to(userRoom).emit('agent:confirmed', {
        sessionId,
        proposalId,
        outcome
      });
    } catch (err) {
      io.to(userRoom).emit('agent:error', {
        sessionId,
        code: 'CONFIRM_FAILED',
        message: err.message
      });
    }
  });

  // 3. Client -> Server: agent:cancel
  socket.on('agent:cancel', (payload) => {
    const sessionId = payload?.sessionId;
    if (sessionId && activeStreams.has(sessionId)) {
      activeStreams.get(sessionId).abort();
      activeStreams.delete(sessionId);
      io.to(userRoom).emit('agent:cancelled', { sessionId });
    }
  });

  socket.on('disconnect', () => {
    // Clean up active streams on disconnect
    for (const [sId, controller] of activeStreams.entries()) {
      controller.abort();
    }
  });
}

module.exports = {
  registerAgentHandlers
};
