/**
 * User Model and Types
 */

export interface User {
  id: string;
  email: string;
  password_hash: string;
  username: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  is_verified: boolean;
  is_active: boolean;
  role: 'user' | 'admin' | 'moderator';
  verification_token?: string;
  verification_token_expires?: Date;
  password_reset_token?: string;
  password_reset_expires?: Date;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  is_verified: boolean;
  role: string;
  created_at: Date;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  username: string;
  first_name?: string;
  last_name?: string;
}

export interface UpdateUserDTO {
  username?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token: string;
  device_info?: string;
  ip_address?: string;
  expires_at: Date;
  created_at: Date;
  revoked_at?: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

// Helper to convert User to public user (remove sensitive data)
export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    profile_image_url: user.profile_image_url,
    is_verified: user.is_verified,
    role: user.role,
    created_at: user.created_at,
  };
}
