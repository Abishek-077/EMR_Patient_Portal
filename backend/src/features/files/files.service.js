import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { notFound } from '../../errors.js';
import { appendAuditLog, findOwned, scopeDbToPatient, stampPatientOwnership } from '../../domain/patient-scope.js';
import { fileStore } from '../../providers/index.js';
import { readDb, updateDb } from '../../store.js';
import { env } from '../../config.js';

export async function listUploadedFiles(user, { category = '', query = '' } = {}) {
  const db = scopeDbToPatient(await readDb(), user);
  const normalizedCategory = String(category || '').trim().toLowerCase();
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const files = (db.uploadedFiles || [])
    .filter((file) => !normalizedCategory || String(file.category).toLowerCase() === normalizedCategory)
    .filter((file) => !normalizedQuery || [file.fileName, file.category, file.source].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))
    .map(publicFile);
  return { files, total: files.length };
}

export async function createUploadedFile(user, input) {
  const now = new Date().toISOString();
  const id = `file-${randomUUID()}`;
  const safeName = safeFileName(input.fileName);
  const storedName = `${id}-${safeName}`;
  const content = input.fileContent;
  const bytes = content.length;
  const checksum = createHash('sha256').update(content).digest('hex');
  const storagePath = await fileStore.put({ storedName, content });

  try {
    return await updateDb((db) => {
      db.uploadedFiles ||= [];
      db.documents ||= [];
      const file = stampPatientOwnership({
        id,
        fileName: safeName,
        category: input.category,
        size: formatBytes(bytes),
        bytes,
        mimeType: input.mimeType || mimeTypeForName(safeName),
        source: input.source,
        relatedId: input.relatedId || null,
        uploadedByUserId: user.id,
        storageProvider: fileStore.name,
        storagePath,
        checksum,
        downloadUrl: `${env.apiBasePath}/files/${encodeURIComponent(id)}/download`,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
      }, user);
      db.uploadedFiles.unshift(file);
      db.documents.unshift(stampPatientOwnership({
        id: `document-${randomUUID()}`,
        name: file.fileName,
        category: file.category,
        status: 'Uploaded',
        fileId: id,
        createdAt: now,
        updatedAt: now,
      }, user));
      appendAuditLog(db, user, 'file uploaded', 'uploadedFile', file.id, { bytes, mimeType: file.mimeType });
      return publicFile(file);
    });
  } catch (error) {
    await fileStore.remove(storagePath);
    throw error;
  }
}

export async function getUploadedFile(user, fileId) {
  const db = await readDb();
  const file = findOwned(db.uploadedFiles || [], user, (item) => item.id === fileId);
  if (!file) throw notFound('File not found');
  return publicFile(file);
}

export async function updateUploadedFile(user, fileId, input) {
  const file = await updateDb((db) => {
    const foundFile = findOwned(db.uploadedFiles || [], user, (item) => item.id === fileId);
    if (!foundFile) return null;
    if (input.fileName) foundFile.fileName = safeFileName(input.fileName);
    if (input.category) foundFile.category = input.category;
    if (input.source) foundFile.source = input.source;
    if (input.relatedId !== undefined) foundFile.relatedId = input.relatedId || null;
    foundFile.updatedAt = new Date().toISOString();
    const document = findOwned(db.documents || [], user, (item) => item.fileId === fileId);
    if (document) {
      document.name = foundFile.fileName;
      document.category = foundFile.category;
      document.updatedAt = foundFile.updatedAt;
    }
    appendAuditLog(db, user, 'file updated', 'uploadedFile', fileId);
    return publicFile(foundFile);
  });
  if (!file) throw notFound('File not found');
  return file;
}

export async function deleteUploadedFile(user, fileId) {
  const db = await readDb();
  const existing = findOwned(db.uploadedFiles || [], user, (item) => item.id === fileId);
  if (!existing) throw notFound('File not found');
  const storagePath = existing.storagePath ? safeStoragePath(existing.storagePath) : '';
  const file = await updateDb((database) => {
    const foundFile = findOwned(database.uploadedFiles || [], user, (item) => item.id === fileId);
    if (!foundFile) return null;
    const deletedAt = new Date().toISOString();
    foundFile.deletedAt = deletedAt;
    foundFile.updatedAt = deletedAt;
    const document = findOwned(database.documents || [], user, (item) => item.fileId === fileId);
    if (document) {
      document.deletedAt = deletedAt;
      document.updatedAt = deletedAt;
      document.status = 'Deleted';
    }
    appendAuditLog(database, user, 'file deleted', 'uploadedFile', fileId);
    return publicFile(foundFile);
  });
  if (!file) throw notFound('File not found');
  if (storagePath) await fileStore.remove(storagePath);
  return file;
}

export async function getUploadedFileDownload(user, fileId) {
  const db = await readDb();
  const file = findOwned(db.uploadedFiles || [], user, (item) => item.id === fileId);
  if (!file) throw notFound('File not found');
  if (!file.storagePath) throw notFound('File content is not available');
  const storagePath = safeStoragePath(file.storagePath);
  await fileStore.describe(storagePath);
  return { fileName: file.fileName, mimeType: file.mimeType || mimeTypeForName(file.fileName), path: storagePath };
}

export function getUploadDir() {
  return fileStore.uploadDir;
}

function safeStoragePath(value) {
  const resolved = path.resolve(value);
  const root = `${path.resolve(fileStore.uploadDir)}${path.sep}`;
  if (!resolved.startsWith(root)) throw notFound('File content is not available');
  return resolved;
}

function publicFile(file) {
  return {
    id: file.id,
    fileName: file.fileName,
    category: file.category,
    size: file.size,
    bytes: Number(file.bytes || 0),
    mimeType: file.mimeType,
    source: file.source,
    relatedId: file.relatedId || null,
    storageProvider: file.storageProvider || (file.storagePath ? 'local-file-store' : null),
    checksum: file.checksum || '',
    downloadUrl: file.downloadUrl || `${env.apiBasePath}/files/${encodeURIComponent(file.id)}/download`,
    uploadedAt: file.uploadedAt || file.createdAt || null,
    createdAt: file.createdAt || null,
    updatedAt: file.updatedAt || null,
    deletedAt: file.deletedAt || null,
  };
}

function safeFileName(value) {
  return String(value || 'upload.bin').replace(/[\\/]/g, '-').replace(/[^\w.\- ()]/g, '_').slice(0, 160) || 'upload.bin';
}

function mimeTypeForName(name) {
  const extension = String(name || '').split('.').pop()?.toLowerCase();
  return { csv: 'text/csv', jpeg: 'image/jpeg', jpg: 'image/jpeg', pdf: 'application/pdf', png: 'image/png', txt: 'text/plain' }[extension] || 'application/octet-stream';
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
