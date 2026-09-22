import { Session } from '@prisma/client';
import { AuthenticatedUser } from '../services/SessionService';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: Session;
      rawSessionToken?: string;
    }
  }
}
