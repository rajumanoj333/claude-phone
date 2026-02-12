const speech = require('@google-cloud/speech');
const { WaveFile } = require('wavefile');
const debug = require('debug')('voice-app:google-speech');

class GoogleSpeechClient {
  constructor() {
    this.client = new speech.SpeechClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    debug('Google Speech-to-Text client initialized');
  }

  /**
   * Transcribe audio buffer to text
   * @param {Buffer} audioBuffer - Raw audio data (μ-law or linear16)
   * @param {Object} options - Transcription options
   * @returns {Promise<string>} Transcribed text
   */
  async transcribe(audioBuffer, options = {}) {
    try {
      const {
        encoding = 'MULAW',
        sampleRateHertz = 8000,
        languageCode = 'en-US'
      } = options;

      // Convert buffer to base64
      const audioBytes = audioBuffer.toString('base64');

      const request = {
        audio: {
          content: audioBytes
        },
        config: {
          encoding: encoding,
          sampleRateHertz: sampleRateHertz,
          languageCode: languageCode,
          model: 'phone_call',
          useEnhanced: true,
          enableAutomaticPunctuation: true
        }
      };

      debug('Sending audio to Google Speech-to-Text', {
        size: audioBuffer.length,
        encoding,
        sampleRateHertz
      });

      const [response] = await this.client.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        debug('No transcription results');
        return '';
      }

      const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');

      debug('Transcription:', transcription);
      return transcription;

    } catch (error) {
      debug('Transcription error:', error);
      throw new Error(`Speech-to-Text failed: ${error.message}`);
    }
  }

  /**
   * Convert Linear16 PCM to μ-law (for Twilio compatibility)
   * @param {Buffer} linear16Buffer - Linear16 PCM audio
   * @returns {Buffer} μ-law encoded audio
   */
  convertLinear16ToMulaw(linear16Buffer) {
    const wav = new WaveFile();
    wav.fromScratch(1, 8000, '16', linear16Buffer);
    wav.toMuLaw();
    return Buffer.from(wav.data.samples);
  }

  /**
   * Stream transcription (for real-time use)
   * @returns {Object} Streaming recognition stream
   */
  createStream(options = {}) {
    const {
      encoding = 'MULAW',
      sampleRateHertz = 8000,
      languageCode = 'en-US'
    } = options;

    const request = {
      config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
        model: 'phone_call',
        useEnhanced: true,
        enableAutomaticPunctuation: true
      },
      interimResults: false
    };

    debug('Creating streaming recognition');
    return this.client.streamingRecognize(request);
  }
}

module.exports = GoogleSpeechClient;
