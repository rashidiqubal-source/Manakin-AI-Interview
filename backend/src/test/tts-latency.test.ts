import { KokoroTTSService } from '../services/KokoroTTSService';

describe('Kokoro TTS & Response Latency Suite', () => {
  it('1. Synthesizes speech audio buffer with voice parameters and duration calculation', async () => {
    const result = await KokoroTTSService.synthesizeSpeech({
      text: 'Welcome to your AI interview! Let us begin by discussing your experience with distributed caching in Redis.',
      voice: 'af_heart',
    });

    expect(result).toBeDefined();
    expect(result.audioBase64).toContain('data:audio/mp3;base64,');
    expect(result.format).toBe('mp3');
    expect(result.durationSec).toBeGreaterThan(0);
    expect(['kokoro', 'openai-fallback']).toContain(result.engine);
  });

  it('2. Rejects empty text for TTS synthesis gracefully', async () => {
    await expect(
      KokoroTTSService.synthesizeSpeech({ text: '   ' })
    ).rejects.toThrow('Text is required for TTS synthesis');
  });
});
