import { readDb } from '../../store.js';

export async function getHealthTrends({ range = '12m' } = {}) {
  const db = await readDb();
  return {
    ...db.healthTrends,
    selectedRange: range,
    generatedAt: new Date().toISOString(),
  };
}

export async function getTrendsExport({ range = '12m' } = {}) {
  const trends = await getHealthTrends({ range });
  return {
    title: 'Health Trends & Vitals Report',
    printable: true,
    ...trends,
  };
}
