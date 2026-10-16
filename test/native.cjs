const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const { createRequire } = require('node:module');
const packageRoot = process.env.ELG_PACKAGE_ROOT || path.join(__dirname, '..');
const packageRequire = createRequire(path.join(packageRoot, 'package.json'));
const { LiquidGlass } = packageRequire('./dist/index.cjs');
const load = packageRequire('node-gyp-build');
const { LiquidGlassNative } = load(packageRoot);

app.whenReady().then(async () => {
  const windows = new Set();
  const create = () => {
    const window = new BrowserWindow({ show: false, transparent: true, backgroundColor: '#00000000',
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    windows.add(window);
    window.once('closed', () => windows.delete(window));
    return window;
  };
  const owner = new LiquidGlass();
  const other = new LiquidGlass();
  const native = new LiquidGlassNative();
  try {
    const supported = owner.isGlassSupported();
    const macos = execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim();
    console.log(JSON.stringify({ platform: process.platform, arch: process.arch, electron: process.versions.electron, macos, supported }));
    assert.equal(owner.loadError, undefined);
    for (const bad of [Buffer.alloc(0), Buffer.alloc(7), Buffer.alloc(8), Buffer.alloc(9)]) {
      assert.throws(() => native.addView(bad, {}), /Buffer|null/);
    }
    const fake = Buffer.alloc(8, 255);
    assert.equal(native.addView(fake, {}), -1, 'arbitrary pointer must be rejected without dereference');
    for (const removed of ['setVariant', 'setScrimState', 'setSubduedState']) assert.equal(native[removed], undefined);
    const { Worker } = require('node:worker_threads');
    await new Promise((resolve, reject) => {
      const worker = new Worker(`
        const { workerData } = require('node:worker_threads');
        const assert = require('node:assert/strict');
        const { LiquidGlassNative } = require(workerData);
        const native = new LiquidGlassNative();
        assert.throws(() => native.isSupported(), /main thread/);
        assert.throws(() => native.addView(Buffer.alloc(8, 1), {}), /main thread/);
        assert.throws(() => native.updateView(0, {}), /main thread/);
        assert.throws(() => native.removeView(0), /main thread/);
        assert.throws(() => native.dispose(), /main thread/);
      `, {eval:true, workerData:load.resolve(packageRoot)});
      worker.once('error', reject);
      worker.once('exit', code => code === 0 ? resolve() : reject(new Error('Worker probe exited ' + code)));
    });
    const window = create();
    const handle = window.getNativeWindowHandle();
    for (const options of [{ cornerRadius: NaN }, { cornerRadius: -1 }, { tintColor: '#112233zz' }, { opaque: 1 }, null, []]) {
      assert.throws(() => native.addView(handle, options), TypeError);
      assert.throws(() => native.updateView(0, options), TypeError);
    }
    const throwingOptions = { get cornerRadius() { throw new Error('option getter failed'); } };
    assert.throws(() => native.addView(handle, throwingOptions), /option getter failed/);
    assert.throws(() => native.updateView(0, throwingOptions), /option getter failed/);
    for (const id of [-1, NaN, 0.5, 2 ** 31]) assert.throws(() => native.removeView(id), TypeError);
    if (!supported) {
      assert.notEqual(process.env.ELG_REQUIRE_SUPPORTED, '1', 'This release check requires real Liquid Glass support');
      assert.equal(owner.addView(handle), -1);
      console.log('Unsupported macOS fallback passed; glass lifecycle tests require macOS 26+.');
      return;
    }
    const id = owner.addView(handle, {cornerRadius:12, tintColor:'#12345678', opaque:true});
    assert(id >= 0, 'live Electron handle must attach');
    assert.equal(owner.addView(handle), id, 'repeated attach must reuse its owner attachment');
    assert.equal(other.addView(handle), -1, 'another owner must not replace a live attachment');
    assert.equal(other.removeView(id), false);
    assert.equal(other.updateView(id), false);
    assert.equal(owner.updateView(id, {cornerRadius:24, opaque:true, tintColor:'#aabbcc'}), true);
    assert.equal(owner.updateView(id, {}), true, 'clear tint and opaque backing');
    window.setSize(640, 480);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(owner.addView(handle), id, 'resize must preserve the attachment');
    await window.loadURL('data:text/html,<title>Native lifecycle test</title>');
    const loaded = once(window.webContents, 'did-finish-load');
    window.webContents.reload();
    await loaded;
    assert.equal(owner.addView(handle), id, 'renderer reload must preserve the native attachment');
    assert.equal(owner.removeView(id), true);
    assert.equal(owner.removeView(id), false);
    assert.equal(owner.updateView(id), false);
    const policyId = owner.addView(handle, { cornerRadius: 4 });
    assert(policyId >= 0);
    native.testingSetSupportOverride(false);
    native.testingPostAccessibilityChange();
    assert.equal(owner.isGlassSupported(), false);
    assert.equal(owner.removeView(policyId), false, 'accessibility policy must detach the live effect');
    assert.equal(owner.addView(handle), -1, 'accessibility policy must refuse a new attachment');
    native.testingSetSupportOverride(null);
    native.testingPostAccessibilityChange();
    assert.equal(owner.isGlassSupported(), true);
    assert.equal(owner.removeView(policyId), false, 'restoring transparency must not reattach');
    const restored = owner.addView(handle);
    assert(restored >= 0, 'explicit addView must reattach after the policy allows glass');
    assert.notEqual(restored, policyId);
    assert.equal(owner.removeView(restored), true);
    for (let i = 0; i < 100; i++) {
      const current = owner.addView(handle, {opaque:i % 2 === 0});
      assert(current >= 0);
      assert.equal(owner.removeView(current), true);
    }
    for (let i = 0; i < 20; i++) {
      const temporary = create();
      const view = owner.addView(temporary.getNativeWindowHandle());
      assert(view >= 0);
      temporary.destroy();
      assert.equal(owner.removeView(view), false, 'window close must erase the native attachment');
    }
    require('node:v8').setFlagsFromString('--expose-gc');
    const collect = require('node:vm').runInNewContext('gc');
    (() => {
      const abandoned = new LiquidGlassNative();
      assert(abandoned.addView(handle, {}) >= 0);
    })();
    let reclaimed = -1;
    const deadline = Date.now() + 5000;
    while (reclaimed < 0 && Date.now() < deadline) {
      collect();
      await new Promise(resolve => setImmediate(resolve));
      reclaimed = owner.addView(handle);
    }
    assert(reclaimed >= 0, 'GC finalization must release an abandoned native owner');
    owner.removeView(reclaimed);
    const esm = await import(require('node:url').pathToFileURL(path.join(packageRoot, 'dist/index.js')).href);
    const esmOwner = new esm.LiquidGlass();
    assert.equal(esmOwner.loadError, undefined);
    const esmId = esmOwner.addView(handle);
    assert(esmId >= 0, 'ESM distribution must load the native addon in Electron');
    esmOwner.dispose();
    const sibling = create();
    const siblingId = owner.addView(sibling.getNativeWindowHandle());
    assert(siblingId >= 0);
    const independent = create();
    const independentId = other.addView(independent.getNativeWindowHandle());
    assert(independentId >= 0);
    const final = owner.addView(handle);
    owner.dispose(); owner.dispose();
    assert.equal(owner.updateView(final), false);
    assert.equal(owner.updateView(siblingId), false);
    assert.equal(other.updateView(independentId, { cornerRadius: 6 }), true, 'disposing another owner must preserve this window');
    assert(other.addView(sibling.getNativeWindowHandle()) >= 0, 'dispose must release every owned window');
    const adopted = other.addView(handle);
    assert(adopted >= 0, 'dispose must release ownership of the live container');
    assert.equal(owner.addView(handle), -1);
    other.dispose();
    const stale = Buffer.from(handle);
    window.destroy();
    assert.equal(native.addView(stale, {}), -1, 'closed-window handles must be rejected');
    native.dispose(); native.dispose();
    console.log('Native validation, ownership, 100 attach/remove cycles, 20 window-close cycles, updates, reload, GC cleanup and disposal passed.');
  } finally {
    try { native.testingSetSupportOverride(null); } catch { /* runner enables the test seam */ }
    owner.dispose(); other.dispose(); native.dispose();
    for (const window of windows) window.destroy();
  }
}).then(() => app.exit(0), error => { console.error(error); app.exit(1); });
