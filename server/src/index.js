require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const swaggerUi = require('swagger-ui-express');

const { connectDB } = require('./db');
const { initSocket } = require('./socket');
const swaggerSpec = require('./swagger');
const { startActivityRetentionSweep } = require('./utils/activityRetention');
const { startSupportRetentionSweep } = require('./utils/supportRetention');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const restaurantRoutes = require('./routes/restaurant');
const publicRoutes = require('./routes/public');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });
initSocket(io);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
const DB_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
app.get('/api/health', (req, res) => {
  const state = mongoose.connection.readyState;
  res.json({ ok: state === 1, db: DB_STATES[state] || 'unknown', dbName: mongoose.connection.name || null });
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/openapi.json', (req, res) => res.json(swaggerSpec));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/public', publicRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    server.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
    startActivityRetentionSweep();
    startSupportRetentionSweep();
  })
  .catch((err) => {
    console.error('[db] connection failed:', err.message);
    process.exit(1);
  });
