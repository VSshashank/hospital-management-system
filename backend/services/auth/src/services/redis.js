const redis = require('redis');
const config = require('../config/config');
const logger = require('../../../../shared/utils/logger');

const redisClient = redis.createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
});

redisClient.on('error', (error) => {
  logger.error('Redis Client Error:', error);
});

redisClient.on('connect', () => {
  logger.info('Redis connected successfully');
});

// Opens the shared Redis connection once for all auth services.
const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
  }
};

connectRedis();

module.exports = redisClient;
