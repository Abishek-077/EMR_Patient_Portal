import { randomUUID } from 'node:crypto';
import { notFound } from '../../errors.js';
import { readDb, updateDb } from '../../store.js';

export async function listResources({ query = '', format = 'All' } = {}) {
  const db = await readDb();
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedFormat = String(format || 'All');
  const library = db.educationalResources.library.filter((resource) => {
    const queryMatches = !normalizedQuery || [resource.title, resource.detail, resource.category, resource.format]
      .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    const formatMatches = normalizedFormat === 'All' || resource.format === normalizedFormat;
    return queryMatches && formatMatches;
  });

  return {
    ...db.educationalResources,
    library,
    interactions: db.resourceInteractions,
  };
}

export async function getResourceDetail(resourceId) {
  const db = await readDb();
  const resources = flattenResources(db.educationalResources);
  const resource = resources.find((item) => item.id === resourceId || item.title === resourceId);
  if (!resource) throw notFound('Resource not found');
  return {
    ...resource,
    body: `${resource.title}\n\n${resource.detail}\n\nThis educational material is recommended based on your current health profile and recent clinical activity.`,
  };
}

export async function recordResourceInteraction(resourceId, input) {
  return updateDb((db) => {
    const resources = flattenResources(db.educationalResources);
    const resource = resources.find((item) => item.id === resourceId || item.title === resourceId);
    if (!resource) return null;
    db.resourceInteractions ||= [];
    const interaction = {
      id: `resource-action-${randomUUID()}`,
      resourceId,
      resourceTitle: resource.title,
      action: input.action,
      createdAt: new Date().toISOString(),
    };
    db.resourceInteractions.unshift(interaction);
    return interaction;
  }).then((interaction) => {
    if (!interaction) throw notFound('Resource not found');
    return interaction;
  });
}

function flattenResources(resources) {
  return [
    resources.featured,
    resources.video,
    ...resources.library,
    ...resources.groups.flatMap((group) => group.items.map((item, index) => ({
      id: `${group.id}-${index}`,
      category: group.title,
      format: 'Article',
      updated: 'Curated',
      ...item,
    }))),
  ].filter(Boolean);
}
