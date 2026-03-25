/**
 * Authentication Middleware
 * JWT verification and user extraction
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import logger from '../config/logger';
import { JWTPayload, UserPublic } from '../models/user.model';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: UserPublic;
      userId?: string;
      userRole?: string;
    }
  }
}

/**
 * Authenticate user from JWT token
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Authorization header missing',
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Use: Bearer <token>',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = authService.verifyAccessToken(token);

      if (decoded.type !== 'access') {
        res.status(401).json({
          success: false,
          message: 'Invalid token type',
        });
        return;
      }

      req.userId = decoded.userId;
      req.userRole = decoded.role;

      next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
        });
        return;
      }

      res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
  } catch (error: any) {
    logger.error('Auth middleware error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = authService.verifyAccessToken(token);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
  } catch {
    // Token invalid, but continue without auth
  }

  next();
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    if (!roles.includes(req.userRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Require verified user
 */
export async function requireVerified(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  try {
    const user = await authService.getUserById(req.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    if (!user.is_verified) {
      res.status(403).json({
        success: false,
        message: 'Email verification required',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    logger.error('Require verified error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error checking user verification',
    });
  }
}

export default {
  authenticate,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireVerified,
};
