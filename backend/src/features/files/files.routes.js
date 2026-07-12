import express, { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { fileStore } from '../../providers/index.js';
import {
  createUploadedFile,
  deleteUploadedFile,
  getUploadedFile,
  getUploadedFileDownload,
  listUploadedFiles,
  updateUploadedFile,
} from './files.service.js';
import { uploadedFileSchema, uploadedFileUpdateSchema } from '../../validation.js';

export const filesRouter = Router();
const multipartBody = express.raw({ type: (request) => Boolean(request.is('multipart/form-data')), limit: '12mb' });

filesRouter.get('/', requireAuth, requirePermission('files.manage'), async (request, response, next) => {
  try { response.json(await listUploadedFiles(request.auth.user, { category: request.query.category, query: request.query.query })); }
  catch (error) { next(error); }
});

filesRouter.post('/', requireAuth, requirePermission('files.manage'), multipartBody, async (request, response, next) => {
  try {
    const input = request.is('multipart/form-data') ? multipartUploadSchema(request) : uploadedFileSchema(request.body || {}, { requireContent: true });
    response.status(201).json(await createUploadedFile(request.auth.user, input));
  } catch (error) { next(error); }
});

filesRouter.get('/:fileId', requireAuth, requirePermission('files.manage'), async (request, response, next) => {
  try { response.json(await getUploadedFile(request.auth.user, request.params.fileId)); }
  catch (error) { next(error); }
});

filesRouter.patch('/:fileId', requireAuth, requirePermission('files.manage'), async (request, response, next) => {
  try { response.json(await updateUploadedFile(request.auth.user, request.params.fileId, uploadedFileUpdateSchema(request.body || {}))); }
  catch (error) { next(error); }
});

filesRouter.delete('/:fileId', requireAuth, requirePermission('files.manage'), async (request, response, next) => {
  try { response.json(await deleteUploadedFile(request.auth.user, request.params.fileId)); }
  catch (error) { next(error); }
});

filesRouter.get('/:fileId/download', requireAuth, requirePermission('files.manage'), async (request, response, next) => {
  try {
    const download = await getUploadedFileDownload(request.auth.user, request.params.fileId);
    response.setHeader('Content-Type', download.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${download.fileName.replace(/"/g, '')}"`);
    const stream = fileStore.stream(download.path);
    stream.on('error', next);
    stream.pipe(response);
  } catch (error) { next(error); }
});

function multipartUploadSchema(request) {
  const contentType = request.get('content-type') || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary || !Buffer.isBuffer(request.body)) return uploadedFileSchema({}, { requireContent: true });
  const fields = {};
  const files = {};
  const body = request.body.toString('latin1');
  const parts = body.split(`--${boundary}`).slice(1, -1);
  for (const rawPart of parts) {
    const part = rawPart.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const separatorIndex = part.indexOf('\r\n\r\n');
    if (separatorIndex === -1) continue;
    const rawHeaders = part.slice(0, separatorIndex);
    let content = part.slice(separatorIndex + 4);
    if (content.endsWith('\r\n')) content = content.slice(0, -2);
    const disposition = rawHeaders.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || '';
    const name = disposition.match(/name="([^"]+)"/i)?.[1] || '';
    const fileName = disposition.match(/filename="([^"]*)"/i)?.[1] || '';
    const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1] || '';
    if (!name) continue;
    if (fileName) files[name] = { fileName, mimeType, fileContent: Buffer.from(content, 'latin1') };
    else fields[name] = Buffer.from(content, 'latin1').toString('utf8');
  }
  const file = files.file || files.upload || Object.values(files)[0] || null;
  return uploadedFileSchema({
    fileName: fields.fileName || file?.fileName,
    category: fields.category || 'Patient upload',
    source: fields.source || 'patient-portal',
    relatedId: fields.relatedId,
    mimeType: fields.mimeType || file?.mimeType,
    bytes: file?.fileContent?.length,
    fileContent: file?.fileContent,
  }, { requireContent: true });
}
