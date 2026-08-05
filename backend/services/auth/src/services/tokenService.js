const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const redisClient = require('./redis');
const config = require('../config/config');
const logger = require('../../../../shared/utils/logger');

class TokenService {
  constructor(client, appConfig) {
    this.redisClient = client;
    this.config = appConfig;
    this.refreshTokenTTLSeconds = 7 * 24 * 60 * 60;
  }

  // Hashes JWT IDs before storing revocation state.
  hashJTI(jti) {
    return crypto.createHash('sha256').update(String(jti)).digest('hex');
  }

  // Generates a short-lived access token with a unique JWT ID.
  generateAccessToken(user) {
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        jti,
      },
      this.config.jwt.secret,
      { expiresIn: this.config.jwt.expiry || '15m' }
    );

    return {
      token,
      jti,
      expiresIn: this.config.jwt.expiry || '15m',
    };
  }

  // Generates a refresh token and stores its hashed JWT ID in Redis.
  async generateRefreshToken(user) {
    const userId = user._id.toString();
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      {
        userId,
        jti,
        type: 'refresh',
      },
      this.config.jwt.refreshSecret,
      { expiresIn: '7d' }
    );

    try {
      await this.redisClient.setEx(
        `refresh:${userId}:${this.hashJTI(jti)}`,
        this.refreshTokenTTLSeconds,
        '1'
      );

      return { token, jti };
    } catch (error) {
      logger.error('Error storing refresh token:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Verifies an access token and rejects blacklisted JWT IDs.
  async verifyAccessToken(token) {
    const decoded = jwt.verify(token, this.config.jwt.secret);

    if (!decoded.jti) {
      throw new Error('INVALID_TOKEN');
    }

    try {
      const isBlacklisted = await this.redisClient.exists(`jwt:blacklist:${decoded.jti}`);
      if (isBlacklisted) {
        throw new Error('TOKEN_REVOKED');
      }

      return decoded;
    } catch (error) {
      if (error.message === 'TOKEN_REVOKED') {
        throw error;
      }

      logger.error('Error checking access token blacklist:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Verifies a refresh token and checks its server-side revocation state.
  async verifyRefreshToken(token) {
    const decoded = jwt.verify(token, this.config.jwt.refreshSecret);

    if (decoded.type !== 'refresh' || !decoded.jti || !decoded.userId) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    try {
      const exists = await this.redisClient.exists(`refresh:${decoded.userId}:${this.hashJTI(decoded.jti)}`);
      if (!exists) {
        throw new Error('REFRESH_REVOKED');
      }

      return decoded;
    } catch (error) {
      if (error.message === 'REFRESH_REVOKED') {
        throw error;
      }

      logger.error('Error checking refresh token state:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Blacklists an access token until its natural expiry.
  async blacklistAccessToken(token, decodedPayload) {
    if (!decodedPayload?.jti || !decodedPayload?.exp) {
      throw new Error('INVALID_TOKEN');
    }

    const ttl = Math.max(decodedPayload.exp - Math.floor(Date.now() / 1000), 0);
    if (ttl === 0) {
      return;
    }

    try {
      await this.redisClient.setEx(`jwt:blacklist:${decodedPayload.jti}`, ttl, token);
    } catch (error) {
      logger.error('Error blacklisting access token:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Revokes a refresh token by deleting its Redis entry.
  async revokeRefreshToken(userId, jti) {
    try {
      await this.redisClient.del(`refresh:${userId}:${this.hashJTI(jti)}`);
    } catch (error) {
      logger.error('Error revoking refresh token:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }
}

module.exports = new TokenService(redisClient, config);
