# Contributing

Use Node.js >=22.18, npm 11.6.2 and Xcode command-line tools on a macOS desktop. `npm ci` uses the maintained npm lockfile. Run `npm run check`, `npm test` and `npm run test:native` before submitting changes. For packaging changes, also run `npm run build:prebuilds` and `npm run test:package`. Native tests must fail on real load/assertion errors; unsupported OS coverage must be reported separately from native glass coverage.

Keep native attachment ownership explicit, use public AppKit APIs, preserve deterministic teardown, and retain the copyright notice in LICENSE. Update tests for changed behavior and document exact Electron, macOS and CPU architecture evidence. The CI runner covers only the architecture/OS it reports, not every supported desktop configuration.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Use issues for reproducible bugs and proposals; report vulnerabilities through the [security policy](SECURITY.md). Keep changes focused and include meaningful regression coverage for fixes. Commit the npm lockfile when dependencies change.

The manual Publish workflow requires a version tag, passing validation, and npm trusted publishing. See [Releasing](docs/RELEASING.md) for repository setup, production application checks, and release responsibilities. Do not describe cross-compilation as Intel execution or an unsigned test as notarized-app validation.
