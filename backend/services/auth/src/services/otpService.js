const crypto = require('crypto');
const config = require('../config/config');
const redisClient = require('./redis');
const logger = require('../../../../shared/utils/logger');

class OTPService {
  // Hashes an OTP before storage or comparison.
  hashOTP(otp) {
    return crypto.createHash('sha256').update(String(otp)).digest('hex');
  }

  // Generates a cryptographically secure numeric OTP.
  generateOTP() {
    const length = config.otp.length;
    const min = 10 ** (length - 1);
    const max = 10 ** length;

    return crypto.randomInt(min, max).toString();
  }

  // Stores a hashed OTP in Redis with an expiry.
  async storeOTP(email, otp) {
    try {
      const key = `otp:${email}`;
      const expirySeconds = config.otp.expiryMinutes * 60;
      const otpHash = this.hashOTP(otp);

      await redisClient.setEx(key, expirySeconds, otpHash);

      logger.info(`OTP stored for ${email}, expires in ${config.otp.expiryMinutes} minutes`);
      return { success: true };
    } catch (error) {
      logger.error('Error storing OTP:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Verifies a candidate OTP against the stored OTP hash.
  async verifyOTP(email, otp) {
    try {
      const key = `otp:${email}`;
      const storedOTPHash = await redisClient.get(key);

      if (!storedOTPHash) {
        return {
          success: false,
          message: 'OTP expired or not found'
        };
      }

      if (storedOTPHash !== this.hashOTP(otp)) {
        return {
          success: false,
          message: 'Invalid OTP'
        };
      }

      await redisClient.del(key);

      logger.info(`OTP verified successfully for ${email}`);
      return {
        success: true,
        message: 'OTP verified successfully'
      };
    } catch (error) {
      logger.error('Error verifying OTP:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Increments the per-email OTP attempt counter with a 15-minute TTL.
  async incrementOTPAttempts(email) {
    try {
      const key = `otp:attempts:${email}`;
      const results = await redisClient
        .multi()
        .incr(key)
        .expire(key, 15 * 60)
        .exec();
      const attempts = Array.isArray(results?.[0]) ? results[0][1] : results[0];

      return attempts;
    } catch (error) {
      logger.error('Error incrementing OTP attempts:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Reads the per-email OTP attempt counter.
  async getOTPAttempts(email) {
    try {
      const key = `otp:attempts:${email}`;
      const attempts = await redisClient.get(key);

      return attempts ? parseInt(attempts, 10) : 0;
    } catch (error) {
      logger.error('Error reading OTP attempts:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Clears the per-email OTP attempt counter.
  async clearOTPAttempts(email) {
    try {
      const key = `otp:attempts:${email}`;
      await redisClient.del(key);

      return { success: true };
    } catch (error) {
      logger.error('Error clearing OTP attempts:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Deletes an OTP from Redis.
  async deleteOTP(email) {
    try {
      const key = `otp:${email}`;
      await redisClient.del(key);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting OTP:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }

  // Checks whether an OTP exists for an email.
  async otpExists(email) {
    try {
      const key = `otp:${email}`;
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Error checking OTP existence:', error);
      throw new Error('REDIS_UNAVAILABLE');
    }
  }
}

module.exports = new OTPService();
