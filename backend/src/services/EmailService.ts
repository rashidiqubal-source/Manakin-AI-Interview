import nodemailer from 'nodemailer';
import { logger } from '../config/logger';
import { env } from '../config/env';

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static async getTransporter() {
    if (this.transporter) return this.transporter;

    const username = env.MAILERO_USERNAME;
    const password = env.MAILERO_PASSWORD || env.MAILERO_SENDING_KEY;

    if (username && password) {
      this.transporter = nodemailer.createTransport({
        host: env.MAILERO_HOST,
        port: parseInt(env.MAILERO_PORT, 10),
        secure: parseInt(env.MAILERO_PORT, 10) === 465,
        auth: {
          user: username,
          pass: password,
        },
      });
      logger.info('Using Mailero configuration for emails.');
      return this.transporter;
    }

    // Use Ethereal mock email for development
    try {
      logger.warn('No Mailero variables found in .env, falling back to Ethereal mock email testing service.');
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      return this.transporter;
    } catch (err) {
      logger.error('Failed to create mock email account', err);
      throw err;
    }
  }

  static async sendDecisionEmail(to: string, status: 'ACCEPTED' | 'REJECTED', name: string) {
    const transporter = await this.getTransporter();
    
    let subject = '';
    let htmlContent = '';

    if (status === 'ACCEPTED') {
      subject = '🎉 AI Interview Update: Selected for Next Round!';
      htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0d9488;">
            <span style="background-color: #ccfbf1; color: #0f766e; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 14px;">🤖 AI Interview Platform</span>
            <h2 style="color: #0f766e; margin-top: 12px; font-size: 22px;">Congratulations, ${name}!</h2>
          </div>
          <div style="line-height: 1.7; color: #374151; font-size: 15px;">
            <p>We are excited to let you know that you passed your automated AI voice screening interview for the <strong>Tutor Role</strong>.</p>
            <p>Our AI evaluation engine assessed your communication clarity, pedagogical approach, patience, and fluency, and your results were outstanding!</p>
            <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px; margin: 20px 0; border-radius: 6px;">
              <strong style="color: #15803d;">Next Steps:</strong>
              <p style="margin: 4px 0 0 0; color: #166534;">Our hiring team is reviewing your assessment analytics. We will follow up shortly to schedule your final round.</p>
            </div>
            <p>Thank you for taking the time to interview on our platform.</p>
          </div>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f3f4f6; text-align: center; color: #6b7280; font-size: 13px;">
            <p style="margin: 0;">Best regards,</p>
            <p style="margin: 4px 0 0 0; font-weight: 600; color: #111827;">The AI Interview Recruitment Team</p>
          </div>
        </div>
      `;
    } else {
      subject = 'AI Interview Update: Application Status';
      htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #6b7280;">
            <span style="background-color: #f3f4f6; color: #4b5563; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 14px;">🤖 AI Interview Platform</span>
            <h2 style="color: #1f2937; margin-top: 12px; font-size: 22px;">Dear ${name},</h2>
          </div>
          <div style="line-height: 1.7; color: #374151; font-size: 15px;">
            <p>Thank you for completing the voice screening interview on our <strong>AI Interview Platform</strong>.</p>
            <p>Our evaluation team has thoroughly reviewed your interview assessment. While we appreciate your time and effort, we will not be moving forward with your candidacy for this specific role at this time.</p>
            <p>We encourage you to apply for future opportunities as new positions open up.</p>
          </div>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f3f4f6; text-align: center; color: #6b7280; font-size: 13px;">
            <p style="margin: 0;">Best regards,</p>
            <p style="margin: 4px 0 0 0; font-weight: 600; color: #111827;">The AI Interview Recruitment Team</p>
          </div>
        </div>
      `;
    }

    try {
      const info = await transporter.sendMail({
        from: env.MAILERO_FROM,
        to,
        subject,
        html: htmlContent,
      });

      logger.info(`Decision email sent to ${to}. Status: ${status}`);
      if (!env.MAILERO_USERNAME || !(env.MAILERO_PASSWORD || env.MAILERO_SENDING_KEY)) {
        logger.info(`Preview Mock Email URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (err) {
      logger.error(`Failed to send email to ${to}:`, err);
    }
  }

  static async sendInvitationEmail(to: string, jobTitle: string, inviteToken: string) {
    const transporter = await this.getTransporter();
    const interviewLink = `${env.FRONTEND_URL}/invite/${inviteToken}`;
    
    const subject = `🎉 Congratulations! You have been shortlisted for ${jobTitle}`;
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0d9488;">
          <span style="background-color: #ccfbf1; color: #0f766e; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 14px;">🤖 AI Interview Platform</span>
          <h2 style="color: #0f766e; margin-top: 12px; font-size: 22px;">Congratulations! You have been shortlisted for the next round.</h2>
        </div>
        <div style="line-height: 1.7; color: #374151; font-size: 15px;">
          <p>We are pleased to inform you that your application for the <strong>${jobTitle}</strong> position has been reviewed by our recruitment team, and you have been selected to move forward to the AI Voice Interview round.</p>
          <div style="background-color: #f0fdf4; border-left: 4px solid #0d9488; padding: 16px; margin: 24px 0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 12px 0; color: #0f766e; font-weight: 600;">Your Unique Interview Link:</p>
            <a href="${interviewLink}" style="display: inline-block; background-color: #0d9488; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; shadow: 0 4px 6px rgba(0,0,0,0.1);">
              Start AI Interview &rarr;
            </a>
          </div>
          <p style="font-size: 13px; color: #6b7280; text-align: center;">
            Or copy and paste this URL into your browser:<br />
            <a href="${interviewLink}" style="color: #0d9488;">${interviewLink}</a>
          </p>
          <p style="margin-top: 20px;">You will be asked to upload your resume and complete a dynamic, AI-driven voice interview.</p>
        </div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f3f4f6; text-align: center; color: #6b7280; font-size: 13px;">
          <p style="margin: 0;">Best regards,</p>
          <p style="margin: 4px 0 0 0; font-weight: 600; color: #111827;">The AI Recruitment Team</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: env.MAILERO_FROM,
        to,
        subject,
        html: htmlContent,
      });

      logger.info(`Invitation email sent to ${to} for job "${jobTitle}". Token: ${inviteToken}`);
      if (!env.MAILERO_USERNAME || !(env.MAILERO_PASSWORD || env.MAILERO_SENDING_KEY)) {
        logger.info(`Preview Mock Email URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (err) {
      logger.error(`Failed to send invitation email to ${to}:`, err);
    }
  }

  static async sendVerificationEmail(to: string, token: string, name?: string) {
    const transporter = await this.getTransporter();
    const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
    const recipientName = name || 'there';

    const subject = '✉️ Verify Your AI Interview Account Email';
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0d9488;">
          <span style="background-color: #ccfbf1; color: #0f766e; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 14px;">🤖 AI Interview Platform</span>
          <h2 style="color: #0f766e; margin-top: 12px; font-size: 22px;">Welcome, ${recipientName}!</h2>
        </div>
        <div style="line-height: 1.7; color: #374151; font-size: 15px;">
          <p>Thank you for registering on the <strong>AI Interview Platform</strong>. Please confirm your email address to verify your account and activate full access.</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${verificationUrl}" style="display: inline-block; background-color: #0d9488; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
              Verify Email Address &rarr;
            </a>
          </div>
          <p style="font-size: 13px; color: #6b7280; text-align: center;">
            Or copy and paste this verification URL into your browser:<br />
            <a href="${verificationUrl}" style="color: #0d9488;">${verificationUrl}</a>
          </p>
          <p style="margin-top: 20px; font-size: 13px; color: #9ca3af;">This verification link will expire in 24 hours. If you did not create this account, you can safely ignore this email.</p>
        </div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f3f4f6; text-align: center; color: #6b7280; font-size: 13px;">
          <p style="margin: 0;">Best regards,</p>
          <p style="margin: 4px 0 0 0; font-weight: 600; color: #111827;">The AI Recruitment Platform Security Team</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: env.MAILERO_FROM,
        to,
        subject,
        html: htmlContent,
      });

      logger.info(`Verification email sent to ${to}`);
      if (!env.MAILERO_USERNAME || !(env.MAILERO_PASSWORD || env.MAILERO_SENDING_KEY)) {
        logger.info(`Preview Mock Email URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (err) {
      logger.error(`Failed to send verification email to ${to}:`, err);
    }
  }

  static async sendPasswordResetEmail(to: string, token: string, name?: string) {
    const transporter = await this.getTransporter();
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
    const recipientName = name || 'User';

    const subject = '🔒 Reset Your AI Interview Account Password';
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #ef4444;">
          <span style="background-color: #fee2e2; color: #991b1b; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 14px;">🔒 Security Alert</span>
          <h2 style="color: #111827; margin-top: 12px; font-size: 22px;">Password Reset Request</h2>
        </div>
        <div style="line-height: 1.7; color: #374151; font-size: 15px;">
          <p>Hello ${recipientName},</p>
          <p>We received a request to reset the password for your account. Click the button below to choose a new, strong password:</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
              Reset Password &rarr;
            </a>
          </div>
          <p style="font-size: 13px; color: #6b7280; text-align: center;">
            Or copy and paste this link into your browser:<br />
            <a href="${resetUrl}" style="color: #ef4444;">${resetUrl}</a>
          </p>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 24px 0; border-radius: 6px;">
            <p style="margin: 0; font-size: 13px; color: #991b1b;">
              <strong>Security notice:</strong> This password reset link expires in 1 hour. If you did not request a password reset, please ignore this email or change your account security settings.
            </p>
          </div>
        </div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f3f4f6; text-align: center; color: #6b7280; font-size: 13px;">
          <p style="margin: 0;">Best regards,</p>
          <p style="margin: 4px 0 0 0; font-weight: 600; color: #111827;">The AI Recruitment Platform Security Team</p>
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: env.MAILERO_FROM,
        to,
        subject,
        html: htmlContent,
      });

      logger.info(`Password reset email sent to ${to}`);
      if (!env.MAILERO_USERNAME || !(env.MAILERO_PASSWORD || env.MAILERO_SENDING_KEY)) {
        logger.info(`Preview Mock Email URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (err) {
      logger.error(`Failed to send password reset email to ${to}:`, err);
    }
  }
}

