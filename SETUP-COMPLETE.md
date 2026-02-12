# Claude Phone - Twilio/Gemini Setup Guide

## ✅ What We've Built

Successfully migrated from:
- OpenAI Whisper → Google Cloud Speech-to-Text
- Claude API → Gemini API  
- 3CX/SIP/FreeSWITCH → Twilio Voice API
- Kept: ElevenLabs TTS

## 🎯 Current Status

**✅ WORKING:**
- Server running on port 3000
- Google Cloud Speech-to-Text configured
- Gemini API connected and tested
- Twilio SDK installed and configured
- Webhooks responding correctly
- Public URL: `https://upgraded-giggle-4j7wwpw5r4wrf5wg-3000.app.github.dev`

**⚠️ NEEDS CONFIGURATION:**
- Twilio phone number webhook settings

## 📞 Twilio Configuration Steps

### Step 1: Verify Phone Number Ownership
1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Find your number: **+17743325477**
3. Click on it

### Step 2: Configure Voice Webhooks
In the "Voice Configuration" section:

**When a call comes in:**
- Configure with: `Webhook`
- URL: `https://upgraded-giggle-4j7wwpw5r4wrf5wg-3000.app.github.dev/voice/incoming`
- HTTP Method: `HTTP POST`

**Status callback URL (optional but recommended):**
- URL: `https://upgraded-giggle-4j7wwpw5r4wrf5wg-3000.app.github.dev/voice/status`
- HTTP Method: `HTTP POST`

### Step 3: Save Configuration
Click the **Save** button at the bottom of the page.

### Step 4: Test the Call
1. Call **+17743325477** from your phone
2. You should hear: "Hello, this is your AI assistant. How can I help you today?"
3. Say something like "Hello, how are you?"
4. Gemini AI will respond
5. Continue the conversation!

## 🔍 Troubleshooting

### If the call doesn't connect:

**Check Twilio Dashboard:**
- Go to: https://console.twilio.com/us1/monitor/logs/calls
- Find your recent call
- Look for error messages

**Check Server Logs:**
```bash
tail -f /tmp/voice-app.log
```

**Verify Webhook URL:**
```bash
curl https://upgraded-giggle-4j7wwpw5r4wrf5wg-3000.app.github.dev/health
```

**Common Issues:**
1. **Webhook URL not saved** - Double-check and re-save in Twilio console
2. **Server not running** - Restart with: `cd voice-app && node index-twilio.js`
3. **Port not public** - Ensure GitHub Codespaces port 3000 is public
4. **Twilio account issues** - Check account status and billing

## 🚀 Making Outbound Calls

Once inbound is working, test outbound:

```bash
curl -X POST https://upgraded-giggle-4j7wwpw5r4wrf5wg-3000.app.github.dev/api/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Hello, this is your AI assistant calling with an important update."
  }'
```

## 📁 File Structure

```
/workspaces/claude-phone/
├── .env                           # Your credentials
├── google-service-account.json    # Google Cloud credentials
└── voice-app/
    ├── index-twilio.js           # Main server (NEW)
    ├── lib/
    │   ├── gemini-client.js      # Gemini AI (NEW)
    │   ├── google-speech-client.js # Google STT (NEW)
    │   ├── twilio-handler.js     # Twilio integration (NEW)
    │   └── tts-service.js        # ElevenLabs TTS (existing)
    └── test-apis.js              # API tests

OLD FILES (no longer used):
- index.js (old SIP version)
- lib/sip-handler.js
- lib/registrar.js
- lib/audio-fork.js
- lib/whisper-client.js
- lib/claude-bridge.js
```

## 🔐 Environment Variables

Current configuration in `.env`:
```
GOOGLE_APPLICATION_CREDENTIALS=/workspaces/claude-phone/google-service-account.json
GOOGLE_PROJECT_ID=your-google-project-id
GEMINI_API_KEY=your-gemini-api-key
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
WEBHOOK_BASE_URL=your-webhook-base-url
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=your-elevenlabs-voice-id
HTTP_PORT=3000
MAX_CONVERSATION_TURNS=10
```

## 🎉 Success Criteria

When everything works, you should experience:
1. Call connects immediately
2. Hear AI greeting
3. Speak naturally
4. AI responds with Twilio TTS or ElevenLabs
5. Multi-turn conversation (up to 10 exchanges)
6. Clean call termination

## 📚 API Endpoints

- `POST /voice/incoming` - Twilio webhook for incoming calls
- `POST /voice/process-speech` - Process user speech input
- `POST /voice/status` - Call status updates
- `POST /api/outbound-call` - Trigger outbound call
- `GET /api/calls` - Active call count
- `GET /health` - System health check

## 🔄 Restarting the Server

If you need to restart:
```bash
cd /workspaces/claude-phone/voice-app
node index-twilio.js
```

Or with debug logs:
```bash
DEBUG=voice-app:* node index-twilio.js
```

## 📖 Next Steps

1. ✅ Test inbound calling thoroughly
2. Test outbound calling API
3. Customize AI prompts in `twilio-handler.js`
4. Adjust conversation length in `.env`
5. Deploy to production server (optional)
6. Add call recording (optional)
7. Integrate with your applications
