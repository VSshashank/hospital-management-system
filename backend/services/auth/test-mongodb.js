const mongoose = require('mongoose');
const path = require('path');

// Load .env from current directory
require('dotenv').config({ path: path.join(__dirname, '.env') });

const testConnection = async () => {
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    
    // Check if MONGODB_URI exists
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not found in .env file!');
      console.log('📁 Looking for .env at:', path.join(__dirname, '.env'));
      process.exit(1);
    }
    
    // Hide password in logs
    const safeUri = process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@');
    console.log('URI:', safeUri);
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ Successfully connected to MongoDB Atlas!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    console.log('🌍 Host:', mongoose.connection.host);
    
    // Create a test document
    const testSchema = new mongoose.Schema({ message: String, timestamp: Date });
    const TestModel = mongoose.model('Test', testSchema);
    
    const testDoc = await TestModel.create({
      message: 'Connection test successful!',
      timestamp: new Date()
    });
    
    console.log('✅ Test document created:', testDoc._id);
    
    // Clean up
    await TestModel.deleteOne({ _id: testDoc._id });
    console.log('🧹 Test document deleted');
    
    await mongoose.connection.close();
    console.log('👋 Connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    if (error.name === 'MongooseServerSelectionError') {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Check if IP is whitelisted in MongoDB Atlas (Network Access)');
      console.log('2. Verify username and password in connection string');
      console.log('3. Make sure cluster is running');
    }
    process.exit(1);
  }
};

testConnection();