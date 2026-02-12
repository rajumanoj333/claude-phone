const twilio = require('twilio');
const debug = require('debug')('voice-app:twilio');
const EventEmitter = require('events');

class TwilioHandler extends EventEmitter {
  constructor(geminiClient, speechClient, ttsService) {
    super();
    
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.webhookBaseUrl = process.env.WEBHOOK_BASE_URL;

    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      throw new Error('Twilio credentials not configured');
    }

    this.client = twilio(this.accountSid, this.authToken);
    this.gemini = geminiClient;
    this.speech = speechClient;
    this.tts = ttsService;
    
    this.activeCalls = new Map(); // callSid -> call data
    
    debug('Twilio handler initialized', {
      phoneNumber: this.phoneNumber,
      webhookBaseUrl: this.webhookBaseUrl
    });
  }

  /**
   * Generate TwiML for incoming call
   * @param {string} callSid - Twilio call SID
   * @returns {string} TwiML response
   */
  generateIncomingCallTwiML(callSid) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    // Greet the caller
    response.say({
      voice: 'Polly.Joanna'
    }, 'Hello, this is your AI assistant. How can I help you today?');
    
    // Start listening for speech
    const gather = response.gather({
      input: 'speech',
      action: `${this.webhookBaseUrl}/voice/process-speech`,
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US'
    });
    
    // If no input, repeat
    response.say({
      voice: 'Polly.Joanna'
    }, "I didn't hear anything. Please say something.");
    response.redirect(`${this.webhookBaseUrl}/voice/incoming`);
    
    return response.toString();
  }

  /**
   * Process speech input from caller
   * @param {string} speechResult - Transcribed speech from Twilio
   * @param {string} callSid - Call SID
   * @returns {Promise<string>} TwiML response
   */
  async processSpeech(speechResult, callSid) {
    try {
      debug(`Processing speech for call ${callSid}:`, speechResult);
      
      // Get or create call session
      if (!this.activeCalls.has(callSid)) {
        this.gemini.startSession(callSid, 'You are a helpful voice assistant. Keep responses brief and conversational, under 2 sentences.');
        this.activeCalls.set(callSid, {
          startTime: Date.now(),
          turns: 0
        });
      }
      
      const callData = this.activeCalls.get(callSid);
      callData.turns++;
      
      // Get AI response
      const aiResponse = await this.gemini.sendMessage(callSid, speechResult);
      
      debug(`AI response for call ${callSid}:`, aiResponse);
      
      // Check if conversation should end
      const maxTurns = parseInt(process.env.MAX_CONVERSATION_TURNS) || 10;
      const shouldEnd = callData.turns >= maxTurns;
      
      // Generate TwiML
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      
      // Use ElevenLabs TTS if available, otherwise use Twilio's TTS
      if (this.tts && process.env.ELEVENLABS_API_KEY) {
        try {
          const audioUrl = await this.tts.synthesize(aiResponse, callSid);
          response.play(audioUrl);
        } catch (error) {
          debug('ElevenLabs TTS failed, falling back to Twilio:', error);
          response.say({ voice: 'Polly.Joanna' }, aiResponse);
        }
      } else {
        response.say({ voice: 'Polly.Joanna' }, aiResponse);
      }
      
      if (shouldEnd) {
        response.say({ voice: 'Polly.Joanna' }, 'Thank you for calling. Goodbye!');
        response.hangup();
      } else {
        // Continue conversation
        const gather = response.gather({
          input: 'speech',
          action: `${this.webhookBaseUrl}/voice/process-speech`,
          method: 'POST',
          speechTimeout: 'auto',
          language: 'en-US'
        });
        
        response.say({ voice: 'Polly.Joanna' }, "I'm still here if you need anything else.");
        response.redirect(`${this.webhookBaseUrl}/voice/incoming`);
      }
      
      return response.toString();
      
    } catch (error) {
      debug('Error processing speech:', error);
      
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      response.say({ voice: 'Polly.Joanna' }, "I'm sorry, I encountered an error. Please try again.");
      response.redirect(`${this.webhookBaseUrl}/voice/incoming`);
      
      return response.toString();
    }
  }

  /**
   * Handle call status webhook
   * @param {string} callSid - Call SID
   * @param {string} callStatus - Call status
   */
  handleCallStatus(callSid, callStatus) {
    debug(`Call ${callSid} status: ${callStatus}`);
    
    if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') {
      // Clean up session
      if (this.activeCalls.has(callSid)) {
        this.activeCalls.delete(callSid);
        this.gemini.endSession(callSid);
        debug(`Cleaned up session for call ${callSid}`);
      }
    }
  }

  /**
   * Make an outbound call
   * @param {string} to - Phone number to call
   * @param {string} initialMessage - First message to say
   * @returns {Promise<Object>} Call object
   */
  async makeOutboundCall(to, initialMessage = 'Hello, this is your AI assistant calling.') {
    try {
      debug(`Making outbound call to ${to}`);
      
      const call = await this.client.calls.create({
        to: to,
        from: this.phoneNumber,
        url: `${this.webhookBaseUrl}/voice/outbound?message=${encodeURIComponent(initialMessage)}`,
        statusCallback: `${this.webhookBaseUrl}/voice/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      });
      
      debug(`Outbound call created: ${call.sid}`);
      return call;
      
    } catch (error) {
      debug('Error making outbound call:', error);
      throw error;
    }
  }

  /**
   * Generate TwiML for outbound call
   * @param {string} message - Initial message
   * @param {string} callSid - Call SID
   * @returns {string} TwiML
   */
  generateOutboundCallTwiML(message, callSid) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    response.say({ voice: 'Polly.Joanna' }, message);
    
    const gather = response.gather({
      input: 'speech',
      action: `${this.webhookBaseUrl}/voice/process-speech`,
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US'
    });
    
    response.say({ voice: 'Polly.Joanna' }, "I didn't hear a response. Goodbye.");
    response.hangup();
    
    return response.toString();
  }

  /**
   * Get active call count
   * @returns {number}
   */
  getActiveCallCount() {
    return this.activeCalls.size;
  }
}

module.exports = TwilioHandler;
