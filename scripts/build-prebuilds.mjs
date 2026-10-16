import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

if (process.platform !== 'darwin') throw new Error('Build prebuilds on macOS with Xcode command-line tools');
const require = createRequire(import.meta.url);
const architectures = process.argv.slice(2);
if (!architectures.length) architectures.push('arm64', 'x64');
for (const arch of architectures) {
  if (!['arm64', 'x64'].includes(arch)) throw new Error(`Unsupported architecture: ${arch}`);
  const result = spawnSync(process.execPath, [require.resolve('node-gyp/bin/node-gyp.js'),
    'rebuild', `--arch=${arch}`, '--devdir=.cache/node-gyp'], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
  const directory = `prebuilds/darwin-${arch}`;
  mkdirSync(directory, { recursive: true });
  copyFileSync('build/Release/liquidglass.node', `${directory}/node.napi.node`);
}
