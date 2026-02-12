require('dotenv').config({ path: __dirname + '/../.env' });
const express = require('express');
const debug = require('debug')('voice-app:main');

// Import services
const GeminiClient = require('./lib/gemini-client');
const GoogleSpeechClient = require('./lib/google-speech-client');
const TwilioHandler = require('./lib/twilio-handler');

// Initialize Express
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize clients (without TTS service for now)
const gemini = new GeminiClient();
const speech = new GoogleSpeechClient();
const twilioHandler = new TwilioHandler(gemini, speech, null); // Pass null for TTS

debug('All services initialized');

// ============================================
// TWILIO WEBHOOK ROUTES
// ============================================

/**
 * Incoming call webhook
 */
app.post('/voice/incoming', (req, res) => {
  debug('Incoming call:', req.body);
  const callSid = req.body.CallSid;
  const twiml = twilioHandler.generateIncomingCallTwiML(callSid);
  res.type('text/xml');
  res.send(twiml);
});

/**
 * Process speech input
 */
app.post('/voice/process-speech', async (req, res) => {
  debug('Processing speech:', req.body);
  
  const speechResult = req.body.SpeechResult;
  const callSid = req.body.CallSid;
  
  if (!speechResult) {
    debug('No speech detected');
    const twilio = require('twilio');
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say({ voice: 'Polly.Joanna' }, "I didn't hear anything. Please try again.");
    response.redirect('/voice/incoming');
    res.type('text/xml');
    res.send(response.toString());
    return;
  }
  
  try {
    const twiml = await twilioHandler.processSpeech(speechResult, callSid);
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    debug('Error processing speech:', error);
    const twilio = require('twilio');
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say({ voice: 'Polly.Joanna' }, "I'm sorry, something went wrong. Please try again.");
    response.hangup();
    res.type('text/xml');
    res.send(response.toString());
  }
});

/**
 * Outbound call webhook
 */
app.post('/voice/outbound', (req, res) => {
  debug('Outbound call answered:', req.body);
  const message = req.query.message || 'Hello, this is your AI assistant calling.';
  const callSid = req.body.CallSid;
  const twiml = twilioHandler.generateOutboundCallTwiML(message, callSid);
  res.type('text/xml');
  res.send(twiml);
});

/**
 * Call status webhook
 */
app.post('/voice/status', (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  twilioHandler.handleCallStatus(callSid, callStatus);
  res.sendStatus(200);
});

// ============================================
// API ROUTES (for programmatic access)
// ============================================

/**
 * Make an outbound call
 * POST /api/outbound-call
 * Body: { to: "+1234567890", message: "Hello..." }
 */
app.post('/api/outbound-call', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: 'Phone number "to" is required' });
    }
    
    const call = await twilioHandler.makeOutboundCall(to, message);
    
    res.json({
      success: true,
      callSid: call.sid,
      to: call.to,
      status: call.status
    });
    
  } catch (error) {
    debug('Error making outbound call:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get call status
 * GET /api/call/:callSid
 */
app.get('/api/call/:callSid', async (req, res) => {
  try {
    const call = await twilioHandler.client.calls(req.params.callSid).fetch();
    res.json({
      callSid: call.sid,
      to: call.to,
      from: call.from,
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime
    });
  } catch (error) {
    debug('Error fetching call:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get active calls
 * GET /api/calls
 */
app.get('/api/calls', (req, res) => {
  res.json({
    activeCallCount: twilioHandler.getActiveCallCount(),
    activeGeminiSessions: gemini.getActiveSessionCount()
  });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      gemini: 'connected',
      googleSpeech: 'connected',
      twilio: 'connected',
      elevenlabs: process.env.ELEVENLABS_API_KEY ? 'configured' : 'not configured'
    },
    activeCalls: twilioHandler.getActiveCallCount()
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.HTTP_PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                 🤖 CLAUDE PHONE (Twilio)                  ║
╠═══════════════════════════════════════════════════════════╣
║  Server listening on: http://localhost:${PORT}            ║
║  Twilio Phone: ${process.env.TWILIO_PHONE_NUMBER}        ║
║                                                            ║
║  📞 Webhook URL (for Twilio config):                      ║
║     ${process.env.WEBHOOK_BASE_URL || 'NOT CONFIGURED'}  ║
║                                                            ║
║  🔌 Endpoints:                                             ║
║     POST /voice/incoming      - Incoming call webhook     ║
║     POST /voice/process-speech - Speech processing        ║
║     POST /voice/outbound      - Outbound call webhook     ║
║     POST /voice/status        - Call status updates       ║
║     POST /api/outbound-call   - Make outbound call        ║
║     GET  /api/calls           - Active calls              ║
║     GET  /health              - Health check              ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  debug('Server started successfully');
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});
