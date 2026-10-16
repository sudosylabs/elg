import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

class ElectronTestRun {
  profile;
  child;
  timer;

  async run() {
    if (process.platform !== 'darwin') throw new Error('Native tests require a macOS desktop');
    const executable = process.env.GLASS_TEST_ELECTRON || createRequire(import.meta.url)('electron');
    this.profile = mkdtempSync(join(tmpdir(), 'elg-test-'));
    this.child = spawn(executable, ['--user-data-dir=' + this.profile, process.env.ELG_TEST_APP || fileURLToPath(new URL('./native.cjs', import.meta.url))], {
      stdio: 'inherit', detached: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '', ELG_TESTING: '1' },
    });
    const stop = () => this.stop();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    try {
      return await new Promise((resolve, reject) => {
        this.timer = setTimeout(() => {
          console.error('Electron native tests timed out');
          this.stop();
        }, 60000);
        this.child.once('error', reject);
        this.child.once('close', (code, signal) => {
          if (signal || code !== 0) reject(new Error(`Electron tests exited with ${signal || code}`));
          else resolve(0);
        });
      });
    } finally {
      clearTimeout(this.timer);
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      rmSync(this.profile, { recursive: true, force: true });
    }
  }

  stop() {
    if (!this.child?.pid) return;
    try { process.kill(-this.child.pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}

try { process.exitCode = await new ElectronTestRun().run(); }
catch (error) { console.error(error); process.exitCode = 1; }
