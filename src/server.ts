import { createApp } from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDatabase(env.mongoUri);
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
