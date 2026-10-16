# Validation record

Local verification on October 17, 2026. This records the current working tree; it is not a published release or a result from GitHub Actions.

Environment: macOS 27.0.1 (26A434), Apple Silicon arm64, Node.js 22.19.0, Electron 44.8.0. The native binary targets Node-API 8.

## Passed

- Clean lockfile installation with `npm ci --ignore-scripts`; the Electron executable was subsequently downloaded by its official loader and exercised by native tests.
- `npm run check`, example TypeScript compilation, JavaScript/declaration builds, and all 10 unit tests.
- `npm run test:native`: real native loading, invalid/arbitrary/stale handles, malformed options and throwing getters, worker-thread rejection, owner isolation, repeated attachments, resize, renderer reload, policy-triggered cleanup, restoration by explicit attachment, 100 attach/remove cycles, 20 window-close cycles, garbage-collection cleanup, multi-window disposal, and ESM loading.
- `npm run build:prebuilds`: arm64 and x64 compilation. Both Mach-O CPU headers checked; linked libraries are system libraries/frameworks. Intel execution was not performed locally.
- `ELG_REQUIRE_SUPPORTED=1 npm run test:package`: exact nine-file tarball allowlist; isolated production-only install with install scripts disabled; ESM/CommonJS and their TypeScript consumers; native lifecycle using prebuilds only; the same native lifecycle inside an ASAR with `.node` files unpacked. Both native runs reported real glass support.
- `npm audit --audit-level=low`: zero reported vulnerabilities across the locked development and production dependency graph at verification time.
- `npm run check:release`, `git diff --check`, YAML parsing, and actionlint 1.7.12 workflow validation.
- The example window was visually inspected with native glass attached and legible opaque content; entering fullscreen and returning to the original window completed. This is a basic smoke check, not complete application UI acceptance.
- `npm pack` produced `.cache/vnilint-elg-0.1.0-dev.0.tgz` with ESM/CommonJS, both declaration formats, both prebuilds, package metadata, README, and the original MIT license.

Native Electron launches require a desktop session. The sandboxed launch aborted before tests started; the successful desktop runs above executed outside the filesystem sandbox.

## Standards review

Independent read-only review against `a50d96f`, including untracked changes: zero actionable findings. Documented ownership, public API, teardown, license attribution, and workflow requirements were satisfied.

## Spec review

Independent read-only review against the requested publishing, production, and public-repository goals: zero actionable implementation findings. The external verification requirements below remain open.

## Required before production release

- Create/push `sudosylabs/elg`, run all GitHub validation jobs at the release commit, and configure repository protections/security settings.
- Pass real Intel execution and macOS 15 unavailable-glass coverage. These are configured in CI but have not run.
- Check the consuming application's Electron version, input/focus, drag regions, resize, window controls, light/dark appearance, fullscreen, and real accessibility preference toggles. The automated policy test does not change system accessibility preferences.
- Sign/notarize the consuming application and verify Gatekeeper launches on every advertised architecture.
- Establish npm scope ownership and trusted publishing, review release evidence, and publish the selected version. Nothing has been pushed or published by this preparation.

See [Releasing](RELEASING.md) for the full setup and publication procedure.
