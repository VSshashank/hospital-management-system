const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const logger = require('../../../../shared/utils/logger');

class AuditService {
  constructor() {
    this.auditDir = path.join(__dirname, '../../logs');
    this.auditFile = path.join(this.auditDir, 'access-decisions.log');
  }

  // Records an access decision in an append-only hash-chained JSONL audit log.
  async recordAccessDecision({
    req,
    userId,
    action,
    resource,
    trustScore,
    decision,
    reason,
    breakGlassReason,
  }) {
    try {
      await fs.mkdir(this.auditDir, { recursive: true });

      const previousHash = await this.getLastHash();
      const entry = {
        userId: userId || req.user?.userId || 'anonymous',
        action: action || `${req.method} ${req.originalUrl || req.path}`,
        resource: resource || req.originalUrl || req.path,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgentHash: this.hashValue(req.get('user-agent') || ''),
        trustScore: trustScore ?? req.trustScore?.score ?? null,
        decision,
        reason,
        breakGlassReason,
        previousHash,
      };

      entry.hash = this.hashValue(JSON.stringify(entry));

      await fs.appendFile(this.auditFile, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
      logger.error('Error writing access decision audit log:', error);
    }
  }

  // Reads the previous audit entry hash for local hash-chain continuity.
  async getLastHash() {
    try {
      const contents = await fs.readFile(this.auditFile, 'utf8');
      const lines = contents.trim().split('\n');
      const lastLine = lines[lines.length - 1];

      if (!lastLine) {
        return null;
      }

      return JSON.parse(lastLine).hash || null;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Error reading previous audit hash:', error);
      }

      return null;
    }
  }

  // Hashes audit values without storing raw sensitive request attributes.
  hashValue(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
  }
}

module.exports = new AuditService();
