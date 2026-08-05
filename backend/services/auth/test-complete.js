const mongoose = require('mongoose');
const redis = require('redis');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator(char = '=') {
  console.log('\n' + char.repeat(60) + '\n');
}

const testComplete = async () => {
  log('🧪 COMPLETE SYSTEM TEST', 'blue');
  log('Testing MongoDB Atlas + Redis + Email + Auth System', 'cyan');
  separator();
  
  let mongoConnected = false;
  let redisConnected = false;
  let redisClient = null;
  
  try {
    // ============================================================
    // TEST 1: Environment Variables
    // ============================================================
    log('TEST 1: Environment Variables', 'cyan');
    separator('-');
    
    const requiredEnvVars = [
      'MONGODB_URI',
      'JWT_SECRET',
      'EMAIL_USER',
      'EMAIL_PASSWORD',
      'OTP_EXPIRY_MINUTES',
    ];
    
    let envComplete = true;
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        log(`✅ ${envVar}: Set`, 'green');
      } else {
        log(`❌ ${envVar}: Missing`, 'red');
        envComplete = false;
      }
    }
    
    if (!envComplete) {
      throw new Error('Missing required environment variables');
    }
    
    log('\n✅ All environment variables configured', 'green');
    
    // ============================================================
    // TEST 2: MongoDB Atlas Connection
    // ============================================================
    separator();
    log('TEST 2: MongoDB Atlas Connection', 'cyan');
    separator('-');
    
    log('🔄 Connecting to MongoDB Atlas...', 'yellow');
    const safeUri = process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@');
    log(`   URI: ${safeUri}`, 'yellow');
    
    await mongoose.connect(process.env.MONGODB_URI);
    mongoConnected = true;
    
    log('✅ MongoDB Atlas connected successfully!', 'green');
    log(`   Database: ${mongoose.connection.db.databaseName}`, 'green');
    log(`   Host: ${mongoose.connection.host}`, 'green');
    
    // ============================================================
    // TEST 3: Database Write/Read Operations
    // ============================================================
    separator();
    log('TEST 3: Database Write/Read Operations', 'cyan');
    separator('-');
    
    log('🔄 Creating test document...', 'yellow');
    
    const TestSchema = new mongoose.Schema({ 
      testType: String,
      email: String, 
      testData: String,
      timestamp: { type: Date, default: Date.now }
    });
    const TestModel = mongoose.model('SystemTest', TestSchema);
    
    const testDoc = await TestModel.create({
      testType: 'complete-system-test',
      email: 'test@example.com',
      testData: 'System test successful',
      timestamp: new Date()
    });
    
    log(`✅ Test document created: ${testDoc._id}`, 'green');
    
    // Read it back
    const foundDoc = await TestModel.findById(testDoc._id);
    if (foundDoc && foundDoc.testData === 'System test successful') {
      log('✅ Test document read successfully', 'green');
    } else {
      throw new Error('Failed to read test document');
    }
    
    // Update it
    foundDoc.testData = 'Updated successfully';
    await foundDoc.save();
    log('✅ Test document updated successfully', 'green');
    
    // Delete it
    await TestModel.deleteOne({ _id: testDoc._id });
    log('✅ Test document deleted successfully', 'green');
    log('🧹 Database cleanup completed', 'green');
    
    // ============================================================
    // TEST 4: Redis Connection
    // ============================================================
    separator();
    log('TEST 4: Redis Connection', 'cyan');
    separator('-');
    
    log('🔄 Connecting to Redis...', 'yellow');
    log(`   Host: ${process.env.REDIS_HOST || 'localhost'}`, 'yellow');
    log(`   Port: ${process.env.REDIS_PORT || 6379}`, 'yellow');
    
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });
    
    redisClient.on('error', (err) => {
      log(`❌ Redis error: ${err.message}`, 'red');
    });
    
    await redisClient.connect();
    redisConnected = true;
    
    const pong = await redisClient.ping();
    log(`✅ Redis connected! Response: ${pong}`, 'green');
    
    // ============================================================
    // TEST 5: Redis Operations (OTP Simulation)
    // ============================================================
    separator();
    log('TEST 5: Redis Operations (OTP Simulation)', 'cyan');
    separator('-');
    
    log('🔄 Testing OTP storage system...', 'yellow');
    
    const testEmail = 'test@example.com';
    const testOTP = '123456';
    const otpKey = `otp:${testEmail}`;
    const expirySeconds = parseInt(process.env.OTP_EXPIRY_MINUTES || 10) * 60;
    
    // Store OTP
    await redisClient.setEx(otpKey, expirySeconds, testOTP);
    log(`✅ OTP stored for ${testEmail}`, 'green');
    log(`   OTP: ${testOTP}`, 'green');
    log(`   Expiry: ${expirySeconds} seconds (${process.env.OTP_EXPIRY_MINUTES || 10} minutes)`, 'green');
    
    // Retrieve OTP
    const storedOTP = await redisClient.get(otpKey);
    if (storedOTP === testOTP) {
      log('✅ OTP retrieved and verified successfully', 'green');
    } else {
      throw new Error('OTP verification failed');
    }
    
    // Check TTL
    const ttl = await redisClient.ttl(otpKey);
    log(`✅ OTP TTL: ${ttl} seconds remaining`, 'green');
    
    // Check existence
    const exists = await redisClient.exists(otpKey);
    log(`✅ OTP key exists: ${exists === 1 ? 'Yes' : 'No'}`, 'green');
    
    // Delete OTP (simulate after verification)
    await redisClient.del(otpKey);
    log('✅ OTP deleted after verification (as expected)', 'green');
    
    // Verify deletion
    const deletedOTP = await redisClient.get(otpKey);
    if (deletedOTP === null) {
      log('✅ OTP properly cleaned up', 'green');
    }
    
    // ============================================================
    // TEST 6: Email Configuration Check
    // ============================================================
    separator();
    log('TEST 6: Email Configuration', 'cyan');
    separator('-');
    
    log(`📧 Email Service: ${process.env.EMAIL_SERVICE || 'gmail'}`, 'green');
    log(`📧 Email User: ${process.env.EMAIL_USER}`, 'green');
    log(`📧 Email From: ${process.env.EMAIL_FROM}`, 'green');
    
    if (process.env.EMAIL_PASSWORD) {
      log('✅ Email password configured', 'green');
    } else {
      log('⚠️ Email password not set (emails won\'t send)', 'yellow');
    }
    
    log('\nℹ️  Email sending will be tested when you run the actual auth service', 'cyan');
    
    // ============================================================
    // TEST 7: JWT Configuration
    // ============================================================
    separator();
    log('TEST 7: JWT Configuration', 'cyan');
    separator('-');
    
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
      log('✅ JWT secret configured (sufficient length)', 'green');
    } else {
      log('⚠️ JWT secret too short (should be at least 32 characters)', 'yellow');
    }
    log(`✅ JWT expiry: ${process.env.JWT_EXPIRY || '24h'}`, 'green');
    
    // ============================================================
    // TEST 8: System Configuration
    // ============================================================
    separator();
    log('TEST 8: System Configuration', 'cyan');
    separator('-');
    
    log(`✅ Server Port: ${process.env.PORT || 8001}`, 'green');
    log(`✅ Node Environment: ${process.env.NODE_ENV || 'development'}`, 'green');
    log(`✅ OTP Length: ${process.env.OTP_LENGTH || 6} digits`, 'green');
    log(`✅ OTP Expiry: ${process.env.OTP_EXPIRY_MINUTES || 10} minutes`, 'green');
    
    const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
    log(`✅ CORS Origins: ${origins.length} configured`, 'green');
    origins.forEach(origin => log(`   - ${origin}`, 'green'));
    
    // ============================================================
    // CLEANUP
    // ============================================================
    separator();
    log('🧹 Cleaning up connections...', 'yellow');
    
    if (redisClient && redisConnected) {
      await redisClient.disconnect();
      log('✅ Redis disconnected', 'green');
    }
    
    if (mongoConnected) {
      await mongoose.connection.close();
      log('✅ MongoDB disconnected', 'green');
    }
    
    // ============================================================
    // FINAL SUMMARY
    // ============================================================
    separator('=');
    log('🎉 ALL TESTS PASSED!', 'green');
    separator('=');
    
    log('\n📊 SYSTEM STATUS:', 'blue');
    log('━'.repeat(60), 'blue');
    log('✅ Environment Variables: Configured', 'green');
    log('✅ MongoDB Atlas: Connected & Working', 'green');
    log('✅ Database Operations: Read/Write/Update/Delete', 'green');
    log('✅ Redis: Connected & Working', 'green');
    log('✅ OTP System: Storage/Retrieval/Expiry', 'green');
    log('✅ Email Configuration: Set', 'green');
    log('✅ JWT Configuration: Set', 'green');
    log('✅ System Configuration: Complete', 'green');
    
    separator('=');
    log('🚀 YOUR BACKEND IS READY!', 'green');
    separator('=');
    
    log('\n📝 NEXT STEPS:', 'cyan');
    log('1. Start your auth service:', 'yellow');
    log('   cd backend/services/auth', 'yellow');
    log('   npm run dev', 'yellow');
    log('');
    log('2. Test the API endpoints:', 'yellow');
    log('   node test-api.js', 'yellow');
    log('');
    log('3. Or test with Postman/Thunder Client:', 'yellow');
    log('   POST http://localhost:8001/api/auth/register', 'yellow');
    log('   POST http://localhost:8001/api/auth/login', 'yellow');
    log('   POST http://localhost:8001/api/auth/verify-otp', 'yellow');
    
    separator('=');
    
    process.exit(0);
    
  } catch (error) {
    separator('=');
    log('❌ SYSTEM TEST FAILED', 'red');
    separator('=');
    
    log(`\nError: ${error.message}`, 'red');
    
    if (error.stack) {
      log('\nStack trace:', 'yellow');
      console.log(error.stack);
    }
    
    separator('-');
    log('💡 TROUBLESHOOTING:', 'yellow');
    separator('-');
    
    if (!mongoConnected) {
      log('\n❌ MongoDB Connection Failed:', 'red');
      log('   1. Check MONGODB_URI in .env file', 'yellow');
      log('   2. Verify username and password are correct', 'yellow');
      log('   3. Check Network Access in MongoDB Atlas (whitelist 0.0.0.0/0)', 'yellow');
      log('   4. Make sure cluster is running', 'yellow');
      log('   5. Test separately: node test-mongodb.js', 'yellow');
    }
    
    if (!redisConnected) {
      log('\n❌ Redis Connection Failed:', 'red');
      log('   1. Make sure Redis server is running:', 'yellow');
      log('      - Check service: sc query Redis', 'yellow');
      log('      - Or start manually: redis-server.exe', 'yellow');
      log('   2. Test Redis CLI: redis-cli ping', 'yellow');
      log('   3. Test separately: node test-redis.js', 'yellow');
    }
    
    log('\n📧 Need help?', 'cyan');
    log('   Run individual tests to isolate the issue:', 'yellow');
    log('   - node test-mongodb.js', 'yellow');
    log('   - node test-redis.js', 'yellow');
    log('   - node diagnostic.js', 'yellow');
    
    separator('=');
    
    // Cleanup
    try {
      if (redisClient && redisConnected) {
        await redisClient.disconnect();
      }
      if (mongoConnected) {
        await mongoose.connection.close();
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  log('\n❌ Unhandled Promise Rejection:', 'red');
  console.error(error);
  process.exit(1);
});

// Run the complete test
log('\n🏁 Starting Complete System Test...', 'blue');
log('This will test MongoDB, Redis, and all configurations\n', 'cyan');

testComplete();