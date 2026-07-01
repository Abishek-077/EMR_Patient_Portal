import { randomUUID } from 'node:crypto';
import { updateDb } from '../../store.js';

export async function createUploadedFile(input) {
  return updateDb((db) => {
    db.uploadedFiles ||= [];
    db.activityLog ||= [];
    const file = {
      id: `file-${randomUUID()}`,
      fileName: input.fileName,
      category: input.category,
      size: input.size,
      source: input.source,
      relatedId: input.relatedId || null,
      uploadedAt: new Date().toISOString(),
    };
    db.uploadedFiles.unshift(file);
    db.activityLog.unshift({
      id: `activity-${randomUUID()}`,
      type: 'file',
      title: 'File metadata uploaded',
      detail: `${file.fileName} (${file.category})`,
      createdAt: file.uploadedAt,
    });
    return file;
  });
}
