const axios = require('axios');
const readline = require('readline');

const API_BASE_URL = 'http://localhost:8001';
const API_AUTH_URL = `${API_BASE_URL}/api/auth`;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator(char = '=', length = 70) {
  console.log('\n' + char.repeat(length) + '\n');
}

function displayResponse(response, title = 'Response') {
  log(`\n${title}:`, 'cyan');
  console.log(JSON.stringify(response, null, 2));
}

// Global variables to store test data
let testEmail = '';
let testPassword = 'TestPassword123!';
let authToken = '';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ============================================================
// TEST 1: Health Check
// ============================================================
async function test1_healthCheck() {
  separator('=');
  log('TEST 1: HEALTH CHECK', 'bright');
  separator('=');
  
  try {
    log('🔍 Checking if server is running...', 'yellow');
    log(`   URL: ${API_BASE_URL}/health`, 'cyan');
    
    const response = await axios.get(`${API_BASE_URL}/health`);
    
    log('\n✅ SUCCESS - Server is running!', 'green');
    displayResponse(response.data, 'Health Check Response');
    
    return true;
  } catch (error) {
    log('\n❌ FAILED - Server is not responding!', 'red');
    
    if (error.code === 'ECONNREFUSED') {
      log('\n💡 Make sure the server is running:', 'yellow');
      log('   1. Open a terminal', 'yellow');
      log('   2. cd backend\\services\\auth', 'yellow');
      log('   3. npm run dev', 'yellow');
    } else {
      log(`   Error: ${error.message}`, 'red');
    }
    
    return false;
  }
}

// ============================================================
// TEST 2: User Registration
// ============================================================
async function test2_register() {
  separator('=');
  log('TEST 2: USER REGISTRATION', 'bright');
  separator('=');
  
  try {
    // Generate unique email for testing
    const timestamp = Date.now();
    testEmail = 'nikhil.k3411@gmail.com';  // ✅ CORRECT - your real email
    testPassword = 'TestPassword123!';
    
    const userData = {
      email: testEmail,
      password: testPassword,
      role: 'patient',
      fullName: 'Test User',
    };
    
    log('📝 Registering new user...', 'yellow');
    log(`   Email: ${testEmail}`, 'cyan');
    log(`   Role: ${userData.role}`, 'cyan');
    log(`   Password: ${testPassword}`, 'cyan');
    
    const response = await axios.post(`${API_AUTH_URL}/register`, userData);
    
    log('\n✅ SUCCESS - User registered!', 'green');
    displayResponse(response.data, 'Registration Response');
    
    // Check if welcome email was mentioned
    log('\n📧 A welcome email should be sent to your inbox!', 'cyan');
    
    return true;
  } catch (error) {
    log('\n❌ FAILED - Registration failed!', 'red');
    
    if (error.response) {
      displayResponse(error.response.data, 'Error Response');
      
      if (error.response.data.message?.includes('already exists')) {
        log('\n💡 Email already registered. This is expected if running test multiple times.', 'yellow');
        return true; // Continue anyway
      }
    } else {
      log(`   Error: ${error.message}`, 'red');
    }
    
    return false;
  }
}

// ============================================================
// TEST 3: Request OTP (Login)
// ============================================================
async function test3_requestOTP() {
  separator('=');
  log('TEST 3: REQUEST OTP (LOGIN)', 'bright');
  separator('=');
  
  try {
    log('🔐 Requesting OTP for login...', 'yellow');
    log(`   Email: ${testEmail}`, 'cyan');
    
    const response = await axios.post(`${API_AUTH_URL}/login`, {
      email: testEmail,
    });
    
    log('\n✅ SUCCESS - OTP sent to email!', 'green');
    displayResponse(response.data, 'OTP Request Response');
    
    separator('-');
    log('📧 CHECK YOUR EMAIL INBOX!', 'bright');
    log(`   Email: ${testEmail}`, 'cyan');
    log('   Look for: "Your Healthcare System Login OTP"', 'cyan');
    log('   The OTP is a 6-digit number', 'cyan');
    separator('-');
    
    return true;
  } catch (error) {
    log('\n❌ FAILED - Could not request OTP!', 'red');
    
    if (error.response) {
      displayResponse(error.response.data, 'Error Response');
    } else {
      log(`   Error: ${error.message}`, 'red');
    }
    
    return false;
  }
}

// ============================================================
// TEST 4: Verify OTP
// ============================================================
async function test4_verifyOTP() {
  separator('=');
  log('TEST 4: VERIFY OTP', 'bright');
  separator('=');
  
  try {
    // Ask user to enter OTP from email
    log('Please check your email and enter the 6-digit OTP:', 'yellow');
    const otp = await askQuestion('Enter OTP: ');
    
    if (!otp || otp.length !== 6) {
      log('\n❌ Invalid OTP format. OTP must be 6 digits.', 'red');
      return false;
    }
    
    log(`\n🔓 Verifying OTP: ${otp}...`, 'yellow');
    
    const response = await axios.post(`${API_AUTH_URL}/verify-otp`, {
      email: testEmail,
      otp: otp,
    });
    
    log('\n✅ SUCCESS - OTP verified!', 'green');
    displayResponse(response.data, 'OTP Verification Response');
    
    // Save token for next test
    authToken = response.data.data.token;
    
    separator('-');
    log('🔑 JWT TOKEN GENERATED!', 'bright');
    log('   Token saved for protected route test', 'cyan');
    log(`   Token preview: ${authToken.substring(0, 50)}...`, 'cyan');
    separator('-');
    
    return true;
  } catch (error) {
    log('\n❌ FAILED - OTP verification failed!', 'red');
    
    if (error.response) {
      displayResponse(error.response.data, 'Error Response');
      
      if (error.response.data.message?.includes('Invalid OTP')) {
        log('\n💡 The OTP you entered is incorrect. Please try again.', 'yellow');
      } else if (error.response.data.message?.includes('expired')) {
        log('\n💡 The OTP has expired. Run the test again to get a new OTP.', 'yellow');
      }
    } else {
      log(`   Error: ${error.message}`, 'red');
    }
    
    return false;
  }
}

// ============================================================
// TEST 5: Get Current User (Protected Route)
// ============================================================
async function test5_getCurrentUser() {
  separator('=');
  log('TEST 5: GET CURRENT USER (PROTECTED ROUTE)', 'bright');
  separator('=');
  
  try {
    log('👤 Fetching current user info with JWT token...', 'yellow');
    log(`   Authorization: Bearer ${authToken.substring(0, 30)}...`, 'cyan');
    
    const response = await axios.get(`${API_AUTH_URL}/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    log('\n✅ SUCCESS - Protected route accessed!', 'green');
    displayResponse(response.data, 'Current User Response');
    
    separator('-');
    log('🎉 JWT Authentication Working!', 'bright');
    log('   The token successfully authenticated the request', 'cyan');
    separator('-');
    
    return true;
  } catch (error) {
    log('\n❌ FAILED - Could not access protected route!', 'red');
    
    if (error.response) {
      displayResponse(error.response.data, 'Error Response');
      
      if (error.response.status === 401) {
        log('\n💡 Token is invalid or expired.', 'yellow');
      }
    } else {
      log(`   Error: ${error.message}`, 'red');
    }
    
    return false;
  }
}

// ============================================================
// TEST 6: Invalid Token Test
// ============================================================
async function test6_invalidToken() {
  separator('=');
  log('TEST 6: INVALID TOKEN TEST (Should Fail)', 'bright');
  separator('=');
  
  try {
    log('🔒 Testing with invalid token...', 'yellow');
    const fakeToken = 'invalid_token_12345_this_should_fail';
    log(`   Authorization: Bearer ${fakeToken}`, 'cyan');
    
    await axios.get(`${API_AUTH_URL}/me`, {
      headers: {
        Authorization: `Bearer ${fakeToken}`,
      },
    });
    
    // If we get here, the test failed (should have thrown error)
    log('\n❌ TEST FAILED - Invalid token was accepted!', 'red');
    log('   This is a security issue!', 'red');
    
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      log('\n✅ SUCCESS - Invalid token correctly rejected!', 'green');
      displayResponse(error.response.data, 'Expected Error Response');
      
      separator('-');
      log('🛡️ Security Check Passed!', 'bright');
      log('   Invalid tokens are properly rejected', 'cyan');
      separator('-');
      
      return true;
    } else {
      log('\n❌ FAILED - Unexpected error!', 'red');
      log(`   Error: ${error.message}`, 'red');
      return false;
    }
  }
}

// ============================================================
// TEST 7: Test Duplicate Registration
// ============================================================
async function test7_duplicateRegistration() {
  separator('=');
  log('TEST 7: DUPLICATE REGISTRATION (Should Fail)', 'bright');
  separator('=');
  
  try {
    log('📝 Attempting to register with same email again...', 'yellow');
    log(`   Email: ${testEmail}`, 'cyan');
    
    await axios.post(`${API_AUTH_URL}/register`, {
      email: testEmail,
      password: testPassword,
      role: 'patient',
    });
    
    // If we get here, the test failed
    log('\n❌ TEST FAILED - Duplicate email was accepted!', 'red');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      log('\n✅ SUCCESS - Duplicate email correctly rejected!', 'green');
      displayResponse(error.response.data, 'Expected Error Response');
      
      separator('-');
      log('🛡️ Validation Check Passed!', 'bright');
      log('   Duplicate emails are properly prevented', 'cyan');
      separator('-');
      
      return true;
    } else {
      log('\n❌ FAILED - Unexpected error!', 'red');
      log(`   Error: ${error.message}`, 'red');
      return false;
    }
  }
}

// ============================================================
// Main Test Runner
// ============================================================
async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║         HEALTHCARE AUTHENTICATION API - COMPLETE TEST SUITE       ║', 'bright');
  log('╚════════════════════════════════════════════════════════════════════╝', 'bright');
  
  log('\n📋 This test will:', 'cyan');
  log('   1. Check if server is running', 'cyan');
  log('   2. Register a new user', 'cyan');
  log('   3. Request OTP via email', 'cyan');
  log('   4. Verify OTP (you\'ll need to check your email)', 'cyan');
  log('   5. Access protected route with JWT token', 'cyan');
  log('   6. Test invalid token rejection', 'cyan');
  log('   7. Test duplicate registration prevention', 'cyan');
  
  separator('-');
  log('⚠️  IMPORTANT: Make sure your auth service is running!', 'yellow');
  log('   Run: npm run dev (in backend/services/auth)', 'yellow');
  separator('-');
  
  const answer = await askQuestion('\nPress Enter to start tests (or type "exit" to cancel): ');
  
  if (answer.toLowerCase() === 'exit') {
    log('\n👋 Tests cancelled.', 'yellow');
    rl.close();
    process.exit(0);
  }
  
  const results = {
    passed: 0,
    failed: 0,
    total: 7,
  };
  
  // Run tests sequentially
  const tests = [
    { name: 'Health Check', fn: test1_healthCheck },
    { name: 'User Registration', fn: test2_register },
    { name: 'Request OTP', fn: test3_requestOTP },
    { name: 'Verify OTP', fn: test4_verifyOTP },
    { name: 'Get Current User', fn: test5_getCurrentUser },
    { name: 'Invalid Token Test', fn: test6_invalidToken },
    { name: 'Duplicate Registration', fn: test7_duplicateRegistration },
  ];
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    
    const success = await test.fn();
    
    if (success) {
      results.passed++;
    } else {
      results.failed++;
      
      // Ask if user wants to continue
      separator('-');
      const continueAnswer = await askQuestion('Continue with remaining tests? (y/n): ');
      if (continueAnswer.toLowerCase() !== 'y') {
        log('\n⏸️  Tests stopped by user.', 'yellow');
        break;
      }
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Display summary
  separator('=');
  log('📊 TEST SUMMARY', 'bright');
  separator('=');
  
  log(`\nTotal Tests: ${results.total}`, 'cyan');
  log(`Passed: ${results.passed}`, results.passed === results.total ? 'green' : 'yellow');
  log(`Failed: ${results.failed}`, results.failed === 0 ? 'green' : 'red');
  
  const percentage = ((results.passed / results.total) * 100).toFixed(1);
  log(`Success Rate: ${percentage}%`, percentage === '100.0' ? 'green' : 'yellow');
  
  separator('=');
  
  if (results.passed === results.total) {
    log('🎉 ALL TESTS PASSED!', 'green');
    log('Your authentication system is working perfectly! 🚀', 'green');
    separator('=');
    
    log('\n✅ What\'s Working:', 'bright');
    log('   ✅ Server is running and accessible', 'green');
    log('   ✅ User registration with validation', 'green');
    log('   ✅ OTP generation and email delivery', 'green');
    log('   ✅ OTP verification and JWT generation', 'green');
    log('   ✅ Protected routes with JWT authentication', 'green');
    log('   ✅ Invalid token rejection (security)', 'green');
    log('   ✅ Duplicate email prevention (validation)', 'green');
    
    separator('-');
    log('🎯 Next Steps:', 'cyan');
    log('   1. Share API documentation with frontend team', 'yellow');
    log('   2. Integrate with React frontend', 'yellow');
    log('   3. Start building Patient Service (Week 5-8)', 'yellow');
    
  } else {
    log('⚠️  SOME TESTS FAILED', 'yellow');
    log('Review the errors above and fix the issues.', 'yellow');
    separator('=');
    
    log('\n💡 Common Issues:', 'cyan');
    log('   - Server not running: npm run dev', 'yellow');
    log('   - MongoDB not connected: Check Atlas connection', 'yellow');
    log('   - Redis not running: Start redis-server', 'yellow');
    log('   - Email not configured: Check .env EMAIL settings', 'yellow');
  }
  
  separator('=');
  
  // Close readline interface
  rl.close();
  process.exit(results.failed === 0 ? 0 : 1);
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n\n👋 Tests interrupted by user.', 'yellow');
  rl.close();
  process.exit(0);
});

// Start the test suite
runAllTests().catch((error) => {
  log('\n❌ Unexpected error during tests:', 'red');
  console.error(error);
  rl.close();
  process.exit(1);
});