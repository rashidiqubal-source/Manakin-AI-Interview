import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { FaceDetectorModel, FaceDetectionBox } from '../models/faceDetector';
import { ObjectDetectorModel, ObjectDetectionBox } from '../models/objectDetector';
import { processBase64Frame, decodeImageBuffer } from '../utils/imageUtils';
import { logger } from '../../config/logger';

export interface DetectionResultResponse {
  success: boolean;
  timestamp: number;
  processingTimeMs: number;
  faces: FaceDetectionBox[];
  objects: ObjectDetectionBox[];
  error?: string;
  decodeTimeMs?: number;
  faceInferenceTimeMs?: number;
  objectInferenceTimeMs?: number;
  engine?: string;
}

export class InferenceService {
  private static instance: InferenceService | null = null;
  private faceDetector: FaceDetectorModel;
  private objectDetector: ObjectDetectorModel;
  private activeJobs: number = 0;
  private cachedObjects: ObjectDetectionBox[] = [];
  private readonly MAX_CONCURRENT_INFERENCES = 4;
  private serviceUrl: string;
  private pythonProcess: ChildProcess | null = null;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;

  private constructor() {
    this.faceDetector = FaceDetectorModel.getInstance();
    this.objectDetector = ObjectDetectorModel.getInstance();
    this.serviceUrl = process.env.YOLO26_SERVICE_URL || 'http://127.0.0.1:5001';
  }

  public static getInstance(): InferenceService {
    if (!InferenceService.instance) {
      InferenceService.instance = new InferenceService();
    }
    return InferenceService.instance;
  }

  private findServerScript(): string | null {
    const candidates = [
      path.resolve(__dirname, '../../../ml_service/server.py'),
      path.resolve(__dirname, '../../ml_service/server.py'),
      path.resolve(__dirname, '../ml_service/server.py'),
      path.resolve(process.cwd(), 'ml_service/server.py'),
      path.resolve(process.cwd(), 'backend/ml_service/server.py'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.isInitializing) return;

    this.isInitializing = true;
    logger.info('[YOLO26] Initializing YOLO26 Vision Service...');

    try {
      // 1. Check if the service is already running on port 5001 or remote serviceUrl
      const isRunning = await this.checkServiceHealth();
      if (isRunning) {
        this.faceDetector.setLoaded(true);
        this.objectDetector.setLoaded(true);
        this.isInitialized = true;
        this.isInitializing = false;
        logger.info(`[YOLO26] Connected to active YOLO26 service at ${this.serviceUrl}`);
        return;
      }

      // 2. Auto-spawn Python YOLO26 microservice if script and python are available
      const serverScript = this.findServerScript();
      if (!serverScript) {
        logger.warn('[YOLO26] Python server script (server.py) not found. Skipping local microservice launch.');
        this.isInitializing = false;
        return;
      }

      let pythonCmd = process.env.PYTHON_PATH;
      if (pythonCmd && !fs.existsSync(pythonCmd)) {
        logger.warn(`[YOLO26] Configured PYTHON_PATH "${pythonCmd}" does not exist. Falling back to default system python.`);
        pythonCmd = undefined;
      }
      if (!pythonCmd) {
        pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      }

      logger.info(`[YOLO26] Launching Python YOLO26 server using "${pythonCmd}": ${serverScript}`);

      try {
        this.pythonProcess = spawn(pythonCmd, [serverScript], {
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            YOLO26_PORT: '5001',
            YOLO26_HOST: '127.0.0.1',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        // CRITICAL: Handle child process spawn errors (e.g. ENOENT) to prevent crashing the Node server
        this.pythonProcess.on('error', (err) => {
          logger.warn(`[YOLO26] Could not spawn Python process: ${err.message}. ML features will operate in fallback mode.`);
          this.faceDetector.setLoaded(false);
          this.objectDetector.setLoaded(false);
          this.isInitialized = false;
          this.pythonProcess = null;
        });

        this.pythonProcess.stdout?.on('data', (data) => {
          logger.info(`[YOLO26 Python] ${data.toString().trim()}`);
        });

        this.pythonProcess.stderr?.on('data', (data) => {
          const msg = data.toString().trim();
          if (msg.toLowerCase().includes('error')) {
            logger.error(`[YOLO26 Python Error] ${msg}`);
          } else {
            logger.debug(`[YOLO26 Python] ${msg}`);
          }
        });

        this.pythonProcess.on('exit', (code, signal) => {
          logger.warn(`[YOLO26] Python server process exited (code: ${code}, signal: ${signal})`);
          this.faceDetector.setLoaded(false);
          this.objectDetector.setLoaded(false);
          this.isInitialized = false;
          this.pythonProcess = null;
        });
      } catch (spawnErr: any) {
        logger.warn(`[YOLO26] Synchronous error spawning python: ${spawnErr.message}`);
        this.pythonProcess = null;
        this.isInitializing = false;
        return;
      }

      // Cleanup hook
      const cleanUp = () => {
        if (this.pythonProcess) {
          try {
            logger.info('[YOLO26] Stopping Python YOLO26 service...');
            this.pythonProcess.kill();
          } catch (e) {
            // Ignore
          }
        }
      };

      process.on('exit', cleanUp);
      process.on('SIGINT', cleanUp);
      process.on('SIGTERM', cleanUp);

      // Poll until ready (up to 25 retries, ~10 seconds)
      const maxRetries = 25;
      for (let i = 0; i < maxRetries; i++) {
        if (!this.pythonProcess) {
          logger.warn('[YOLO26] Python process stopped or failed. Aborting startup wait.');
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
        const ready = await this.checkServiceHealth();
        if (ready) {
          this.faceDetector.setLoaded(true);
          this.objectDetector.setLoaded(true);
          this.isInitialized = true;
          this.isInitializing = false;
          logger.info(`[YOLO26] YOLO26 service successfully initialized and healthy at ${this.serviceUrl}`);
          return;
        }
      }

      logger.warn('[YOLO26] YOLO26 server startup in progress or not responding, will connect on next frame.');
    } catch (err: any) {
      logger.error(`[YOLO26] Failed to start Python YOLO26 service: ${err.message}`);
    } finally {
      this.isInitializing = false;
    }
  }

  private async checkServiceHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${this.serviceUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as any;
        return data.status === 'ready' && data.faceModel === true && data.objectModel === true;
      }
    } catch (e) {
      // Service not reachable yet
    }
    return false;
  }

  public getHealth(): { status: 'ready' | 'initializing'; faceModel: boolean; objectModel: boolean; engine: string } {
    const faceModel = this.faceDetector.isLoaded();
    const objectModel = this.objectDetector.isLoaded();
    return {
      status: faceModel && objectModel ? 'ready' : 'initializing',
      faceModel,
      objectModel,
      engine: 'YOLO26',
    };
  }

  public async runDetection(
    imageInput: string | Buffer,
    options?: { runFace?: boolean; runObject?: boolean }
  ): Promise<DetectionResultResponse> {
    const timestamp = Date.now();
    const startTime = Date.now();

    // 1. Concurrency guard to drop stale frames if under heavy load
    if (this.activeJobs >= this.MAX_CONCURRENT_INFERENCES) {
      return {
        success: true,
        timestamp,
        processingTimeMs: 0,
        faces: [],
        objects: this.cachedObjects,
        error: 'Frame dropped due to server inference load',
        engine: 'YOLO26',
      };
    }

    this.activeJobs++;

    try {
      // If service is not initialized yet, trigger background initialization
      if (!this.isInitialized && !this.isInitializing) {
        this.initialize().catch(() => {});
      }

      // 2. Normalize and validate image payload
      let cleanBase64 = '';
      if (Buffer.isBuffer(imageInput)) {
        const decoded = decodeImageBuffer(imageInput);
        cleanBase64 = decoded.base64Image;
      } else {
        const processed = processBase64Frame(imageInput);
        cleanBase64 = processed.base64Image;
      }

      const runFace = options?.runFace !== false;
      const runObject = options?.runObject !== false;

      // 3. Send request to YOLO26 service
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

      const response = await fetch(`${this.serviceUrl}/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: cleanBase64,
          runFace,
          runObject,
          confFace: 0.25,
          confObject: 0.15,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`YOLO26 service returned HTTP ${response.status}`);
      }

      const result = (await response.json()) as any;
      const processingTimeMs = Date.now() - startTime;

      if (result.objects && result.objects.length > 0) {
        this.cachedObjects = result.objects;
      }

      // Mark model loaded once we get a successful inference
      if (!this.isInitialized) {
        this.faceDetector.setLoaded(true);
        this.objectDetector.setLoaded(true);
        this.isInitialized = true;
      }

      return {
        success: result.success,
        timestamp,
        processingTimeMs,
        faces: result.faces || [],
        objects: result.objects || this.cachedObjects,
        decodeTimeMs: result.decodeTimeMs,
        faceInferenceTimeMs: result.faceInferenceTimeMs,
        objectInferenceTimeMs: result.objectInferenceTimeMs,
        engine: 'YOLO26',
      };
    } catch (err: any) {
      // Non-crashing graceful failure fallback
      logger.debug(`[YOLO26] Inference notice: ${err.message}`);
      return {
        success: true, // Do not trigger hard socket errors
        timestamp,
        processingTimeMs: Date.now() - startTime,
        faces: [],
        objects: this.cachedObjects,
        error: err.message,
        engine: 'YOLO26',
      };
    } finally {
      this.activeJobs = Math.max(0, this.activeJobs - 1);
    }
  }

  public async shutdown(): Promise<void> {
    if (this.pythonProcess) {
      try {
        this.pythonProcess.kill();
        this.pythonProcess = null;
      } catch (e) {
        // Ignore
      }
    }
  }
}

export const inferenceService = InferenceService.getInstance();
