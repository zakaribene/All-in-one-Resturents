const dns = require('dns');
const mongoose = require('mongoose');

// Windows sometimes reports Node's DNS resolver as 127.0.0.1 with nothing
// listening there, which breaks the SRV lookup mongodb+srv:// needs
// (querySrv ECONNREFUSED) even though the OS itself can resolve fine.
// Pinning public resolvers here avoids that mismatch.
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[db] connected to', mongoose.connection.name);
}

module.exports = { connectDB };
