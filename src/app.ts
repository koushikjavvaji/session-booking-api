import express from 'express';
import { router } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
