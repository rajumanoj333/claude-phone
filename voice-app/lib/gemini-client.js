const { GoogleGenerativeAI } = require('@google/generative-ai');
const debug = require('debug')('voice-app:gemini');

class GeminiClient {
  constructor() {
    // Try API key first, fall back to service account
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      this.useApiKey = true;
      debug('Gemini client initialized with API key');
    } else {
      throw new Error('GEMINI_API_KEY not set. Please get an API key from: https://makersuite.google.com/app/apikey');
    }

    this.sessions = new Map(); // callId -> chat session
  }

  /**
   * Start a new conversation session
   * @param {string} callId - Unique call identifier
   * @param {string} systemPrompt - System instructions
   */
  startSession(callId, systemPrompt = '') {
    const chat = this.model.startChat({
      history: systemPrompt ? [{
        role: 'user',
        parts: [{ text: `[SYSTEM] ${systemPrompt}` }]
      }, {
        role: 'model',
        parts: [{ text: 'Understood. I am ready to assist.' }]
      }] : [],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.7,
        topP: 0.8,
        topK: 40
      }
    });

    this.sessions.set(callId, chat);
    debug(`Session started for call ${callId}`);
  }

  /**
   * Send a message and get response
   * @param {string} callId - Call identifier
   * @param {string} message - User message
   * @returns {Promise<string>} AI response
   */
  async sendMessage(callId, message) {
    try {
      let chat = this.sessions.get(callId);
      
      if (!chat) {
        debug(`No session found for ${callId}, creating new session`);
        this.startSession(callId);
        chat = this.sessions.get(callId);
      }

      debug(`Sending to Gemini [${callId}]:`, message);
      
      const result = await chat.sendMessage(message);
      const response = result.response;
      const text = response.text();

      debug(`Gemini response [${callId}]:`, text);
      return text;

    } catch (error) {
      debug('Gemini error:', error);
      
      // Handle safety blocks or other errors gracefully
      if (error.message?.includes('SAFETY')) {
        return "I apologize, but I cannot respond to that request.";
      }
      
      throw new Error(`Gemini API failed: ${error.message}`);
    }
  }

  /**
   * Send structured query expecting JSON response
   * @param {string} callId - Call identifier
   * @param {string} query - Query text
   * @param {string} schema - Expected JSON schema description
   * @returns {Promise<Object>} Parsed JSON response
   */
  async sendStructuredQuery(callId, query, schema) {
    try {
      const prompt = `${query}\n\nRespond ONLY with valid JSON matching this schema: ${schema}`;
      const response = await this.sendMessage(callId, prompt);
      
      // Extract JSON from markdown code blocks if present
      let jsonText = response.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }
      
      return JSON.parse(jsonText);
    } catch (error) {
      debug('Structured query error:', error);
      throw new Error(`Failed to parse structured response: ${error.message}`);
    }
  }

  /**
   * End a conversation session
   * @param {string} callId - Call identifier
   */
  endSession(callId) {
    if (this.sessions.has(callId)) {
      this.sessions.delete(callId);
      debug(`Session ended for call ${callId}`);
    }
  }

  /**
   * Get active session count
   * @returns {number}
   */
  getActiveSessionCount() {
    return this.sessions.size;
  }
}

module.exports = GeminiClient;
