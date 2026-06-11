const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../../../../shared/utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: config.email.service,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
    
    // Verify transporter configuration
    this.transporter.verify((error, success) => {
      if (error) {
        logger.error('❌ Email transporter verification failed:', error);
      } else {
        logger.info('✅ Email service is ready to send messages');
      }
    });
  }
  
  /**
   * Send OTP email
   */
  async sendOTP(email, otp, name = 'User') {
    try {
      const mailOptions = {
        from: config.email.from,
        to: email,
        subject: '🔐 Your Healthcare System Login OTP',
        html: this.getOTPEmailTemplate(otp, name),
      };
      
      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info(`✅ OTP email sent to ${email}: ${info.messageId}`);
      return { 
        success: true, 
        messageId: info.messageId 
      };
    } catch (error) {
      logger.error('❌ Error sending OTP email:', error);
      throw new Error('Failed to send OTP email');
    }
  }
  
  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, name, role) {
    try {
      const mailOptions = {
        from: config.email.from,
        to: email,
        subject: '🎉 Welcome to Healthcare Blockchain System',
        html: this.getWelcomeEmailTemplate(name, role),
      };
      
      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info(`✅ Welcome email sent to ${email}: ${info.messageId}`);
      return { 
        success: true, 
        messageId: info.messageId 
      };
    } catch (error) {
      logger.error('❌ Error sending welcome email:', error);
      // Don't throw error for welcome email failure
      return { success: false };
    }
  }
  
  /**
   * OTP Email Template
   */
  getOTPEmailTemplate(otp, name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            padding: 40px 30px;
          }
          .otp-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 36px;
            font-weight: bold;
            padding: 25px;
            text-align: center;
            border-radius: 10px;
            letter-spacing: 8px;
            margin: 30px 0;
            font-family: 'Courier New', monospace;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .warning strong {
            color: #856404;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 Healthcare System</h1>
            <p style="margin: 5px 0 0 0;">Secure Login Verification</p>
          </div>
          
          <div class="content">
            <h2 style="color: #333;">Hello ${name}! 👋</h2>
            <p style="color: #666; line-height: 1.6;">
              You requested to login to your Healthcare System account. 
              Please use this One-Time Password (OTP) to complete your login:
            </p>
            
            <div class="otp-box">${otp}</div>
            
            <p style="text-align: center; color: #666;">
              <strong>⏰ This OTP will expire in ${config.otp.expiryMinutes} minutes.</strong>
            </p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>Never share your OTP with anyone</li>
                <li>Our team will never ask for your OTP</li>
                <li>This OTP can only be used once</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>
            
            <p style="color: #666; margin-top: 30px;">
              Best regards,<br>
              <strong>Healthcare System Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 5px 0;">This is an automated message. Please do not reply.</p>
            <p style="margin: 5px 0;">&copy; 2026 Healthcare Blockchain System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  /**
   * Welcome Email Template
   */
  getWelcomeEmailTemplate(name, role) {
    const roleFeatures = {
      patient: [
        '📋 View and manage your medical records',
        '🔐 Grant/revoke access to doctors',
        '📅 Schedule appointments',
        '📊 Track your health history'
      ],
      doctor: [
        '👥 Access patient records (with consent)',
        '📝 Create and update medical records',
        '📅 Manage appointments',
        '🔍 View patient history'
      ],
      admin: [
        '👥 Manage users and roles',
        '📊 View system analytics',
        '⛓️ Monitor blockchain transactions',
        '📈 Generate reports'
      ],
      insurance: [
        '💼 Process insurance claims',
        '✅ Verify medical records',
        '📊 Track claim status',
        '📈 Generate reports'
      ]
    };
    
    const features = roleFeatures[role] || roleFeatures.patient;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 32px;
          }
          .content {
            padding: 40px 30px;
          }
          .role-badge {
            display: inline-block;
            padding: 8px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px;
            font-size: 14px;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: 1px;
            margin: 10px 0;
          }
          .features {
            background-color: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
          }
          .features ul {
            list-style: none;
            padding: 0;
          }
          .features li {
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
          }
          .features li:last-child {
            border-bottom: none;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome Aboard!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Your Healthcare Journey Starts Here</p>
          </div>
          
          <div class="content">
            <h2 style="color: #333;">Hello ${name}! 👋</h2>
            <p style="color: #666; line-height: 1.6;">
              Your account has been successfully created! We're excited to have you join our Healthcare Blockchain System.
            </p>
            
            <p style="color: #666;">
              Your account role: <span class="role-badge">${role}</span>
            </p>
            
            <div class="features">
              <h3 style="color: #333; margin-top: 0;">✨ What you can do:</h3>
              <ul>
                ${features.map(feature => `<li>${feature}</li>`).join('')}
              </ul>
            </div>
            
            <p style="color: #666; line-height: 1.6;">
              You can now login to your dashboard and start exploring all the features available to you.
            </p>
            
            <p style="color: #666; margin-top: 30px;">
              If you have any questions or need assistance, feel free to reach out to our support team.
            </p>
            
            <p style="color: #666; margin-top: 30px;">
              Best regards,<br>
              <strong>Healthcare System Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 5px 0;">This is an automated message. Please do not reply.</p>
            <p style="margin: 5px 0;">&copy; 2026 Healthcare Blockchain System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();