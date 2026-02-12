require('dotenv').config({ path: '../.env' });
const GeminiClient = require('./lib/gemini-client');
const GoogleSpeechClient = require('./lib/google-speech-client');

async function testAPIs() {
  console.log('🔍 Testing Google Cloud & Gemini APIs...\n');

  // Test 1: Gemini Client
  console.log('1️⃣ Testing Gemini API...');
  try {
    const gemini = new GeminiClient();
    const testCallId = 'test-' + Date.now();
    
    gemini.startSession(testCallId, 'You are a helpful voice assistant.');
    const response = await gemini.sendMessage(testCallId, 'Hello! Can you hear me?');
    
    console.log('   ✅ Gemini Response:', response);
    gemini.endSession(testCallId);
  } catch (error) {
    console.error('   ❌ Gemini Error:', error.message);
    return false;
  }

  // Test 2: Google Speech-to-Text Client
  console.log('\n2️⃣ Testing Google Speech-to-Text...');
  try {
    const speech = new GoogleSpeechClient();
    console.log('   ✅ Google Speech client initialized');
    console.log('   ℹ️  Full test requires audio file - skipping transcription');
  } catch (error) {
    console.error('   ❌ Speech-to-Text Error:', error.message);
    return false;
  }

  console.log('\n✅ All API tests passed!');
  return true;
}

testAPIs()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
