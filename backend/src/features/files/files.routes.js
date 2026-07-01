import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createUploadedFile } from './files.service.js';
import { uploadedFileSchema } from '../../validation.js';

export const filesRouter = Router();

filesRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await createUploadedFile(uploadedFileSchema(request.body)));
  } catch (error) {
    next(error);
  }
});
