import { inferenceService } from '../ml/services/inferenceService';
import { logger } from '../config/logger';

class ProctoringServiceClass {
  constructor() {}

  public async analyzeFrame(base64Image: string): Promise<{ faceDetected: boolean; phoneDetected: boolean; error?: string }> {
    try {
      const result = await inferenceService.runDetection(base64Image, {
        runFace: true,
        runObject: true,
      });

      if (!result.success) {
        return {
          faceDetected: true,
          phoneDetected: false,
          error: result.error || 'Inference not ready',
        };
      }

      const faceDetected = result.faces && result.faces.length > 0;
      const phoneDetected = (result.objects || []).some(
        (obj) =>
          (obj.class === 'cell phone' ||
            obj.class === 'phone' ||
            obj.class === 'remote' ||
            obj.class === 'book' ||
            obj.class === 'laptop' ||
            obj.class === 'tablet') &&
          obj.confidence >= 0.2
      );

      return { faceDetected, phoneDetected };
    } catch (e: any) {
      logger.error(`[YOLO26 Proctor] Frame analysis error: ${e.message}`);
      return { faceDetected: false, phoneDetected: false, error: e.message };
    }
  }
}

export const ProctoringService = new ProctoringServiceClass();
