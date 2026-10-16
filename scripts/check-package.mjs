import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Inspect the Mach-O header rather than trusting a directory name or cross-compile exit code.
for (const [arch, cpu] of [['arm64', 0x0100000c], ['x64', 0x01000007]]) {
  const directory = `prebuilds/darwin-${arch}`;
  assert.deepEqual(readdirSync(directory), ['node.napi.node'], `Unexpected files in ${directory}`);
  const binary = readFileSync(`${directory}/node.napi.node`);
  assert.equal(binary.readUInt32LE(0), 0xfeedfacf, 'Expected a 64-bit Mach-O prebuild');
  assert.equal(binary.readUInt32LE(4), cpu, `Wrong CPU in ${directory}`);
}
for (const file of ['index.js', 'index.cjs', 'index.d.ts', 'index.d.cts']) {
  assert(readFileSync(`dist/${file}`).length > 0, `Missing dist/${file}`);
}
console.log('Both native architectures and all JavaScript/type entry points are present.');
