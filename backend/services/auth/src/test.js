const config = require('./config/config');

// Change from ../../ to ../../../
const logger = require('../../../shared/utils/logger');

console.log('Testing configuration...');
console.log('Port:', config.port);
console.log('MongoDB URI:', config.mongodb.uri);
console.log('Email User:', config.email.user);

logger.info('✅ Configuration loaded successfully!');
logger.error('❌ This is a test error log');