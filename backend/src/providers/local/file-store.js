import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const configuredUploadDir = process.env.EMR_UPLOAD_DIR
  ? path.resolve(process.env.EMR_UPLOAD_DIR)
  : path.resolve('data', 'uploads');

export const fileStore = {
  name: 'local-file-store',
  uploadDir: configuredUploadDir,

  async put({ storedName, content }) {
    await mkdir(configuredUploadDir, { recursive: true });
    const temporaryPath = path.join(configuredUploadDir, `${storedName}.uploading`);
    const finalPath = path.join(configuredUploadDir, storedName);
    await writeFile(temporaryPath, content, { flag: 'wx' });
    await rename(temporaryPath, finalPath);
    return finalPath;
  },

  async remove(storagePath) {
    if (!storagePath) return;
    await rm(storagePath, { force: true });
  },

  async describe(storagePath) {
    const details = await stat(storagePath);
    return { bytes: details.size, modifiedAt: details.mtime.toISOString() };
  },

  stream(storagePath) {
    return createReadStream(storagePath);
  },
};
