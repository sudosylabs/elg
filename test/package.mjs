import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createPackageWithOptions } from '@electron/asar';

const root = resolve('.');
const directory = await mkdtemp(join(tmpdir(), 'elg-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root, stdio: 'inherit', timeout: 120000, ...options,
});
try {
  run(npm, ['run', 'prepack']);
  const output = run(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', directory,
    '--cache', join(directory, 'cache')], { stdio: 'pipe', encoding: 'utf8' });
  const [pack] = JSON.parse(output);
  const paths = pack.files.map(file => file.path).sort();
  assert.deepEqual(paths, ['LICENSE', 'README.md', 'dist/index.cjs', 'dist/index.d.cts',
    'dist/index.d.ts', 'dist/index.js', 'package.json',
    'prebuilds/darwin-arm64/node.napi.node', 'prebuilds/darwin-x64/node.napi.node'].sort(),
  'The tarball must contain only runtime entry points, both prebuilds, and package documentation');
  await writeFile(join(directory, 'package.json'), '{"private":true,"type":"module"}');
  run(npm, ['install', join(directory, pack.filename), '--omit=dev', '--ignore-scripts',
    '--no-audit', '--no-fund', '--cache', join(directory, 'cache')], { cwd: directory });
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const packageRoot = join(directory, 'node_modules', ...pkg.name.split('/'));
  const probe = `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import esm, { LiquidGlass } from '${pkg.name}';
    const require = createRequire(import.meta.url);
    const cjs = require('${pkg.name}');
    assert.equal(typeof LiquidGlass, 'function');
    assert.equal(typeof cjs.LiquidGlass, 'function');
    for (const owner of [esm, cjs.default]) {
      assert.equal(owner.loadError, undefined);
      owner.isGlassSupported();
      assert.equal(owner.loadError, undefined, 'Installed prebuild must load without a compiler or dev dependencies');
      owner.dispose();
    }
  `;
  await writeFile(join(directory, 'probe.mjs'), probe);
  run(process.execPath, [join(directory, 'probe.mjs')], { env: { ...process.env, PREBUILDS_ONLY: '1' } });
  const consumer = `import glass, { LiquidGlass, type GlassOptions } from '${pkg.name}';\nconst options: GlassOptions = { cornerRadius: 8 };\nnew LiquidGlass().updateView(0, options);\nglass.dispose();\n`;
  for (const extension of ['mts', 'cts']) {
    const file = join(directory, `consumer.${extension}`);
    await writeFile(file, consumer);
    run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit',
      '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
      '--strict', '--skipLibCheck', '--typeRoots', join(root, 'node_modules/@types'), file]);
  }
  const env = { ...process.env, ELG_PACKAGE_ROOT: packageRoot, PREBUILDS_ONLY: '1' };
  run(process.execPath, ['test/run-electron.mjs'], { env });
  // Exercise the same lifecycle through Electron's ASAR resolver with native code unpacked.
  const app = join(directory, 'app');
  await cp(join(directory, 'node_modules'), join(app, 'node_modules'), { recursive: true, verbatimSymlinks: true });
  await cp(join(root, 'test/native.cjs'), join(app, 'native.cjs'));
  await writeFile(join(app, 'package.json'), JSON.stringify({ name: 'elg-package-test', version: '1.0.0', main: 'native.cjs' }));
  const archive = join(directory, 'app.asar');
  await createPackageWithOptions(app, archive, { unpack: '**/*.node' });
  run(process.execPath, ['test/run-electron.mjs'], { env: { ...env, ELG_TEST_APP: archive,
    ELG_PACKAGE_ROOT: join(archive, 'node_modules', ...pkg.name.split('/')) } });
  console.log(`Tarball ${pack.filename}: isolated production install, ESM/CJS, types, prebuilds and unpacked ASAR passed.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
