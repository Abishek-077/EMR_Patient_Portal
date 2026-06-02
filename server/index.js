import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readDb, updateDb } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const app = express();
const port = Number(process.env.PORT || 4000);

app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'emr-patient-portal-api' });
});

app.get('/api/portal', async (_request, response, next) => {
  try {
    response.json(await readDb());
  } catch (error) {
    next(error);
  }
});

app.patch('/api/tasks/:taskId', async (request, response, next) => {
  try {
    const { completed } = request.body;
    if (typeof completed !== 'boolean') {
      response.status(400).json({ error: 'completed must be a boolean' });
      return;
    }

    const task = await updateDb((db) => {
      const foundTask = db.tasks.find((item) => item.id === request.params.taskId);
      if (!foundTask) return null;
      foundTask.completed = completed;
      foundTask.updatedAt = new Date().toISOString();
      return foundTask;
    });

    if (!task) {
      response.status(404).json({ error: 'Task not found' });
      return;
    }

    response.json(task);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/preferences/share-records', async (request, response, next) => {
  try {
    const { shareRecords } = request.body;
    if (typeof shareRecords !== 'boolean') {
      response.status(400).json({ error: 'shareRecords must be a boolean' });
      return;
    }

    const preferences = await updateDb((db) => {
      db.preferences.shareRecords = shareRecords;
      return db.preferences;
    });

    response.json(preferences);
  } catch (error) {
    next(error);
  }
});

app.post('/api/appointments/requests', async (request, response, next) => {
  try {
    const { reason, preferredDate, notes } = request.body;
    if (!reason || !preferredDate) {
      response.status(400).json({ error: 'reason and preferredDate are required' });
      return;
    }

    const appointmentRequest = await updateDb((db) => {
      const createdRequest = {
        id: `req-${Date.now()}`,
        reason: String(reason),
        preferredDate: String(preferredDate),
        notes: String(notes || ''),
        status: 'Queued',
        createdAt: new Date().toISOString(),
      };

      db.appointmentRequests.unshift(createdRequest);
      return createdRequest;
    });

    response.status(201).json(appointmentRequest);
  } catch (error) {
    next(error);
  }
});

app.post('/api/messages', async (request, response, next) => {
  try {
    const { subject, body } = request.body;
    if (!subject || !body) {
      response.status(400).json({ error: 'subject and body are required' });
      return;
    }

    const message = await updateDb((db) => {
      const createdMessage = {
        id: `msg-${Date.now()}`,
        from: 'You',
        subject: String(subject),
        preview: String(body),
        time: 'Just now',
        outbound: true,
      };

      db.messages.unshift(createdMessage);
      return createdMessage;
    });

    response.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`EMR patient portal API listening on http://127.0.0.1:${port}`);
});
