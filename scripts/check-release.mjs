import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(pkg.private, false, 'Release package must be publishable');
assert.match(pkg.repository?.url || '', /^https:\/\/github\.com\/[^/]+\/[^/]+\.git$/, 'Set the real GitHub repository URL');
assert.equal(pkg.publishConfig?.access, 'public');
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/);
if (process.env.GITHUB_REPOSITORY) {
  assert.equal(pkg.repository.url, `https://github.com/${process.env.GITHUB_REPOSITORY}.git`, 'Package repository must match the publishing repository');
}
if (process.env.GITHUB_REF_TYPE === 'tag') assert.equal(process.env.GITHUB_REF_NAME, `v${pkg.version}`, 'Tag and package version must match');
console.log(`Release metadata checked: ${pkg.name}@${pkg.version}`);
