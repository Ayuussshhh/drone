/**
 * Authentication Service
 * Handles user registration, login, token management
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection';
import config from '../config';
import logger from '../config/logger';
import {
  User,
  UserPublic,
  CreateUserDTO,
  LoginDTO,
  AuthTokens,
  JWTPayload,
  toPublicUser,
} from '../models/user.model';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from './email.service';

const SALT_ROUNDS = 12;

// Generate JWT tokens
function generateAccessToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

function generateRefreshToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    type: 'refresh',
  };

  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

// Parse expiration time from string (e.g., "15m", "7d")
function parseExpiresIn(expiresIn: string): number {
  const value = parseInt(expiresIn);
  const unit = expiresIn.slice(-1);

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000; // Default 15 minutes
  }
}

/**
 * Register a new user
 */
export async function register(
  data: CreateUserDTO
): Promise<{ user: UserPublic; message: string }> {
  // Check if email exists
  const existingEmail = await db.oneOrNone(
    'SELECT id FROM users WHERE email = $1',
    [data.email.toLowerCase()]
  );

  if (existingEmail) {
    throw new Error('Email already registered');
  }

  // Check if username exists
  const existingUsername = await db.oneOrNone(
    'SELECT id FROM users WHERE username = $1',
    [data.username.toLowerCase()]
  );

  if (existingUsername) {
    throw new Error('Username already taken');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  // Generate verification token
  const verificationToken = uuidv4();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user
  const user = await db.one<User>(
    `INSERT INTO users (
      email, password_hash, username, first_name, last_name,
      verification_token, verification_token_expires
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      data.email.toLowerCase(),
      passwordHash,
      data.username.toLowerCase(),
      data.first_name || null,
      data.last_name || null,
      verificationToken,
      verificationExpires,
    ]
  );

  // Send verification email (async, don't wait)
  sendVerificationEmail(user.email, user.username, verificationToken).catch(
    (err) => {
      logger.error('Failed to send verification email', { error: err });
    }
  );

  logger.info('User registered', { userId: user.id, email: user.email });

  return {
    user: toPublicUser(user),
    message: 'Registration successful. Please check your email to verify your account.',
  };
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<{ user: UserPublic }> {
  const user = await db.oneOrNone<User>(
    `SELECT * FROM users
     WHERE verification_token = $1
     AND verification_token_expires > NOW()
     AND is_verified = false`,
    [token]
  );

  if (!user) {
    throw new Error('Invalid or expired verification token');
  }

  // Update user as verified
  await db.none(
    `UPDATE users SET
      is_verified = true,
      verification_token = NULL,
      verification_token_expires = NULL
     WHERE id = $1`,
    [user.id]
  );

  // Send welcome email
  sendWelcomeEmail(user.email, user.username).catch((err) => {
    logger.error('Failed to send welcome email', { error: err });
  });

  logger.info('Email verified', { userId: user.id });

  return { user: toPublicUser({ ...user, is_verified: true }) };
}

/**
 * Login user
 */
export async function login(
  data: LoginDTO,
  deviceInfo?: string,
  ipAddress?: string
): Promise<{ user: UserPublic; tokens: AuthTokens }> {
  // Find user by email
  const user = await db.oneOrNone<User>(
    'SELECT * FROM users WHERE email = $1',
    [data.email.toLowerCase()]
  );

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Check if user is active
  if (!user.is_active) {
    throw new Error('Account is deactivated');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(data.password, user.password_hash);

  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  // Check if verified (optional, based on requirements)
  if (!user.is_verified) {
    throw new Error('Please verify your email before logging in');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store refresh token
  const refreshExpires = new Date(
    Date.now() + parseExpiresIn(config.jwt.refreshExpiresIn)
  );

  await db.none(
    `INSERT INTO refresh_tokens (user_id, token, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, refreshToken, deviceInfo, ipAddress, refreshExpires]
  );

  // Update last login
  await db.none('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  logger.info('User logged in', { userId: user.id });

  return {
    user: toPublicUser(user),
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    },
  };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ tokens: AuthTokens }> {
  // Verify refresh token
  let decoded: JWTPayload;
  try {
    decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }

  // Check if token exists and not revoked
  const storedToken = await db.oneOrNone(
    `SELECT * FROM refresh_tokens
     WHERE token = $1
     AND revoked_at IS NULL
     AND expires_at > NOW()`,
    [refreshToken]
  );

  if (!storedToken) {
    throw new Error('Refresh token revoked or expired');
  }

  // Get user
  const user = await db.oneOrNone<User>(
    'SELECT * FROM users WHERE id = $1 AND is_active = true',
    [decoded.userId]
  );

  if (!user) {
    throw new Error('User not found or inactive');
  }

  // Generate new access token
  const newAccessToken = generateAccessToken(user);

  return {
    tokens: {
      accessToken: newAccessToken,
      refreshToken, // Return same refresh token
      expiresIn: config.jwt.expiresIn,
    },
  };
}

/**
 * Logout user (revoke refresh token)
 */
export async function logout(refreshToken: string): Promise<void> {
  await db.none(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1',
    [refreshToken]
  );

  logger.info('User logged out');
}

/**
 * Logout all devices (revoke all refresh tokens)
 */
export async function logoutAll(userId: string): Promise<void> {
  await db.none(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );

  logger.info('User logged out from all devices', { userId });
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.oneOrNone<User>(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email.toLowerCase()]
  );

  // Always return success to prevent email enumeration
  if (!user) {
    return;
  }

  // Generate reset token
  const resetToken = uuidv4();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.none(
    `UPDATE users SET
      password_reset_token = $1,
      password_reset_expires = $2
     WHERE id = $3`,
    [resetToken, resetExpires, user.id]
  );

  // Send reset email
  await sendPasswordResetEmail(user.email, user.username, resetToken);

  logger.info('Password reset requested', { userId: user.id });
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const user = await db.oneOrNone<User>(
    `SELECT * FROM users
     WHERE password_reset_token = $1
     AND password_reset_expires > NOW()`,
    [token]
  );

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password and clear reset token
  await db.none(
    `UPDATE users SET
      password_hash = $1,
      password_reset_token = NULL,
      password_reset_expires = NULL
     WHERE id = $2`,
    [passwordHash, user.id]
  );

  // Revoke all refresh tokens (force re-login)
  await logoutAll(user.id);

  logger.info('Password reset successful', { userId: user.id });
}

/**
 * Change password (authenticated)
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await db.oneOrNone<User>('SELECT * FROM users WHERE id = $1', [
    userId,
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await db.none('UPDATE users SET password_hash = $1 WHERE id = $2', [
    passwordHash,
    userId,
  ]);

  logger.info('Password changed', { userId });
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<UserPublic | null> {
  const user = await db.oneOrNone<User>('SELECT * FROM users WHERE id = $1', [
    userId,
  ]);

  return user ? toPublicUser(user) : null;
}

/**
 * Verify JWT token
 */
export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwt.secret) as JWTPayload;
}

export default {
  register,
  verifyEmail,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  requestPasswordReset,
  resetPassword,
  changePassword,
  getUserById,
  verifyAccessToken,
};
