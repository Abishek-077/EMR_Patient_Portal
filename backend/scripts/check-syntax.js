import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const files = await javascriptFiles(path.resolve('backend'));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}
console.log(`Backend syntax check passed (${files.length} files)`);

async function javascriptFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await javascriptFiles(location));
    else if (entry.isFile() && entry.name.endsWith('.js')) output.push(location);
  }
  return output.sort();
}
