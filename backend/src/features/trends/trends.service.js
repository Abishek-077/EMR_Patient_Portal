import { randomUUID } from 'node:crypto';
import { badRequest, notFound } from '../../errors.js';
import { appendAuditLog, findOwned, scopeDbToPatient, stampPatientOwnership } from '../../domain/patient-scope.js';
import { readDb, updateDb } from '../../store.js';

const RANGE_DAYS = { '7d': 7, '30d': 30, '3m': 92, '6m': 183, '12m': 366, all: null };

export async function getHealthTrends(user, { range = '12m' } = {}) {
  const selectedRange = normalizeRange(range);
  const db = scopeDbToPatient(await readDb(), user);
  const metrics = (db.healthTrends?.metrics || []).map((metric) => publicMetric(metric, selectedRange));
  const goals = (db.healthTrends?.goals || []).map(publicGoal);
  return {
    summary: calculateSummary(metrics, goals),
    metrics,
    labComparison: (db.healthTrends?.labComparison || []).map(publicLabComparison),
    goals,
    selectedRange,
    availableRanges: Object.keys(RANGE_DAYS),
    generatedAt: new Date().toISOString(),
  };
}

export async function getTrendsExport(user, { range = '12m' } = {}) {
  const trends = await getHealthTrends(user, { range });
  return { title: 'Health Trends & Vitals Report', generatedAt: new Date().toISOString(), ...trends };
}

export async function addTrendReading(user, input) {
  return updateDb((db) => {
    db.healthTrends ||= {};
    db.healthTrends.metrics ||= [];
    const now = new Date().toISOString();
    let metric = input.metricId
      ? findOwned(db.healthTrends.metrics, user, (item) => item.id === input.metricId)
      : null;
    if (input.metricId && !metric) throw notFound('Trend metric not found');

    if (!metric) {
      metric = stampPatientOwnership({
        id: `metric-${randomUUID()}`,
        label: input.label,
        unit: input.unit || '',
        readings: [],
        provenance: 'patient-reported',
        verificationStatus: 'Unverified',
        createdAt: now,
      }, user);
      db.healthTrends.metrics.push(metric);
    }

    const reading = {
      id: `reading-${randomUUID()}`,
      value: input.value,
      recordedAt: input.recordedAt || now,
      provenance: 'patient-reported',
      verificationStatus: 'Unverified',
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    };
    metric.readings ||= [];
    metric.readings.unshift(reading);
    recalculateMetric(metric, now);
    appendAuditLog(db, user, 'trend reading added', 'healthTrend', metric.id, { readingId: reading.id });
    return { metric: publicMetric(metric, 'all'), reading: publicReading(reading) };
  });
}

export async function updateTrendReading(user, metricId, readingId, input) {
  const result = await updateDb((db) => {
    const metric = findOwned(db.healthTrends?.metrics || [], user, (item) => item.id === metricId);
    if (!metric) return null;
    const reading = (metric.readings || []).find((item) => item.id === readingId && !item.deletedAt);
    if (!reading) return null;
    reading.value = input.value;
    reading.recordedAt = input.recordedAt || reading.recordedAt;
    reading.updatedAt = new Date().toISOString();
    if (input.unit) metric.unit = input.unit;
    if (input.label) metric.label = input.label;
    recalculateMetric(metric, reading.updatedAt);
    appendAuditLog(db, user, 'trend reading updated', 'healthTrend', metric.id, { readingId });
    return { metric: publicMetric(metric, 'all'), reading: publicReading(reading) };
  });
  if (!result) throw notFound('Trend metric or reading not found');
  return result;
}

export async function deleteTrendReading(user, metricId, readingId) {
  const result = await updateDb((db) => {
    const metric = findOwned(db.healthTrends?.metrics || [], user, (item) => item.id === metricId);
    if (!metric) return null;
    const reading = (metric.readings || []).find((item) => item.id === readingId && !item.deletedAt);
    if (!reading) return null;
    const now = new Date().toISOString();
    reading.deletedAt = now;
    reading.updatedAt = now;
    recalculateMetric(metric, now);
    appendAuditLog(db, user, 'trend reading deleted', 'healthTrend', metric.id, { readingId });
    return publicReading(reading);
  });
  if (!result) throw notFound('Trend metric or reading not found');
  return result;
}

export async function addTrendGoal(user, input) {
  return updateDb((db) => {
    db.healthTrends ||= {};
    db.healthTrends.goals ||= [];
    const now = new Date().toISOString();
    const goal = stampPatientOwnership({
      id: `goal-${randomUUID()}`,
      label: input.label,
      progress: Number(input.progress),
      createdAt: now,
      updatedAt: now,
    }, user);
    db.healthTrends.goals.unshift(goal);
    appendAuditLog(db, user, 'health goal added', 'healthTrend', goal.id);
    return publicGoal(goal);
  });
}

export async function updateTrendGoal(user, goalId, input) {
  const goal = await updateDb((db) => {
    const found = findOwned(db.healthTrends?.goals || [], user, (item) => item.id === goalId);
    if (!found) return null;
    found.label = input.label;
    found.progress = Number(input.progress);
    found.updatedAt = new Date().toISOString();
    appendAuditLog(db, user, 'health goal updated', 'healthTrend', found.id, { progress: found.progress });
    return publicGoal(found);
  });
  if (!goal) throw notFound('Health goal not found');
  return goal;
}

export async function deleteTrendGoal(user, goalId) {
  const goal = await updateDb((db) => {
    const found = findOwned(db.healthTrends?.goals || [], user, (item) => item.id === goalId);
    if (!found) return null;
    found.deletedAt = new Date().toISOString();
    found.updatedAt = found.deletedAt;
    appendAuditLog(db, user, 'health goal deleted', 'healthTrend', found.id);
    return publicGoal(found);
  });
  if (!goal) throw notFound('Health goal not found');
  return goal;
}

function recalculateMetric(metric, updatedAt) {
  const readings = (metric.readings || [])
    .filter((item) => !item.deletedAt)
    .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt));
  const latest = readings[0] || null;
  metric.latest = latest?.value ?? null;
  metric.latestValue = latest?.value ?? null;
  metric.latestRecordedAt = latest?.recordedAt ?? null;
  metric.updatedAt = updatedAt;
}

function publicMetric(metric, range) {
  const cutoff = rangeCutoff(range);
  const readings = (metric.readings || [])
    .filter((item) => !item.deletedAt)
    .filter((item) => !cutoff || Date.parse(item.recordedAt) >= cutoff)
    .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt))
    .map(publicReading);
  return {
    id: metric.id,
    label: metric.label,
    unit: metric.unit || '',
    status: metric.status || 'Patient reported',
    latest: readings[0]?.value ?? metric.latest ?? metric.latestValue ?? null,
    latestRecordedAt: readings[0]?.recordedAt ?? metric.latestRecordedAt ?? null,
    averageLabel: metric.averageLabel || 'Average',
    average: calculateAverage(readings) ?? metric.average ?? null,
    points: readings.length ? readings.slice().reverse().map((item) => numericValue(item.value)).filter(Number.isFinite) : (metric.points || []),
    readings,
    provenance: metric.provenance || 'clinical-import',
    verificationStatus: metric.verificationStatus || 'Verified',
    createdAt: metric.createdAt || null,
    updatedAt: metric.updatedAt || null,
  };
}

function publicReading(reading) {
  return { id: reading.id, value: reading.value, recordedAt: reading.recordedAt, provenance: reading.provenance || 'patient-reported', verificationStatus: reading.verificationStatus || 'Unverified', createdAt: reading.createdAt || null, updatedAt: reading.updatedAt || null, deletedAt: reading.deletedAt || null };
}

function publicGoal(goal) {
  return { id: goal.id, label: goal.label, progress: Number(goal.progress ?? 0), createdAt: goal.createdAt || null, updatedAt: goal.updatedAt || null, deletedAt: goal.deletedAt || null };
}

function publicLabComparison(item) {
  return { parameter: item.parameter, baseline: item.baseline, current: item.current, change: item.change, status: item.status };
}

function calculateSummary(metrics, goals) {
  return {
    withinRange: metrics.filter((item) => ['Normal', 'Stable', 'Decreasing'].includes(item.status)).length,
    attentionRequired: metrics.filter((item) => ['Elevated', 'Attention', 'Critical'].includes(item.status)).length,
    totalMetrics: metrics.length,
    activeGoals: goals.length,
    updates: metrics.filter((item) => item.latestRecordedAt).slice(0, 4).map((item) => `${item.label} updated ${item.latestRecordedAt}`),
  };
}

function calculateAverage(readings) {
  const values = readings.map((item) => numericValue(item.value)).filter(Number.isFinite);
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function numericValue(value) {
  const parsed = Number.parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeRange(range) {
  const normalized = String(range || '12m').toLowerCase();
  if (!Object.hasOwn(RANGE_DAYS, normalized)) throw badRequest(`range must be one of: ${Object.keys(RANGE_DAYS).join(', ')}`);
  return normalized;
}

function rangeCutoff(range) {
  const days = RANGE_DAYS[range];
  return days === null ? null : Date.now() - days * 24 * 60 * 60 * 1_000;
}
