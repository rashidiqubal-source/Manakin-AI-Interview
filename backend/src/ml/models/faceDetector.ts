import { logger } from '../../config/logger';

export interface FaceDetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export class FaceDetectorModel {
  private static instance: FaceDetectorModel | null = null;
  private isModelLoaded: boolean = false;

  private constructor() {}

  public static getInstance(): FaceDetectorModel {
    if (!FaceDetectorModel.instance) {
      FaceDetectorModel.instance = new FaceDetectorModel();
    }
    return FaceDetectorModel.instance;
  }

  public setLoaded(loaded: boolean): void {
    this.isModelLoaded = loaded;
  }

  public isLoaded(): boolean {
    return this.isModelLoaded;
  }
}
