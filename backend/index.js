import { createServer } from 'node:http';
import { createApp } from './src/app.js';
import { env } from './src/config.js';

const app = createApp();
const server = createServer(app);

server.listen(env.port, env.host, () => {
  console.log(`EMR patient portal backend listening on http://${env.host}:${env.port}`);
});

