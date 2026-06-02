import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
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

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString('hex'),
  };
}

function passwordMatches(password, user) {
  const expected = Buffer.from(user.passwordHash, 'hex');
  const actual = scryptSync(password, user.passwordSalt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function authToken(request) {
  return request.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
}

async function requireAuth(request, response, next) {
  try {
    const token = authToken(request);
    const db = await readDb();
    db.sessions ||= [];
    const session = db.sessions.find((item) => item.token === token);

    if (!session) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }

    request.userId = session.userId;
    next();
  } catch (error) {
    next(error);
  }
}

app.post('/api/auth/signup', async (request, response, next) => {
  try {
    const { fullName, email, dateOfBirth, patientId, password } = request.body;
    if (!fullName || !email || !dateOfBirth || !password) {
      response.status(400).json({ error: 'Full name, email, date of birth, and password are required' });
      return;
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      response.status(400).json({ error: 'Password does not meet the security requirements' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await updateDb((db) => {
      db.users ||= [];
      db.sessions ||= [];

      if (db.users.some((user) => user.email === normalizedEmail)) return null;

      const passwordCredentials = hashPassword(String(password));
      const user = {
        id: `user-${Date.now()}`,
        fullName: String(fullName).trim(),
        email: normalizedEmail,
        dateOfBirth: String(dateOfBirth),
        patientId: String(patientId || '').trim(),
        passwordHash: passwordCredentials.hash,
        passwordSalt: passwordCredentials.salt,
        createdAt: new Date().toISOString(),
      };
      const session = {
        token: randomUUID(),
        userId: user.id,
        createdAt: new Date().toISOString(),
      };

      db.users.push(user);
      db.sessions.push(session);
      return { session, user };
    });

    if (!result) {
      response.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    response.status(201).json({
      token: result.session.token,
      user: { id: result.user.id, fullName: result.user.fullName, email: result.user.email },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const { usernameOrEmail, password } = request.body;
    if (!usernameOrEmail || !password) {
      response.status(400).json({ error: 'Username or email and password are required' });
      return;
    }

    const identity = String(usernameOrEmail).trim().toLowerCase();
    const result = await updateDb((db) => {
      db.users ||= [];
      db.sessions ||= [];
      const user = db.users.find(
        (item) => item.email === identity || item.patientId?.toLowerCase() === identity,
      );
      if (!user || !passwordMatches(String(password), user)) return null;

      const session = {
        token: randomUUID(),
        userId: user.id,
        createdAt: new Date().toISOString(),
      };
      db.sessions.push(session);
      return { session, user };
    });

    if (!result) {
      response.status(401).json({ error: 'Incorrect username, email, or password' });
      return;
    }

    response.json({
      token: result.session.token,
      user: { id: result.user.id, fullName: result.user.fullName, email: result.user.email },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', requireAuth, async (request, response, next) => {
  try {
    const token = authToken(request);
    await updateDb((db) => {
      db.sessions ||= [];
      db.sessions = db.sessions.filter((session) => session.token !== token);
    });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/portal', requireAuth, async (_request, response, next) => {
  try {
    response.json(await readDb());
  } catch (error) {
    next(error);
  }
});

app.patch('/api/tasks/:taskId', requireAuth, async (request, response, next) => {
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

app.patch('/api/preferences/share-records', requireAuth, async (request, response, next) => {
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

app.post('/api/appointments/requests', requireAuth, async (request, response, next) => {
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

app.post('/api/messages', requireAuth, async (request, response, next) => {
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
