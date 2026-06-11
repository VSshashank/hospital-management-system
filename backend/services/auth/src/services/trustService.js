const crypto = require('crypto');
const config = require('../config/config');

class TrustService {
  // Hashes request attributes into a stable, non-sensitive device fingerprint.
  hashValue(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
  }

  // Calculates a bounded request trust score from identity, session, and request context.
  calculateTrustScore(req, tokenPayload, userState = {}) {
    let score = 100;
    const reasons = [];
    const failedAttempts = Number(userState.failedLoginAttempts || 0);
    const sessionAgeSeconds = tokenPayload?.iat
      ? Math.max(0, Math.floor(Date.now() / 1000) - tokenPayload.iat)
      : null;
    const userAgent = req.get('user-agent') || '';

    if (!userState.isVerified) {
      score -= 15;
      reasons.push('user_not_verified');
    }

    if (failedAttempts > 0) {
      const penalty = Math.min(30, failedAttempts * 6);
      score -= penalty;
      reasons.push('recent_failed_attempts');
    }

    if (!userAgent) {
      score -= 10;
      reasons.push('missing_user_agent');
    }

    if (sessionAgeSeconds !== null && sessionAgeSeconds > 60 * 60) {
      score -= 10;
      reasons.push('older_session');
    }

    if (sessionAgeSeconds !== null && sessionAgeSeconds > 6 * 60 * 60) {
      score -= 15;
      reasons.push('long_lived_session');
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      reasons,
      minScore: config.security.minTrustScore,
      highSensitivityMinScore: config.security.highSensitivityTrustScore,
      sessionAgeSeconds,
      deviceFingerprint: this.hashValue(userAgent),
      ip: req.ip,
    };
  }

  // Evaluates ABAC-style constraints after RBAC has identified the actor role.
  evaluatePolicy(req, allowedRoles, options = {}) {
    const trustScore = req.trustScore?.score ?? 0;
    const minTrustScore = options.minTrustScore ?? config.security.minTrustScore;
    const now = new Date();
    const currentHour = now.getHours();
    const breakGlassReason = req.get('x-break-glass-reason');
    const breakGlassAllowed = Boolean(
      options.allowBreakGlass &&
      breakGlassReason &&
      ['doctor', 'admin'].includes(req.user?.role)
    );

    if (!allowedRoles.includes(req.user.role) && !breakGlassAllowed) {
      return {
        allowed: false,
        status: 403,
        reason: 'role_denied',
        message: `Access denied. This resource requires ${allowedRoles.join(' or ')} role.`,
      };
    }

    if (options.requireVerified && !req.sessionState?.isVerified && !breakGlassAllowed) {
      return {
        allowed: false,
        status: 403,
        reason: 'verification_required',
        message: 'Access denied. Verified account required.',
      };
    }

    if (trustScore < minTrustScore && !breakGlassAllowed) {
      return {
        allowed: false,
        status: 403,
        reason: 'low_trust_score',
        message: 'Access denied. Additional verification required.',
      };
    }

    if (options.timeWindow && !this.isWithinTimeWindow(currentHour, options.timeWindow) && !breakGlassAllowed) {
      return {
        allowed: false,
        status: 403,
        reason: 'outside_time_window',
        message: 'Access denied outside approved access window.',
      };
    }

    return {
      allowed: true,
      reason: breakGlassAllowed ? 'break_glass_allowed' : 'policy_allowed',
      breakGlassReason: breakGlassAllowed ? breakGlassReason : undefined,
    };
  }

  // Checks whether the current hour is inside a configurable local time window.
  isWithinTimeWindow(currentHour, timeWindow) {
    const [startHour, endHour] = timeWindow;

    if (startHour === endHour) {
      return true;
    }

    if (startHour < endHour) {
      return currentHour >= startHour && currentHour < endHour;
    }

    return currentHour >= startHour || currentHour < endHour;
  }
}

module.exports = new TrustService();
