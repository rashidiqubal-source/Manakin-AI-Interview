import express from 'express';
import 'express-async-errors'; // catches async errors for global handler
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { logger } from './config/logger';
import apiV1Routes from './routes/v1';
import { errorHandler } from './middlewares/errorHandler';
import { csrfProtection } from './middlewares/csrf';
import { AppError } from './utils/AppError';

import mlRoutes from './ml/routes/mlRoutes';

import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const app = express();

// Trust the reverse proxy so rate limiting and secure cookies work accurately behind load balancers
app.set('trust proxy', 1);

// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'sameorigin' },
  })
);

// Secure CORS configuration supporting credentials (cookies)
const allowedOriginsList = new Set<string>();
[
  ...env.CORS_ORIGIN.split(','),
  ...env.FRONTEND_URL.split(','),
  'https://manakin-ai-interview.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
].forEach((item) => {
  const trimmed = item.trim();
  if (trimmed) allowedOriginsList.add(trimmed);
});

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || env.CORS_ORIGIN === '*') {
        return callback(null, true);
      }
      if (
        allowedOriginsList.has(requestOrigin) ||
        (requestOrigin.endsWith('.vercel.app') &&
          (requestOrigin.includes('manakin-ai-interview') || requestOrigin.includes('ai-interview')))
      ) {
        return callback(null, true);
      }
      return callback(new AppError('Not allowed by CORS', 403));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'Accept'],
  })
);

app.use(cookieParser(env.SESSION_SECRET));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// CSRF Defense-in-Depth for cookie-based state-changing requests
app.use(csrfProtection);

app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Lumina AI Backend is running correctly on Render.' });
});

// Mount High-Throughput Real-Time Computer Vision API
app.use('/api/ml', mlRoutes);
app.use('/api/v1/ml', mlRoutes);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: 'Too many requests from this IP'
});
app.use('/api', limiter);

const morganFormat = env.NODE_ENV === 'development' ? 'dev' : 'combined';
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message: string) => logger.http(message.trim()),
    },
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Backend is healthy' });
});

app.use('/api/v1', apiV1Routes);

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Interview Platform API',
      version: '1.0.0',
      description: 'API Documentation for AI Interviewer Backend',
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development Server',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route Not Found' });
});

app.use(errorHandler);

export default app;
