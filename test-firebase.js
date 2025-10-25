require('dotenv').config();
const admin = require('./firebaseAdmin');

async function testFirebase() {
  try {
    console.log('Testing Firebase Admin SDK...');
    
    // Test listing users
    const listUsersResult = await admin.auth().listUsers();
    console.log(`Found ${listUsersResult.users.length} users`);
    
    // Print first few users
    listUsersResult.users.slice(0, 3).forEach(user => {
      console.log(`- ${user.email || user.uid}`);
    });
    
    console.log('Firebase Admin SDK is working correctly!');
  } catch (error) {
    console.error('Firebase Admin SDK test failed:', error.message);
  }
}

testFirebase();