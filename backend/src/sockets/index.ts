import { Server, Socket } from 'socket.io';
import { logger } from '../config/logger';
import { InterviewService } from '../services/InterviewService';
import { inferenceService } from '../ml/services/inferenceService';
import { ObjectTrackerService } from '../ml/services/ObjectTrackerService';
import { prisma } from '../config/prisma';
import { S3Service } from '../services/S3Service';

export const setupSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    logger.info(`🔌 WebSocket Client Connected: ${socket.id}`);

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Real-Time YOLO26 Frame Inference over WebSocket
    socket.on('ml_frame', async (imageInput: any, options?: { runFace?: boolean; runObject?: boolean; metadata?: any }) => {
      try {
        let input: string | Buffer;
        if (Buffer.isBuffer(imageInput)) {
          input = imageInput;
        } else if (imageInput && typeof imageInput === 'object' && imageInput.image) {
          input = imageInput.image;
        } else if (typeof imageInput === 'string') {
          input = imageInput;
        } else {
          socket.emit('ml_error', { message: 'Invalid or missing image payload' });
          return;
        }

        const runFace = options?.runFace !== false;
        const runObject = options?.runObject !== false;

        const result = await inferenceService.runDetection(input, { runFace, runObject });
        
        let currentCheatCount = 0;
        if (result.success) {
          const sessionId = options?.metadata?.sessionId || `temp-${socket.id}`;
          const tracker = ObjectTrackerService.getTracker(sessionId);
          const tracks = await tracker.processFrameDetections(result.objects);
          
          result.objects = tracks.map(t => ({
            class: t.class,
            confidence: t.confidence,
            x: t.bbox.x,
            y: t.bbox.y,
            width: t.bbox.width,
            height: t.bbox.height,
            trackId: t.trackId,
            risk: t.risk,
            state: t.state
          }));

          if (sessionId && !sessionId.startsWith("temp-")) {
            try {
              const dbSession = await prisma.interviewSession.findUnique({
                where: { id: sessionId },
                select: { cheatCount: true }
              });
              currentCheatCount = dbSession?.cheatCount || 0;
            } catch (dbErr: any) {
              logger.debug(`[Socket ML] DB session lookup note: ${dbErr.message}`);
            }
          }
        }

        socket.emit('ml_result', {
          ...result,
          cheatCount: currentCheatCount,
          metadata: options?.metadata || {}
        });
      } catch (error: any) {
        logger.error(`[Socket ML] Detection error: ${error.message}`);
        socket.emit('ml_error', { message: error.message });
      }
    });

    socket.on('trigger_violation', async (data: {
      sessionId: string;
      type: string;
      message: string;
      points?: number;
      snapshotBase64?: string;
      metadata?: any;
    }) => {
      try {
        const { sessionId, type, message, snapshotBase64, metadata } = data;
        if (!sessionId || sessionId.startsWith("temp-")) return;

        logger.info(`[FLAG] session=${sessionId} type=${type} message=${message} hasSnapshot=${!!snapshotBase64}`);

        // 1. Map type to event category
        let eventType = "SUSPICIOUS_OBJECT";
        if (type === 'ABSENT_USER' || type === 'FACE_ABSENCE' || type === 'FACE_MISSING') eventType = "FACE_MISSING";
        else if (type === 'MULTIPLE_FACES') eventType = "MULTIPLE_FACES";
        else if (type === 'MOBILE_PHONE' || type === 'UNAUTHORIZED_DEVICE') eventType = "UNAUTHORIZED_DEVICE";
        else if (type === 'OFF_SCREEN_READING') eventType = "OFF_SCREEN_READING";
        else if (type === 'CONCEALED_PHONE_GAZE') eventType = "CONCEALED_PHONE_GAZE";
        else if (type === 'SUSPICIOUS_CORNER_GLANCES') eventType = "SUSPICIOUS_CORNER_GLANCES";
        else if (type === 'CODE_PASTE_BURST') eventType = "CODE_PASTE_BURST";
        else if (type === 'UNNATURAL_KEYSTROKE_CADENCE') eventType = "UNNATURAL_KEYSTROKE_CADENCE";

        // Weighted Misconduct Points
        let defaultPoints = 1;
        if (eventType === 'UNAUTHORIZED_DEVICE' || type === 'MOBILE_PHONE') defaultPoints = 2;
        else if (eventType === 'CONCEALED_PHONE_GAZE') defaultPoints = 2;
        else if (eventType === 'CODE_PASTE_BURST') defaultPoints = 2;
        else if (eventType === 'UNNATURAL_KEYSTROKE_CADENCE') defaultPoints = 1;
        else if (eventType === 'OFF_SCREEN_READING') defaultPoints = 1;
        const points = data.points || defaultPoints;

        // 2. Upload snapshot directly to AWS S3 under isolated interview prefix
        let snapshotKey: string | null = null;
        let snapshotUrl: string | null = null;

        if (snapshotBase64) {
          try {
            const uploadRes = await S3Service.uploadScreenshot({
              interviewId: sessionId,
              imageBase64: snapshotBase64,
            });
            snapshotKey = uploadRes.key;
            snapshotUrl = await S3Service.getPresignedUrl(uploadRes.key);
          } catch (uploadErr: any) {
            if (uploadErr.message?.includes('Maximum limit of')) {
              logger.warn(`[Socket Proctor] ${uploadErr.message}`);
              snapshotUrl = null;
            } else {
              logger.error(`[Socket Proctor] Failed to upload violation screenshot: ${uploadErr.message}`);
              snapshotUrl = snapshotBase64;
            }
          }
        }

        // 3. Save structured event to DB with S3 reference metadata
        await prisma.detectionEvent.create({
          data: {
            interviewSessionId: sessionId,
            eventType,
            objectClass: type === 'ABSENT_USER' ? 'face' : (type === 'MOBILE_PHONE' ? 'cell phone' : type),
            confidence: 1.0,
            riskLevel: 'HIGH',
            source: 'PROCTOR_TELEMETRY',
            metadata: {
              message,
              snapshotKey: snapshotKey || null,
              snapshot: snapshotUrl || snapshotKey || null,
              patternDetails: metadata || null,
              recordedAt: new Date().toISOString(),
            },
          },
        });

        // 3. Atomically increment session flag count by misconduct points
        const updatedSession = await prisma.interviewSession.update({
          where: { id: sessionId },
          data: {
            cheatCount: {
              increment: points,
            },
          },
        });

        io.to(socket.id).emit('violation_count_update', { cheatCount: updatedSession.cheatCount });
      } catch (err: any) {
        logger.error(`Failed to handle trigger_violation socket event: ${err.message}`);
      }
    });

    // Multi-Signal Evidence Proctoring Event Stream
    socket.on('proctoring_event', async (data: {
      sessionId: string;
      type: string;
      durationMs?: number;
      source?: string;
      confidence?: number;
      questionId?: string;
      answerId?: string;
      metadata?: any;
    }) => {
      try {
        const { sessionId, type, durationMs, source, confidence, questionId, answerId, metadata } = data;
        if (!sessionId || sessionId.startsWith("temp-")) return;

        const isHighRisk = ['UNAUTHORIZED_DEVICE', 'SUSPICIOUS_OBJECT', 'FACE_IDENTITY_CHANGE'].includes(type);

        await prisma.detectionEvent.create({
          data: {
            interviewSessionId: sessionId,
            eventType: type,
            durationMs: durationMs ? Math.round(durationMs) : 0,
            source: source || 'BROWSER',
            confidence: confidence !== undefined ? confidence : 1.0,
            questionId: questionId ? String(questionId) : undefined,
            answerId: answerId ? String(answerId) : undefined,
            metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : undefined,
            riskLevel: isHighRisk ? 'HIGH' : 'MEDIUM'
          }
        });

        logger.info(`[PROCTORING_EVENT] session=${sessionId} type=${type} source=${source || 'BROWSER'} durationMs=${durationMs || 0}`);
      } catch (err: any) {
        logger.error(`Failed to handle proctoring_event socket: ${err.message}`);
      }
    });

    socket.on('start_interview', async (data: { candidateName: string }) => {
      try {
        const result = await InterviewService.startInterview(data.candidateName);
        socket.data = socket.data || {};
        socket.data.sessionId = result.sessionId;
        socket.emit('interview_started', result);
      } catch (error: any) {
        logger.error(`Socket start_interview error: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('respond', async (data: { sessionId: string; text: string }) => {
      try {
        const result = await InterviewService.respondToInterview(data.sessionId, data.text);
        socket.emit('assistant_reply', result);
      } catch (error: any) {
        logger.error(`Socket respond error: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });

    // Natural Interruption Handling (Barge-In)
    socket.on('barge_in', (data: { sessionId: string; timestamp?: number; interruptedTurn?: number | string }) => {
      logger.info(`🗣️ [BARGE-IN] Candidate interrupted AI audio playback for session=${data.sessionId} at turn=${data.interruptedTurn || 'active'}`);
      socket.emit('barge_in_acknowledged', { timestamp: Date.now(), sessionId: data.sessionId });
    });

    // Real-Time Streaming Voice Pipeline
    socket.on('voice_stream_chunk', (data: { sessionId: string; chunk: string | Buffer; seq: number; isFinal?: boolean }) => {
      socket.emit('voice_stream_ack', { seq: data.seq, receivedAt: Date.now() });
    });

    socket.on('voice_stream_end', (data: { sessionId: string; totalChunks?: number }) => {
      logger.info(`🎙️ [VOICE_STREAM_END] Completed streaming voice pipeline for session=${data.sessionId}`);
      socket.emit('voice_stream_processed', { status: 'ready', sessionId: data.sessionId });
    });

    socket.on('disconnect', (reason) => {
      logger.info(`🔌 WebSocket Client Disconnected: ${socket.id} (Reason: ${reason})`);
      ObjectTrackerService.removeTracker(`temp-${socket.id}`);
      if (socket.data?.sessionId) {
        ObjectTrackerService.removeTracker(socket.data.sessionId);
      }
    });
  });
};
