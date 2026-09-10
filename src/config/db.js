const mongoose = require('mongoose');

/**
 * Connects Mongoose to the MongoDB instance at the given URI.
 * Kept separate from server.js so tests can call this with a different
 * URI (an in-memory MongoDB instance) without touching the real DB.
 */
async function connectDB(uri) {
  await mongoose.connect(uri);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB };
