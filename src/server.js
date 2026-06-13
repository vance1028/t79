'use strict';

const { createApp } = require('./app');
const { waitForDb, close } = require('./db');
const store = require('./data/store');
const exportWorker = require('./services/exportWorker');

const PORT = process.env.PORT || 5070;

async function main() {
  await waitForDb();

  if (process.env.SEED_ON_START !== 'false' && (await store.isEmpty())) {
    await store.seed();
    // eslint-disable-next-line no-console
    console.log('已写入种子数据');
  }

  const app = createApp();
  const server = app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`人防工程管理平台 API 已启动: http://localhost:${PORT}`);
  });

  exportWorker.start();

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  async function gracefulShutdown() {
    // eslint-disable-next-line no-console
    console.log('正在关闭服务...');
    exportWorker.stop();
    server.close();
    await close();
    process.exit(0);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('启动失败：', err);
  process.exit(1);
});
