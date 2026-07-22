const tokenService = require('../services/tokenService');
const redisClient = require('../services/redis');
const trustService = require('../services/trustService');
const auditService = require('../services/auditService');
const User = require('../models/User');
const logger = require('../../../../shared/utils/logger');

/**
 * Verify JWT token and authenticate user
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await auditService.recordAccessDecision({
        req,
        decision: 'deny',
        reason: 'missing_token',
      });

      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided. Please login.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      await auditService.recordAccessDecision({
        req,
        decision: 'deny',
        reason: 'invalid_token_format',
      });

      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    const decoded = await tokenService.verifyAccessToken(token);
    const activeCacheKey = `session:active:${decoded.userId}`;
    let sessionState = null;

    let cachedSession = null;
    try {
      cachedSession = await redisClient.get(activeCacheKey);
    } catch (error) {
      logger.error('Error checking session active cache:', error);
      await auditService.recordAccessDecision({
        req,
        userId: decoded.userId,
        decision: 'deny',
        reason: 'session_cache_unavailable',
      });

      return res.status(503).json({
        success: false,
        message: 'Security service temporarily unavailable. Please try again.'
      });
    }

    if (cachedSession) {
      try {
        sessionState = JSON.parse(cachedSession);
      } catch (error) {
        logger.error('Error parsing session active cache:', error);
      }
    }

    if (!sessionState) {
      const user = await User.findById(decoded.userId).select('isActive isVerified failedLoginAttempts');
      if (!user || !user.isActive) {
        await auditService.recordAccessDecision({
          req,
          userId: decoded.userId,
          decision: 'deny',
          reason: 'account_deactivated',
        });

        return res.status(401).json({
          success: false,
          message: 'Account deactivated'
        });
      }

      sessionState = {
        isActive: user.isActive,
        isVerified: user.isVerified,
        failedLoginAttempts: user.failedLoginAttempts || 0,
      };

      try {
        await redisClient.setEx(
          activeCacheKey,
          5 * 60,
          JSON.stringify(sessionState)
        );
      } catch (error) {
        logger.error('Error storing session active cache:', error);
        await auditService.recordAccessDecision({
          req,
          userId: decoded.userId,
          decision: 'deny',
          reason: 'session_cache_unavailable',
        });

        return res.status(503).json({
          success: false,
          message: 'Security service temporarily unavailable. Please try again.'
        });
      }
    }

    req.user = decoded;
    req.sessionState = sessionState;
    req.trustScore = trustService.calculateTrustScore(req, decoded, sessionState);

    if (req.trustScore.score < req.trustScore.minScore) {
      await auditService.recordAccessDecision({
        req,
        userId: decoded.userId,
        decision: 'deny',
        reason: 'low_trust_score',
        trustScore: req.trustScore.score,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. Additional verification required.',
        trustScore: req.trustScore.score
      });
    }

    logger.info(`User authenticated: ${decoded.email} (${decoded.role})`);

    await auditService.recordAccessDecision({
      req,
      userId: decoded.userId,
      decision: 'allow',
      reason: 'authenticated',
      trustScore: req.trustScore.score,
    });

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      await auditService.recordAccessDecision({
        req,
        decision: 'deny',
        reason: 'token_expired',
      });

      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
        error: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError' || error.message === 'INVALID_TOKEN') {
      await auditService.recordAccessDecision({
        req,
        decision: 'deny',
        reason: 'invalid_token',
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
        error: 'INVALID_TOKEN'
      });
    }

    if (error.message === 'TOKEN_REVOKED') {
      await auditService.recordAccessDecision({
        req,
        decision: 'deny',
        reason: 'token_revoked',
      });

      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please login again.',
        error: 'TOKEN_REVOKED'
      });
    }

    if (error.message === 'REDIS_UNAVAILABLE') {
      await auditService.recordAccessDecision({
        req,
        decision: 'deny',
        reason: 'redis_unavailable',
      });

      return res.status(503).json({
        success: false,
        message: 'Security service temporarily unavailable. Please try again.'
      });
    }

    logger.error('Auth middleware error:', error);
    await auditService.recordAccessDecision({
      req,
      decision: 'deny',
      reason: 'auth_middleware_error',
    });

    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Check if user has specific role(s)
 * Usage: requireRole('admin', 'doctor', { minTrustScore: 70, timeWindow: [8, 20] })
 */
const requireRole = (...allowedRoles) => {
  const policyOptions = typeof allowedRoles[allowedRoles.length - 1] === 'object'
    ? allowedRoles.pop()
    : {};

  return async (req, res, next) => {
    if (!req.user) {
      await auditService.recordAccessDecision({
        req,
        decision: 'deny',
        reason: 'not_authenticated',
      });

      return res.status(401).json({
        success: false,
        message: 'Not authenticated. Please login first.'
      });
    }

    const policyResult = trustService.evaluatePolicy(req, allowedRoles, policyOptions);

    if (!policyResult.allowed) {
      logger.warn(`Access denied for ${req.user.email}: ${policyResult.reason}`);

      await auditService.recordAccessDecision({
        req,
        userId: req.user.userId,
        decision: 'deny',
        reason: policyResult.reason,
        trustScore: req.trustScore?.score,
      });

      return res.status(policyResult.status).json({
        success: false,
        message: policyResult.message,
        requiredRole: allowedRoles,
        currentRole: req.user.role,
        trustScore: req.trustScore?.score
      });
    }

    await auditService.recordAccessDecision({
      req,
      userId: req.user.userId,
      decision: 'allow',
      reason: policyResult.reason,
      trustScore: req.trustScore?.score,
      breakGlassReason: policyResult.breakGlassReason,
    });

    next();
  };
};

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
