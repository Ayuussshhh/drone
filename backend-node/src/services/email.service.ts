/**
 * Email Service
 * SMTP email sending with Nodemailer
 */

import nodemailer from 'nodemailer';
import config from '../config';
import logger from '../config/logger';

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.password,
  },
});

// Verify connection on startup
transporter.verify((error) => {
  if (error) {
    logger.warn('SMTP connection failed', { error: error.message });
  } else {
    logger.info('SMTP server ready');
  }
});

// Email templates
interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function getVerificationEmailTemplate(
  username: string,
  verificationLink: string
): EmailTemplate {
  return {
    subject: 'Verify Your Email - Drone Simulation Platform',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #00d4ff; color: #1a1a2e; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Drone Simulation Platform</h1>
          </div>
          <div class="content">
            <h2>Welcome, ${username}!</h2>
            <p>Thank you for registering with the Drone Simulation Platform. To complete your registration and start building amazing drones, please verify your email address.</p>
            <p style="text-align: center;">
              <a href="${verificationLink}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${verificationLink}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Drone Simulation Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Welcome to Drone Simulation Platform, ${username}!

Please verify your email address by clicking the link below:
${verificationLink}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.
    `,
  };
}

function getPasswordResetEmailTemplate(
  username: string,
  resetLink: string
): EmailTemplate {
  return {
    subject: 'Reset Your Password - Drone Simulation Platform',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #ff6b6b; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello, ${username}</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${resetLink}</p>
            <p>This link will expire in 1 hour.</p>
            <div class="warning">
              <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2024 Drone Simulation Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hello, ${username}

We received a request to reset your password.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.
    `,
  };
}

function getWelcomeEmailTemplate(username: string): EmailTemplate {
  return {
    subject: 'Welcome to Drone Simulation Platform!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #00d4ff; }
          .button { display: inline-block; padding: 15px 30px; background: #00d4ff; color: #1a1a2e; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome Aboard!</h1>
          </div>
          <div class="content">
            <h2>Hi ${username},</h2>
            <p>Your email has been verified! You're now ready to start building and simulating drones.</p>

            <h3>What you can do:</h3>
            <div class="feature">
              <strong>Build Custom Drones</strong><br>
              Design drones using our library of professional components
            </div>
            <div class="feature">
              <strong>Real-time Simulation</strong><br>
              Test your designs with accurate physics simulation
            </div>
            <div class="feature">
              <strong>3D Visualization</strong><br>
              See your creations in stunning 3D with Three.js
            </div>
            <div class="feature">
              <strong>Physics Analysis</strong><br>
              Get detailed metrics on thrust, stability, and efficiency
            </div>

            <p style="text-align: center;">
              <a href="${config.frontendUrl}/dashboard" class="button">Go to Dashboard</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Drone Simulation Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Welcome to Drone Simulation Platform, ${username}!

Your email has been verified. You can now:
- Build custom drones with professional components
- Run real-time physics simulations
- Visualize designs in 3D
- Get detailed metrics and analysis

Get started at: ${config.frontendUrl}/dashboard
    `,
  };
}

// Email sending functions
export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string
): Promise<boolean> {
  const verificationLink = `${config.frontendUrl}/verify-email?token=${token}`;
  const template = getVerificationEmailTemplate(username, verificationLink);

  try {
    await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    logger.info('Verification email sent', { email });
    return true;
  } catch (error: any) {
    logger.error('Failed to send verification email', {
      email,
      error: error.message,
    });
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  username: string,
  token: string
): Promise<boolean> {
  const resetLink = `${config.frontendUrl}/reset-password?token=${token}`;
  const template = getPasswordResetEmailTemplate(username, resetLink);

  try {
    await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    logger.info('Password reset email sent', { email });
    return true;
  } catch (error: any) {
    logger.error('Failed to send password reset email', {
      email,
      error: error.message,
    });
    return false;
  }
}

export async function sendWelcomeEmail(
  email: string,
  username: string
): Promise<boolean> {
  const template = getWelcomeEmailTemplate(username);

  try {
    await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    logger.info('Welcome email sent', { email });
    return true;
  } catch (error: any) {
    logger.error('Failed to send welcome email', {
      email,
      error: error.message,
    });
    return false;
  }
}

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
