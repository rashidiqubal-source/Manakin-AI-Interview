import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';

export const MAX_IMAGES_PER_INTERVIEW = 100;

export interface UploadScreenshotResult {
  key: string;
  sequenceNumber: number;
  bucket: string;
  contentType: string;
}

export class S3ServiceClass {
  private client: S3Client | null = null;
  private sessionSequenceMap: Map<string, number> = new Map();
  private sessionLocks: Map<string, Promise<void>> = new Map();

  constructor() {
    this.initClient();
  }

  /**
   * Initializes the AWS S3 client using environment configuration.
   */
  private initClient(): void {
    const hasCredentials = !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);

    if (hasCredentials) {
      this.client = new S3Client({
        region: env.AWS_REGION,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID as string,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
        },
      });
      logger.info(`[S3Service] Initialized AWS S3 client for region "${env.AWS_REGION}" and bucket "${env.AWS_S3_BUCKET}".`);
    } else {
      // In dev/test when credentials are not yet set, instantiate with default provider chain if available
      try {
        this.client = new S3Client({ region: env.AWS_REGION });
        logger.info(`[S3Service] Initialized default S3Client for region "${env.AWS_REGION}". Explicit AWS credentials not supplied in env.`);
      } catch (err: any) {
        logger.warn(`[S3Service] S3Client initialization note: ${err.message}`);
        this.client = null;
      }
    }
  }

  /**
   * Returns whether AWS S3 upload is actively configured with valid credentials.
   */
  public isConfigured(): boolean {
    return !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET);
  }

  /**
   * Formats the required S3 key for a screenshot:
   * interviews/{interviewId}/screenshot_{sequenceNumber}.png
   */
  public formatS3Key(interviewId: string, sequenceNumber: number): string {
    const cleanId = String(interviewId).replace(/[^a-zA-Z0-9_-]/g, '');
    const paddedSeq = String(sequenceNumber).padStart(3, '0');
    return `interviews/${cleanId}/screenshot_${paddedSeq}.png`;
  }

  /**
   * Concurrency-safe atomic sequence generator per interview session.
   * Prevents sequence collisions if multiple violation events arrive concurrently.
   */
  public async getNextSequenceNumber(interviewId: string): Promise<number> {
    // Acquire a mutex lock for this specific interviewId
    let releaseLock: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const previousLock = this.sessionLocks.get(interviewId) || Promise.resolve();
    this.sessionLocks.set(interviewId, lockPromise);

    await previousLock;

    try {
      let currentSeq = this.sessionSequenceMap.get(interviewId);

      if (currentSeq === undefined) {
        // Query database to find existing screenshot records for this interview session
        try {
          const events = await prisma.detectionEvent.findMany({
            where: { interviewSessionId: interviewId },
            select: { metadata: true },
          });

          let maxSeq = 0;
          for (const ev of events) {
            const meta = ev.metadata as any;
            if (meta?.snapshotKey && typeof meta.snapshotKey === 'string') {
              const match = meta.snapshotKey.match(/screenshot_(\d+)\.png/);
              if (match && match[1]) {
                const parsed = parseInt(match[1], 10);
                if (!isNaN(parsed) && parsed > maxSeq) {
                  maxSeq = parsed;
                }
              }
            }
          }
          currentSeq = maxSeq;
        } catch {
          currentSeq = 0;
        }
      }

      const nextSeq = currentSeq + 1;
      this.sessionSequenceMap.set(interviewId, nextSeq);
      return nextSeq;
    } finally {
      releaseLock();
      if (this.sessionLocks.get(interviewId) === lockPromise) {
        this.sessionLocks.delete(interviewId);
      }
    }
  }

  /**
   * Uploads a screenshot directly to private S3 bucket under the required prefix:
   * interviews/{interviewId}/screenshot_{sequenceNumber}.png
   */
  public async uploadScreenshot(params: {
    interviewId: string;
    imageBase64: string;
    sequenceNumber?: number;
  }): Promise<UploadScreenshotResult> {
    const { interviewId, imageBase64 } = params;

    if (!interviewId) {
      throw new Error('interviewId is required for screenshot S3 upload.');
    }
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('Valid base64 image data is required.');
    }

    // Determine sequence number atomically if not explicitly provided
    const seqNum = params.sequenceNumber !== undefined && params.sequenceNumber > 0
      ? params.sequenceNumber
      : await this.getNextSequenceNumber(interviewId);

    if (seqNum > MAX_IMAGES_PER_INTERVIEW) {
      logger.warn(`[S3Service] Maximum threshold of ${MAX_IMAGES_PER_INTERVIEW} images reached for interview session "${interviewId}". Upload skipped.`);
      throw new Error(`Maximum limit of ${MAX_IMAGES_PER_INTERVIEW} images per interview session reached.`);
    }

    const s3Key = this.formatS3Key(interviewId, seqNum);

    // Extract clean buffer from base64 (supporting data URI or raw base64)
    const cleanBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '').trim();
    const rawBuffer = Buffer.from(cleanBase64, 'base64');

    // Compress with Sharp: resize to max 640px wide, convert to JPEG quality 70
    let imageBuffer: Buffer;
    let contentType = 'image/jpeg';
    try {
      imageBuffer = await sharp(rawBuffer)
        .resize({ width: 640, withoutEnlargement: true })
        .jpeg({ quality: 70, mozjpeg: true })
        .toBuffer();
      logger.debug(`[S3Service] Sharp compressed: ${rawBuffer.length} → ${imageBuffer.length} bytes (${Math.round(imageBuffer.length / rawBuffer.length * 100)}%)`);
    } catch (sharpErr: any) {
      logger.warn(`[S3Service] Sharp compression failed, uploading raw buffer: ${sharpErr.message}`);
      imageBuffer = rawBuffer;
      contentType = 'image/png';
    }

    if (!this.client || !this.isConfigured() || !env.AWS_S3_BUCKET) {
      logger.warn(`[S3Service] AWS S3 credentials not fully configured in env. S3 Key would be "${s3Key}". Mocking storage.`);
      return {
        key: s3Key,
        sequenceNumber: seqNum,
        bucket: env.AWS_S3_BUCKET || '',
        contentType,
      };
    }

    try {
      const command = new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: contentType,
      });

      await this.client.send(command);

      logger.info(`[S3Service] Successfully uploaded screenshot to s3://${env.AWS_S3_BUCKET}/${s3Key} (${imageBuffer.length} bytes).`);

      return {
        key: s3Key,
        sequenceNumber: seqNum,
        bucket: env.AWS_S3_BUCKET,
        contentType: 'image/png',
      };
    } catch (err: any) {
      // Safe logging without credentials
      logger.error(`[S3Service] Failed to upload screenshot to S3 [Key: ${s3Key}, Bucket: ${env.AWS_S3_BUCKET}]: ${err.message}`);
      throw new Error(`S3 upload failed: ${err.message}`);
    }
  }

  /**
   * Generates a short-lived presigned GET URL for an authorized user to view a screenshot.
   * Default expiration: 15 minutes (900 seconds).
   */
  public async getPresignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    if (!key) return '';

    // If key is already a data URL (backward compatibility with legacy records), return as is
    if (key.startsWith('data:image/')) {
      return key;
    }

    if (!this.client || !this.isConfigured() || !env.AWS_S3_BUCKET) {
      // If S3 is not configured in local development, return placeholder or key
      return `https://${env.AWS_S3_BUCKET || 's3'}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
      return signedUrl;
    } catch (err: any) {
      logger.error(`[S3Service] Failed to generate presigned URL for key "${key}": ${err.message}`);
      return '';
    }
  }

  /**
   * Validates if the requesting user/recruiter has authorization to access the specified interview session.
   */
  public async isUserAuthorizedForInterview(userId?: string, role?: string, interviewSessionId?: string): Promise<boolean> {
    if (!interviewSessionId) return false;

    // Admin role has access
    if (role === 'ADMIN') return true;

    // Check ownership via invitation or job description recruiter
    try {
      const session = await prisma.interviewSession.findUnique({
        where: { id: interviewSessionId },
        include: {
          invitation: {
            include: {
              jobDescription: true,
            },
          },
        },
      });

      if (!session) return false;

      // If user is the recruiter who owns the invitation or JD
      if (userId && session.invitation) {
        if (session.invitation.recruiterId === userId) return true;
        if (session.invitation.jobDescription?.recruiterId === userId) return true;
      }

      return false;
    } catch (err: any) {
      logger.error(`[S3Service] Authorization check error for session "${interviewSessionId}": ${err.message}`);
      return false;
    }
  }
}

export const S3Service = new S3ServiceClass();
