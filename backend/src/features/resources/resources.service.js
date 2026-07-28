import { randomUUID } from 'node:crypto';
import { notFound } from '../../errors.js';
import { appendAuditLog, filterOwned, scopeDbToPatient, stampPatientOwnership } from '../../domain/patient-scope.js';
import { readDb, updateDb } from '../../store.js';

export async function listResources(user, { query = '', format = 'All', category = 'All', page = 1, pageSize = 10 } = {}) {
  const db = scopeDbToPatient(await readDb(), user);
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedFormat = String(format || 'All').trim().toLowerCase();
  const normalizedCategory = String(category || 'All').trim().toLowerCase();
  const allResources = flattenResources(db.educationalResources).map(publicResource);
  const filtered = allResources.filter((resource) => {
    const queryMatches = !normalizedQuery || [resource.title, resource.detail, resource.category, resource.format]
      .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    const formatMatches = normalizedFormat === 'all' || String(resource.format).toLowerCase() === normalizedFormat;
    const categoryMatches = normalizedCategory === 'all' || String(resource.category).toLowerCase() === normalizedCategory;
    return queryMatches && formatMatches && categoryMatches;
  });
  const pagination = paginate(filtered, page, pageSize);
  const interactions = (db.resourceInteractions || []).map(publicInteraction);
  const savedResourceIds = interactions.filter((item) => item.action === 'Save').map((item) => item.resourceId);

  return {
    featured: db.educationalResources?.featured ? publicResource(db.educationalResources.featured) : null,
    video: db.educationalResources?.video ? publicResource(db.educationalResources.video) : null,
    groups: (db.educationalResources?.groups || []).map(publicGroup),
    library: pagination.items,
    interactions,
    savedResourceIds,
    filters: {
      formats: ['All', ...new Set(allResources.map((item) => item.format).filter(Boolean))],
      categories: ['All', ...new Set(allResources.map((item) => item.category).filter(Boolean))],
    },
    pagination: pagination.meta,
  };
}

export async function getResourceDetail(resourceId) {
  const db = await readDb();
  const resource = findResource(db.educationalResources, resourceId);
  if (!resource) throw notFound('Resource not found');
  return {
    ...publicResource(resource),
    content: contentFor(resource),
    body: contentFor(resource).sections.map((section) => `${section.heading}\n${section.body}`).join('\n\n'),
    generatedAt: new Date().toISOString(),
  };
}

export async function getResourceDownload(resourceId) {
  const detail = await getResourceDetail(resourceId);
  return {
    fileName: `${safeDownloadName(detail.title)}.txt`,
    mimeType: 'text/plain; charset=utf-8',
    body: `${detail.title}\n\n${detail.content.sections.map((section) => `${section.heading}\n${section.body}`).join('\n\n')}`,
  };
}

export async function recordResourceInteraction(user, resourceId, input) {
  return updateDb((db) => {
    const resource = findResource(db.educationalResources, resourceId);
    if (!resource) return null;
    db.resourceInteractions ||= [];
    const ownedInteractions = filterOwned(db.resourceInteractions, user);
    const canonicalId = resource.id;
    const now = new Date().toISOString();

    if (input.action === 'Save') {
      const existing = ownedInteractions.find((item) => item.resourceId === canonicalId && item.action === 'Save');
      if (existing) return { ...publicInteraction(existing), saved: true };
    }

    if (input.action === 'Unsave') {
      for (const interaction of ownedInteractions) {
        if (interaction.resourceId === canonicalId && interaction.action === 'Save') {
          interaction.deletedAt = now;
          interaction.updatedAt = now;
        }
      }
    }

    const interaction = stampPatientOwnership({
      id: `resource-action-${randomUUID()}`,
      resourceId: canonicalId,
      resourceTitle: resource.title,
      action: input.action,
      createdAt: now,
      updatedAt: now,
    }, user);
    db.resourceInteractions.unshift(interaction);
    appendAuditLog(db, user, `resource ${input.action.toLowerCase()}`, 'educationalResource', canonicalId);
    return { ...publicInteraction(interaction), saved: input.action === 'Save' };
  }).then((result) => {
    if (!result) throw notFound('Resource not found');
    return result;
  });
}

export async function unsaveResource(user, resourceId) {
  return recordResourceInteraction(user, resourceId, { action: 'Unsave' });
}

function findResource(resources, resourceId) {
  const decodedId = decodeURIComponent(String(resourceId || ''));
  return flattenResources(resources).find((item) => item.id === decodedId || item.title === decodedId);
}

function flattenResources(resources = {}) {
  return [
    resources.featured,
    resources.video,
    ...(resources.library || []),
    ...(resources.groups || []).flatMap((group) => (group.items || []).map((item, index) => ({
      id: item.id || `${group.id}-${index}`,
      category: group.title,
      format: item.format || 'Article',
      updated: item.updated || 'Curated',
      ...item,
    }))),
  ].filter(Boolean);
}

function publicResource(resource) {
  const trustedSource = trustedSourceFor(resource);
  return {
    id: resource.id,
    title: resource.title,
    detail: resource.detail || '',
    category: resource.category || 'General',
    format: resource.format || (resource.duration ? 'Video' : 'Article'),
    meta: resource.meta || '',
    updated: resource.updated || '',
    duration: resource.duration || '',
    actionLabel: resource.actionLabel || (resource.format === 'PDF' ? 'Download' : 'Read'),
    imageUrl: resource.imageUrl || '',
    sourceUrl: resource.sourceUrl || trustedSource?.url || '',
    sourceLabel: resource.sourceLabel || trustedSource?.label || '',
  };
}

function publicGroup(group) {
  return {
    id: group.id,
    title: group.title,
    items: (group.items || []).map((item, index) => publicResource({ id: item.id || `${group.id}-${index}`, category: group.title, format: item.format || 'Article', ...item })),
  };
}

function publicInteraction(item) {
  return { id: item.id, resourceId: item.resourceId, resourceTitle: item.resourceTitle, action: item.action, createdAt: item.createdAt, updatedAt: item.updatedAt || null };
}

function contentFor(resource) {
  return {
    introduction: resource.detail || '',
    sections: [
      { heading: 'Overview', body: resource.detail || `An overview of ${resource.title}.` },
      { heading: 'Practical guidance', body: `Use this ${resource.format || 'educational resource'} as general education and discuss questions or care changes with your care team.` },
      { heading: 'Safety', body: 'Educational content does not replace individualized diagnosis, treatment, or urgent medical care.' },
    ],
  };
}

function paginate(items, requestedPage, requestedPageSize) {
  const pageSize = Math.min(100, Math.max(1, Number(requestedPageSize) || 10));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(requestedPage) || 1));
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), meta: { page, pageSize, total, totalPages } };
}

function safeDownloadName(value) {
  return String(value || 'resource').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'resource';
}

function trustedSourceFor(resource) {
  return TRUSTED_RESOURCE_SOURCES[resource.id] || null;
}

const TRUSTED_RESOURCE_SOURCES = {
  'resource-hypertension-guide': {
    label: 'CDC',
    url: 'https://www.cdc.gov/high-blood-pressure/about/index.html',
  },
  'resource-lipid-video': {
    label: 'MedlinePlus',
    url: 'https://medlineplus.gov/lab-tests/cholesterol-levels/',
  },
  'condition-guides-0': {
    label: 'MedlinePlus',
    url: 'https://medlineplus.gov/ency/patientinstructions/000328.htm',
  },
  'condition-guides-1': {
    label: 'MedlinePlus',
    url: 'https://medlineplus.gov/chronicpain.html',
  },
  'condition-guides-2': {
    label: 'NIDDK',
    url: 'https://www.niddk.nih.gov/health-information/kidney-disease',
  },
  'medication-info-0': {
    label: 'MedlinePlus',
    url: 'https://medlineplus.gov/statins.html',
  },
  'medication-info-1': {
    label: 'MedlinePlus',
    url: 'https://medlineplus.gov/bloodthinners.html',
  },
  'medication-info-2': {
    label: 'CDC',
    url: 'https://www.cdc.gov/antibiotic-use/',
  },
  'wellness-tips-0': {
    label: 'MedlinePlus',
    url: 'https://medlineplus.gov/nutrition.html',
  },
  'wellness-tips-1': {
    label: 'NHLBI',
    url: 'https://www.nhlbi.nih.gov/health/sleep-deprivation/health-effects',
  },
  'wellness-tips-2': {
    label: 'CDC',
    url: 'https://www.cdc.gov/mental-health/living-with/index.html',
  },
  'lib-cbc': {
    label: 'MedlinePlus',
    url: 'https://medlineplus.gov/lab-tests/complete-blood-count-cbc/',
  },
  'lib-cardio': {
    label: 'CDC',
    url: 'https://www.cdc.gov/arthritis/prevention/index.html',
  },
  'lib-wound': {
    label: 'MedlinePlus',
    url: 'https://medlineplus.gov/ency/patientinstructions/000738.htm',
  },
};
