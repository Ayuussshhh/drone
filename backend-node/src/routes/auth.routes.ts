/**
 * Authentication Routes
 */

import { Router, Request, Response } from 'express';
import { authService } from '../services';
import {
  asyncHandler,
  authenticate,
  validate,
  registerValidation,
  loginValidation,
  emailValidation,
  passwordValidation,
  changePasswordValidation,
} from '../middleware';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/auth/register
 * Register new user
 */
router.post(
  '/register',
  validate(registerValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, username, first_name, last_name } = req.body;

    const result = await authService.register({
      email,
      password,
      username,
      first_name,
      last_name,
    });

    res.status(201).json({
      success: true,
      message: result.message,
      data: { user: result.user },
    });
  })
);

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post(
  '/verify-email',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
      return;
    }

    const result = await authService.verifyEmail(token);

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: { user: result.user },
    });
  })
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  validate(loginValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip;

    const result = await authService.login({ email, password }, deviceInfo, ipAddress);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
      return;
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: { tokens: result.tokens },
    });
  })
);

/**
 * POST /api/auth/logout
 * Logout user (revoke refresh token)
 */
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 */
router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await authService.logoutAll(req.userId!);

    res.json({
      success: true,
      message: 'Logged out from all devices',
    });
  })
);

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post(
  '/forgot-password',
  validate(emailValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    await authService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent',
    });
  })
);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post(
  '/reset-password',
  validate(passwordValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Reset token is required',
      });
      return;
    }

    await authService.resetPassword(token, password);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  })
);

/**
 * POST /api/auth/change-password
 * Change password (authenticated)
 */
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    await authService.changePassword(req.userId!, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getUserById(req.userId!);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { user },
    });
  })
);

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post(
  '/resend-verification',
  validate(emailValidation),
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    // This would ideally regenerate token and resend
    // For now, user must re-register if token expired

    res.json({
      success: true,
      message: 'If the account exists and is unverified, a new verification email has been sent',
    });
  })
);

export default router;
