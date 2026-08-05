const redis = require('redis');

const testRedis = async () => {
  try {
    console.log('🔄 Connecting to Redis...');
    console.log('   Host: localhost');
    console.log('   Port: 6379\n');
    
    // Create Redis client
    const client = redis.createClient({
      socket: {
        host: 'localhost',
        port: 6379,
      },
    });
    
    // Error handler
    client.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });
    
    // Connect event
    client.on('connect', () => {
      console.log('🔗 Connecting to Redis server...');
    });
    
    client.on('ready', () => {
      console.log('✅ Redis client ready!\n');
    });
    
    // Connect to Redis
    await client.connect();
    console.log('✅ Connected to Redis successfully!\n');
    
    // Test 1: PING
    console.log('📌 Test 1: PING');
    const pong = await client.ping();
    console.log('   Response:', pong);
    console.log('   ✅ PING successful\n');
    
    // Test 2: SET and GET
    console.log('📌 Test 2: SET and GET');
    await client.set('test_key', 'Hello Redis!');
    console.log('   ✅ SET test_key = "Hello Redis!"');
    
    const value = await client.get('test_key');
    console.log('   ✅ GET test_key =', value);
    console.log('   ✅ SET/GET successful\n');
    
    // Test 3: SET with expiry (SETEX)
    console.log('📌 Test 3: SET with Expiry (like OTP)');
    await client.setEx('temp_key', 10, 'This expires in 10 seconds');
    console.log('   ✅ SETEX temp_key with 10 second expiry');
    
    // Check TTL (Time To Live)
    const ttl = await client.ttl('temp_key');
    console.log('   ✅ TTL temp_key =', ttl, 'seconds remaining\n');
    
    // Test 4: Simulate OTP storage
    console.log('📌 Test 4: Simulate OTP Storage');
    const testEmail = 'user@example.com';
    const testOTP = '123456';
    const otpKey = `otp:${testEmail}`;
    
    await client.setEx(otpKey, 600, testOTP); // 10 minutes expiry
    console.log('   ✅ Stored OTP for', testEmail);
    console.log('   ✅ OTP:', testOTP);
    console.log('   ✅ Expires in: 600 seconds (10 minutes)');
    
    const retrievedOTP = await client.get(otpKey);
    console.log('   ✅ Retrieved OTP:', retrievedOTP);
    
    if (retrievedOTP === testOTP) {
      console.log('   ✅ OTP verification would succeed!\n');
    }
    
    // Test 5: Check if key exists
    console.log('📌 Test 5: Check Key Existence');
    const exists = await client.exists(otpKey);
    console.log('   ✅ Key exists:', exists === 1 ? 'Yes' : 'No');
    console.log('   ✅ EXISTS check successful\n');
    
    // Test 6: Delete keys (cleanup)
    console.log('📌 Test 6: Cleanup');
    await client.del('test_key');
    console.log('   🧹 Deleted test_key');
    
    await client.del('temp_key');
    console.log('   🧹 Deleted temp_key');
    
    await client.del(otpKey);
    console.log('   🧹 Deleted', otpKey);
    console.log('   ✅ Cleanup successful\n');
    
    // Get Redis info
    console.log('📌 Redis Server Info:');
    const info = await client.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    if (versionMatch) {
      console.log('   Version:', versionMatch[1]);
    }
    console.log('   ✅ Server info retrieved\n');
    
    // Disconnect
    await client.disconnect();
    console.log('👋 Disconnected from Redis\n');
    
    console.log('='.repeat(50));
    console.log('🎉 ALL REDIS TESTS PASSED!');
    console.log('='.repeat(50));
    console.log('\n✅ Redis is working perfectly!');
    console.log('✅ OTP storage system ready');
    console.log('✅ Your auth service can use Redis\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Redis test failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure Redis server is running:');
    console.log('      - Check service: sc query Redis');
    console.log('      - Or start manually: redis-server.exe');
    console.log('   2. Test with: redis-cli ping');
    console.log('   3. Check if port 6379 is in use by another app\n');
    process.exit(1);
  }
};

// Run the test
testRedis();