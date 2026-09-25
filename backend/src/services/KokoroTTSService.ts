import { OpenAI } from 'openai';
import { logger } from '../config/logger';
import { env } from '../config/env';

export interface TTSResult {
  audioBase64: string;
  format: 'mp3' | 'wav';
  voice: string;
  durationSec: number;
  engine: 'kokoro' | 'openai-fallback';
}

export class KokoroTTSService {
  private static getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
    return new OpenAI({ apiKey: apiKey || 'mock-key' });
  }

  /**
   * Generates audio speech for a given text prompt using Kokoro TTS (with OpenAI TTS fallback).
   */
  static async synthesizeSpeech(params: {
    text: string;
    voice?: string;
    speed?: number;
  }): Promise<TTSResult> {
    const { text, voice = 'af_heart', speed = 1.0 } = params;
    const cleanText = text.trim();

    if (!cleanText) {
      throw new Error('Text is required for TTS synthesis');
    }

    const kokoroUrl = process.env.KOKORO_TTS_URL;

    // 1. Try Kokoro TTS service if endpoint configured
    if (kokoroUrl) {
      try {
        logger.info(`[KokoroTTS] Attempting speech synthesis via Kokoro endpoint: ${kokoroUrl}`);
        const response = await fetch(`${kokoroUrl.replace(/\/+$/, '')}/v1/audio/speech`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'kokoro',
            input: cleanText,
            voice,
            speed,
            response_format: 'mp3',
          }),
          signal: AbortSignal.timeout(6000),
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const audioBase64 = buffer.toString('base64');
          const words = cleanText.split(/\s+/).length;
          const estimatedDurationSec = Math.max(1, Math.round((words / 150) * 60));

          return {
            audioBase64: `data:audio/mp3;base64,${audioBase64}`,
            format: 'mp3',
            voice,
            durationSec: estimatedDurationSec,
            engine: 'kokoro',
          };
        } else {
          logger.warn(`[KokoroTTS] Endpoint returned status ${response.status}. Falling back to standard TTS.`);
        }
      } catch (err: any) {
        logger.warn(`[KokoroTTS] Connection failed (${err.message}). Using resilient fallback.`);
      }
    }

    // 2. Resilient Fallback to OpenAI TTS
    try {
      const apiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'mock-key') {
        throw new Error('No valid OpenAI API key found for TTS fallback');
      }

      logger.info(`[KokoroTTS] Synthesizing speech via OpenAI TTS-1 fallback for voice: ${voice}`);
      const openai = this.getOpenAIClient();
      const mp3Response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice === 'af_heart' ? 'nova' : 'alloy',
        input: cleanText,
        speed,
      });

      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      const audioBase64 = buffer.toString('base64');
      const words = cleanText.split(/\s+/).length;
      const durationSec = Math.max(1, Math.round((words / 150) * 60));

      return {
        audioBase64: `data:audio/mp3;base64,${audioBase64}`,
        format: 'mp3',
        voice: voice === 'af_heart' ? 'nova' : 'alloy',
        durationSec,
        engine: 'openai-fallback',
      };
    } catch (fallbackErr: any) {
      if (process.env.NODE_ENV === 'test' || process.env.MOCK_AI === 'true') {
        const words = cleanText.split(/\s+/).length;
        const durationSec = Math.max(1, Math.round((words / 150) * 60));
        return {
          audioBase64: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA',
          format: 'mp3',
          voice: voice || 'alloy',
          durationSec,
          engine: 'openai-fallback',
        };
      }
      logger.error(`[KokoroTTS] Speech synthesis error: ${fallbackErr.message}`);
      throw new Error(`TTS Synthesis Failed: ${fallbackErr.message}`);
    }
  }
}
