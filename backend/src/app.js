const express = require('express');
const cors = require('cors');
const { sequelize } = require('./config/db');
const { getConnection } = require('./queues/connection');
const { getStorage } = require('./common/storage');
const { asyncHandler } = require('./common/async-handler');
const { errorHandler, notFoundHandler } = require('./common/middleware/error-handler');
const { requestId } = require('./common/logger');
const questionsRoutes = require('./modules/questions/questions.routes');
const rulesRoutes = require('./modules/rules/rules.routes');
const templatesRoutes = require('./modules/templates/template.routes');
const submissionsRoutes = require('./modules/submissions/submission.routes');
const generationRoutes = require('./modules/generation/generation.routes');
const reviewRoutes = require('./modules/review/review.routes');
const downloadsRoutes = require('./modules/downloads/downloads.routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    req.id = requestId();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  app.get('/health', asyncHandler(async (req, res) => {
    let dbOk = false;
    let redisOk = false;
    try {
      await sequelize.authenticate();
      dbOk = true;
    } catch (e) {
      req.logDbError = e.message;
    }
    try {
      await getConnection().ping();
      redisOk = true;
    } catch (e) {
      req.logRedisError = e.message;
    }
    const healthy = dbOk && redisOk;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      app: process.env.APP_NAME || 'Document Engine',
      checks: { db: dbOk, redis: redisOk },
    });
  }));

  app.get('/api/files/:key', asyncHandler(async (req, res) => {
    const storage = getStorage();
    const key = req.params.key;
    const buf = await storage.read({ key });
    const downloadName = req.query.download;
    if (downloadName) {
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buf);
  }));

  app.use('/api/admin/question-sets', questionsRoutes);
  app.use('/api/admin/rules', rulesRoutes);
  app.use('/api/admin/templates', templatesRoutes);
  app.use('/api', submissionsRoutes);
  app.use('/api', generationRoutes);
  app.use('/api', reviewRoutes);
  app.use('/api', downloadsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
