const config = require('../config');

/**
 * AI Service Client: Communicates with FastAPI over HTTP and parses NDJSON stream (§3).
 */
class AIClient {
  /**
   * Streams chat reasoning events from FastAPI /v1/agent/chat.
   * Calls onEvent callback for each parsed NDJSON line.
   */
  async streamChat({ sessionId, text, fileUrls, feature, userToken, onEvent, signal }) {
    const url = `${config.aiServiceUrl}/v1/agent/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': config.aiServiceKey,
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        sessionId,
        text,
        fileUrls,
        feature
      }),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Service error (${response.status}): ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete chunk in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          onEvent(event);
        } catch (e) {
          console.warn('[AI Client] Malformed NDJSON line:', trimmed);
        }
      }
    }

    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim());
        onEvent(event);
      } catch (e) {}
    }
  }

  /**
   * Calls FastAPI /v1/agent/confirm to execute or reject an action proposal (§4).
   */
  async confirmProposal({ sessionId, proposalId, approved, edits, userToken }) {
    const url = `${config.aiServiceUrl}/v1/agent/confirm`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': config.aiServiceKey,
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        sessionId,
        proposalId,
        approved,
        edits
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Confirmation failed');
    }
    return data;
  }
}

module.exports = new AIClient();
