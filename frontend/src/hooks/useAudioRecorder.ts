import { useState, useRef, useCallback } from 'react';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const chunkSeqRef = useRef<number>(0);

  const startRecording = useCallback(async (onChunk?: (chunk: Blob, seq: number) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm', // universally supported by Chrome/Firefox for MediaRecorder
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      chunkSeqRef.current = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          chunkSeqRef.current += 1;
          if (onChunk) {
            onChunk(e.data, chunkSeqRef.current);
          }
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access denied or error:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(new Blob());
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsRecording(false);
        // Turn off all tracks cleanly
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
};
