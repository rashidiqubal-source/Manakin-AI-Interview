import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Enforce test defaults if missing
process.env.NODE_ENV = 'test';

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-session-secret-key-at-least-32-chars-long';
}

if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'mock-openai-key-for-test-runner';
}

// Silence noisy console logging during test runs if needed
if (process.env.SILENCE_TEST_LOGS === 'true') {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
}
