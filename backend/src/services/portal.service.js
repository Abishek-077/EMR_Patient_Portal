import { readDb } from '../store.js';
import { getDashboardForPatient } from './dashboard.service.js';

export async function getPortalForPatient(user) {
  const db = await readDb();
  const {
    users: _users,
    sessions: _sessions,
    ...portalData
  } = db;

  return {
    ...portalData,
    dashboard: await getDashboardForPatient(user),
  };
}

