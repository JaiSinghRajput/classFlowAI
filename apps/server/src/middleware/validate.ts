import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from './error-handler';

interface ValidationSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Record<string, unknown> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors['body'] = result.error.format();
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors['query'] = result.error.format();
      } else {
        req.query = result.data as typeof req.query;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors['params'] = result.error.format();
      } else {
        req.params = result.data as typeof req.params;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors);
    }

    next();
  };
}
