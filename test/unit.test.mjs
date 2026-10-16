import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LiquidGlass } from '../dist/index.js';
import { createRequire } from 'node:module';

const handle = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]);
function fixture(platform = 'darwin', failure) {
  const calls = [];
  const native = {
    isSupported() { return true; },
    addView(...args) { calls.push(['add', ...args]); return 7; },
    updateView(...args) { calls.push(['update', ...args]); return true; },
    removeView(...args) { calls.push(['remove', ...args]); return true; },
    dispose() { calls.push(['dispose']); },
  };
  const owner = new LiquidGlass({ platform, pointerSize: 8, load() {
    calls.push(['load']);
    if (failure) throw failure;
    return native;
  }});
  return { owner, calls, native };
}

test('ESM and CJS imports do not load a native addon', () => {
  const require = createRequire(import.meta.url);
  assert.equal(require('../dist/index.cjs').default.loadError, undefined);
});
for (const platform of ['win32', 'linux']) test(`${platform} never resolves the Darwin addon`, () => {
  const { owner, calls } = fixture(platform);
  assert.equal(owner.isGlassSupported(), false);
  assert.equal(owner.addView(handle), -1);
  assert.equal(owner.updateView(0), false);
  owner.dispose();
  assert.deepEqual(calls, []);
});
test('whole native load failure is contained and retained for diagnostics', () => {
  const error = new Error('missing binary');
  const { owner, calls } = fixture('darwin', error);
  assert.equal(owner.isGlassSupported(), false);
  assert.equal(owner.addView(handle), -1);
  assert.equal(owner.loadError, error);
  assert.deepEqual(calls, [['load']]);
});
test('unsupported native platform cannot report a successful attachment', () => {
  const { owner, native, calls } = fixture();
  native.isSupported = () => false;
  assert.equal(owner.addView(handle), -1);
  assert.deepEqual(calls, [['load']]);
});
test('options are forwarded for explicit updates, clearing omitted properties', () => {
  const { owner, calls } = fixture();
  assert.equal(owner.addView(handle, { tintColor: '#12345678', cornerRadius: 8 }), 7);
  assert.equal(owner.updateView(7, {}), true);
  assert.equal(owner.removeView(7), true);
  assert.deepEqual(calls, [['load'], ['add', handle, {tintColor:'#12345678', cornerRadius:8}], ['update',7,{}], ['remove',7]]);
});
test('a failed dispose stays retryable', () => {
  const { owner, calls, native } = fixture();
  owner.addView(handle);
  native.dispose = () => { calls.push(['dispose-fail']); throw new Error('main thread'); };
  assert.throws(() => owner.dispose(), /main thread/);
  assert.equal(owner.isGlassSupported(), true);
  assert.equal(owner.addView(handle), 7);
  native.dispose = () => { calls.push(['dispose']); };
  owner.dispose();
  assert.equal(owner.isGlassSupported(), false);
  assert.equal(owner.addView(handle), -1);
  assert.equal(calls.filter(call => call[0] === 'dispose').length, 1);
});
test('disposal is idempotent and prevents lazy load or future native calls', () => {
  const { owner, calls } = fixture();
  owner.addView(handle);
  owner.dispose(); owner.dispose();
  assert.equal(owner.addView(handle), -1);
  assert.equal(owner.updateView(7), false);
  assert.equal(owner.removeView(7), false);
  assert.equal(owner.isGlassSupported(), false);
  assert.equal(calls.filter(call => call[0] === 'dispose').length, 1);
  const untouched = fixture();
  untouched.owner.dispose();
  untouched.owner.addView(handle);
  assert.deepEqual(untouched.calls, []);
});
test('invalid handles, options and ids fail before native mutation', () => {
  const { owner, calls } = fixture();
  for (const bad of [null, {}, Buffer.alloc(0), Buffer.alloc(7), Buffer.alloc(8), Buffer.alloc(9)]) {
    assert.throws(() => owner.addView(bad), TypeError);
  }
  for (const bad of [null, [], {cornerRadius:-1}, {cornerRadius:NaN}, {cornerRadius:Infinity}, {tintColor:'#123456junk'}, {tintColor:4}, {opaque:1}]) {
    assert.throws(() => owner.addView(handle, bad), TypeError);
    assert.throws(() => owner.updateView(0, bad), TypeError);
  }
  for (const bad of [-1, NaN, Infinity, 0.5, 2**31, '0']) {
    assert.throws(() => owner.updateView(bad), TypeError);
    assert.throws(() => owner.removeView(bad), TypeError);
  }
  assert.deepEqual(calls, []);
});

test('relocated ESM and CJS distributions contain missing-loader failures', async () => {
  const { mkdtemp, cp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'glass-missing-loader-'));
  try {
    await cp(new URL('../dist/', import.meta.url), join(directory, 'dist'), {recursive:true});
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    const script = `
      import assert from 'node:assert/strict';
      import esm from './dist/index.js';
      import { createRequire } from 'node:module';
      const cjs = createRequire(import.meta.url)('./dist/index.cjs').default;
      for (const owner of [esm, cjs]) {
        assert.equal(owner.loadError, undefined);
        assert.equal(owner.isGlassSupported(), false);
        if (process.platform === 'darwin') assert(owner.loadError instanceof Error);
        owner.dispose();
      }
    `;
    await writeFile(join(directory,'probe.mjs'),script);
    const result = spawnSync(process.execPath, ['probe.mjs'], {cwd:directory, encoding:'utf8', timeout:10000});
    assert.equal(result.status, 0, result.stderr || String(result.error));
  } finally { await rm(directory, {recursive:true, force:true}); }
});
