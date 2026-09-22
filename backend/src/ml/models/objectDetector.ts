import { logger } from '../../config/logger';

export interface ObjectDetectionBox {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ObjectDetectorModel {
  private static instance: ObjectDetectorModel | null = null;
  private isModelLoaded: boolean = false;

  private constructor() {}

  public static getInstance(): ObjectDetectorModel {
    if (!ObjectDetectorModel.instance) {
      ObjectDetectorModel.instance = new ObjectDetectorModel();
    }
    return ObjectDetectorModel.instance;
  }

  public setLoaded(loaded: boolean): void {
    this.isModelLoaded = loaded;
  }

  public isLoaded(): boolean {
    return this.isModelLoaded;
  }
}
