import express from 'express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import { authRouter } from './src/routes/auth.js';
import { clientRouter } from './src/routes/clients.js';
import { contactRouter } from './src/routes/contacts.js';
import { campaignRouter } from './src/routes/campaigns.js';
import { webhookRouter } from './src/routes/webhooks.js';
import { authMiddleware } from './src/middleware/auth.js';
import { runScheduledCampaigns } from './src/services/scheduler.js';

const app = express();

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('tiny'));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MIN || 120),
}));

app.get('/health', (_, res) => res.json({ ok: true, service: 'campaign-manager', uptime: process.uptime() }));

// Public
app.use('/api/auth', authRouter);

// Webhooks (no JWT — verified by signature per provider)
app.use('/api/webhooks', webhookRouter);

// Authenticated
app.use('/api/clients', authMiddleware, clientRouter);
app.use('/api/contacts', authMiddleware, contactRouter);
app.use('/api/campaigns', authMiddleware, campaignRouter);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

const PORT = Number(process.env.PORT || 4000);

const start = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET required');
  if (!process.env.TEXTBEE_API_URL) throw new Error('TEXTBEE_API_URL required');
  if (!process.env.TEXTBEE_API_KEY) throw new Error('TEXTBEE_API_KEY required');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('mongo: connected');

  app.listen(PORT, () => {
    console.log(`campaign-manager: listening on :${PORT}`);
  });

  // Background tick: send scheduled campaigns when due
  setInterval(runScheduledCampaigns, 30 * 1000);
  console.log('scheduler: running every 30s');
};

start().catch(err => {
  console.error('fatal startup error', err);
  process.exit(1);
});
