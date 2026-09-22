import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if ((err as any).name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      statusCode = 409;
      message = 'A resource with these details already exists';
    } else if (prismaError.code === 'P2025') {
      statusCode = 404;
      message = 'Requested resource not found';
    } else {
      statusCode = 400;
      message = 'Database operation failed';
    }
  }

  logger.error(`[${req.method}] ${req.path} >> StatusCode:: ${statusCode}, Message:: ${err.message}`);
  if (env.NODE_ENV === 'development' && !(err instanceof AppError)) {
    logger.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

