const config = require('./config');
const { createApp } = require('./app');
const { testConnection } = require('./config/db');
const { getConnection } = require('./queues/connection');
const { startGenerationEventRelay } = require('./modules/generation/generation.events');

async function main() {
  await testConnection();
  await getConnection().ping().catch((err) => {
    console.warn('[redis] ping failed:', err.message);
  });

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[server] ${config.appName} API listening on http://localhost:${config.port}`);
    try {
      startGenerationEventRelay();
    } catch (err) {
      console.error('[server] failed to start generation event relay:', err.message);
    }
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
