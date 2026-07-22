const User = require('../models/User');
const otpService = require('../services/otpService');
const emailService = require('../services/emailService');
const tokenService = require('../services/tokenService');
const config = require('../config/config');
const logger = require('../../../../shared/utils/logger');

class AuthController {
  // Extracts the bearer token from the Authorization header.
  getBearerToken(req) {
    const authHeader = req.headers.authorization;
    return authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  }

  // Sends a 503 response when a required Redis security check cannot run.
  handleRedisFailure(error, res) {
    if (error.message === 'REDIS_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Security service temporarily unavailable. Please try again.'
      });
    }

    return null;
  }

  // Increments failed login attempts atomically and locks accounts after 5 failures.
  async recordFailedLoginAttempt(user, email) {
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { failedLoginAttempts: 1 } },
      { new: true }
    );

    if (updatedUser.failedLoginAttempts >= 5) {
      updatedUser.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      await updatedUser.save({ validateBeforeSave: false });
      logger.warn(`Account locked after 5 failed attempts: ${email}`);
    }

    return updatedUser.failedLoginAttempts;
  }

  /**
   * REGISTER NEW USER
   * POST /api/auth/register
   */
  async register(req, res) {
    try {
      const { email, password, role, fullName, walletAddress } = req.body;

      logger.info(`Registration attempt for: ${email}`);

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        logger.warn(`Registration failed: Email already exists - ${email}`);
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      const user = new User({
        email: email.toLowerCase(),
        fullName: fullName || '',
        passwordHash: password,
        role: role || 'patient',
        walletAddress: walletAddress || null,
      });

      await user.save();

      logger.info(`New user registered: ${email} (${user.role})`);

      emailService.sendWelcomeEmail(email, fullName || 'User', user.role)
        .catch(err => logger.error('Failed to send welcome email:', err));

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: user.toJSON(),
        }
      });

    } catch (error) {
      logger.error('Registration error:', error);

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.',
        error: config.nodeEnv === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * REQUEST OTP FOR LOGIN
   * POST /api/auth/login
   */
  async requestOTP(req, res) {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.toLowerCase();

      logger.info(`Login attempt for: ${normalizedEmail}`);

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        logger.warn(`Login failed: User not found - ${normalizedEmail}`);
        return res.status(404).json({
          success: false,
          message: 'User not found. Please register first.'
        });
      }

      if (user.isAccountLocked()) {
        logger.warn(`Login blocked: Account locked - ${normalizedEmail}`);
        return res.status(403).json({
          success: false,
          message: 'Account is locked due to too many failed attempts. Please try again later.'
        });
      }

      if (!user.isActive) {
        logger.warn(`Login blocked: Account deactivated - ${normalizedEmail}`);
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact administrator.'
        });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        const failedAttempts = await this.recordFailedLoginAttempt(user, normalizedEmail);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          attemptsRemaining: Math.max(0, 5 - failedAttempts)
        });
      }

      const otpAttempts = await otpService.getOTPAttempts(normalizedEmail);
      if (otpAttempts >= 10) {
        return res.status(429).json({
          success: false,
          message: 'Too many OTP requests. Try again in 15 minutes.'
        });
      }

      const otp = otpService.generateOTP();

      await otpService.storeOTP(normalizedEmail, otp);
      await emailService.sendOTP(normalizedEmail, otp, user.role);
      await otpService.incrementOTPAttempts(normalizedEmail);

      logger.info(`OTP sent to ${normalizedEmail}`);

      return res.status(200).json({
        success: true,
        message: 'OTP sent to your email successfully',
        data: {
          email: normalizedEmail,
          expiresIn: `${config.otp.expiryMinutes} minutes`
        }
      });

    } catch (error) {
      const redisResponse = this.handleRedisFailure(error, res);
      if (redisResponse) {
        return redisResponse;
      }

      logger.error('OTP request error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP. Please try again.',
        error: config.nodeEnv === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * VERIFY OTP AND LOGIN
   * POST /api/auth/verify-otp
   */
  async verifyOTP(req, res) {
    try {
      const { email, otp } = req.body;
      const normalizedEmail = email.toLowerCase();

      logger.info(`OTP verification attempt for: ${normalizedEmail}`);

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const otpAttempts = await otpService.getOTPAttempts(normalizedEmail);
      if (otpAttempts >= 10) {
        return res.status(429).json({
          success: false,
          message: 'Too many OTP attempts. Try again in 15 minutes.'
        });
      }

      const otpResult = await otpService.verifyOTP(normalizedEmail, otp);

      if (!otpResult.success) {
        const attempts = await otpService.incrementOTPAttempts(normalizedEmail);
        const failedAttempts = await this.recordFailedLoginAttempt(user, normalizedEmail);

        logger.warn(`OTP verification failed for ${normalizedEmail}: ${otpResult.message}`);

        return res.status(401).json({
          success: false,
          message: otpResult.message,
          attemptsRemaining: Math.max(0, Math.min(5 - failedAttempts, 10 - attempts))
        });
      }

      await otpService.clearOTPAttempts(normalizedEmail);

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            failedLoginAttempts: 0,
            accountLockedUntil: null,
            lastLogin: new Date(),
            isVerified: true,
          }
        }
      );

      const updatedUser = await User.findById(user._id);
      const accessToken = tokenService.generateAccessToken(updatedUser);
      const refreshToken = await tokenService.generateRefreshToken(updatedUser);
      const refreshTokenJtiHash = tokenService.hashJTI(refreshToken.jti);

      await User.updateOne(
        { _id: updatedUser._id },
        {
          $push: {
            refreshTokens: {
              $each: [refreshTokenJtiHash],
              $slice: -5,
            }
          }
        }
      );

      res.cookie('refreshToken', refreshToken.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      logger.info(`User logged in successfully: ${normalizedEmail}`);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: updatedUser.toJSON(),
          token: accessToken.token,
          expiresIn: accessToken.expiresIn
        }
      });

    } catch (error) {
      const redisResponse = this.handleRedisFailure(error, res);
      if (redisResponse) {
        return redisResponse;
      }

      logger.error('OTP verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'OTP verification failed. Please try again.',
        error: config.nodeEnv === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET CURRENT USER INFO
   * GET /api/auth/me
   */
  async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      logger.info(`User info retrieved: ${user.email}`);

      return res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
          trustScore: req.trustScore
        }
      });

    } catch (error) {
      logger.error('Get current user error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get user information',
        error: config.nodeEnv === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * LOGOUT
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      const token = this.getBearerToken(req);
      if (token) {
        await tokenService.blacklistAccessToken(token, req.user);
      }

      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        try {
          const decodedRefreshToken = await tokenService.verifyRefreshToken(refreshToken);
          await tokenService.revokeRefreshToken(decodedRefreshToken.userId, decodedRefreshToken.jti);
          await User.updateOne(
            { _id: decodedRefreshToken.userId },
            { $pull: { refreshTokens: tokenService.hashJTI(decodedRefreshToken.jti) } }
          );
        } catch (error) {
          if (error.message === 'REDIS_UNAVAILABLE') {
            throw error;
          }

          logger.warn('Refresh token was not revoked during logout:', error.message);
        }
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      });

      logger.info(`User logged out: ${req.user.email}`);

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      const redisResponse = this.handleRedisFailure(error, res);
      if (redisResponse) {
        return redisResponse;
      }

      logger.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: config.nodeEnv === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * REFRESH TOKEN
   * POST /api/auth/refresh
   */
  async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      const decoded = await tokenService.verifyRefreshToken(refreshToken);

      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account deactivated'
        });
      }

      const accessToken = tokenService.generateAccessToken(user);

      logger.info(`Token refreshed for: ${user.email}`);

      return res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: accessToken.token,
          expiresIn: accessToken.expiresIn
        }
      });

    } catch (error) {
      const redisResponse = this.handleRedisFailure(error, res);
      if (redisResponse) {
        return redisResponse;
      }

      logger.error('Token refresh error:', error);

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Refresh token expired. Please login again.'
        });
      }

      if (
        error.name === 'JsonWebTokenError' ||
        error.message === 'INVALID_REFRESH_TOKEN' ||
        error.message === 'REFRESH_REVOKED'
      ) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Token refresh failed',
        error: config.nodeEnv === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * CHANGE PASSWORD
   * POST /api/auth/change-password
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        const failedAttempts = await this.recordFailedLoginAttempt(user, user.email);
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
          attemptsRemaining: Math.max(0, 5 - failedAttempts)
        });
      }

      user.passwordHash = newPassword;
      user.failedLoginAttempts = 0;
      user.accountLockedUntil = null;
      await user.save();

      logger.info(`Password changed for: ${user.email}`);

      return res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: config.nodeEnv === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new AuthController();
