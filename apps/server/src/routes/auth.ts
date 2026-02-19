import { Router } from 'express';
import { z } from 'zod';
import { strictRateLimiter } from '../utils/security';
import { generateToken } from '../utils/jwt';
import { validate } from '../middleware';
import { AppError } from '../middleware/error-handler';
import * as userService from '../services/user';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ---------------------------------------------------------------------
// POST /auth/register — Register a new user
// ---------------------------------------------------------------------
router.post(
  '/register',
  strictRateLimiter,
  validate({
    body: registerSchema,
  }),
  async (req, res, next) => {
    try {
      const { email, password, name } = req.body;

      const existingUser = await userService.getUserByEmail(email);
      if (existingUser) {
        throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
      }

      const user = await userService.createUser(email, password, name);

      res.status(201).json({
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          name: user.name,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------
// POST /auth/login — Login user
// ---------------------------------------------------------------------
router.post(
  '/login',
  strictRateLimiter,
  validate({
    body: loginSchema,
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await userService.validateUserCredentials(email, password);
      if (!user) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          token,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
