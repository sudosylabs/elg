# Releasing

## Repository setup

The intended repository is `https://github.com/sudosylabs/elg`. Creating it, pushing this checkout, and configuring GitHub settings are separate steps from preparing these files.

After creating the public repository:

1. Enable Issues, private vulnerability reporting, Dependabot alerts/security updates, secret scanning, and push protection where available. CodeQL's workflow scans JavaScript/TypeScript; it does not establish native-code correctness.
2. Protect `main` against force pushes and deletion. Require pull requests, resolved review conversations, and the three `macOS (...)` checks from Validate. Add review requirements appropriate to the number of maintainers; do not require a nonexistent second maintainer. Require the CodeQL check once its first run identifies the exact check name.
3. Set default workflow permissions to read-only. Keep fork PR workflows free of repository secrets. Actions in this checkout are pinned to commit hashes; review Dependabot updates.
4. Create an `npm` environment with required reviewers and version-tag deployment restrictions. Verify that the active GitHub plan enforces those protections.
5. On npm, ensure the maintainer controls the `@vnilint` scope and `@vnilint/elg` name. Configure trusted publishing for owner `sudosylabs`, repository `elg`, workflow `publish.yml`, and environment `npm`. Follow npm's current first-publication setup if the package does not exist yet. Do not commit registry tokens.

GitHub runner labels and OIDC requirements are documented in [GitHub's runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) and [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Local verification

Use macOS with Xcode command-line tools, Node >=22.18, and npm 11.6.2. Native tests need a real desktop session.

```sh
npm ci
npm run check
npm test
npm run test:native
npm audit --audit-level=low
npm run build:prebuilds
ELG_REQUIRE_SUPPORTED=1 npm run test:package
npm run check:release
```

`test:package` checks the tarball allowlist, installs only production dependencies into a temporary directory with install scripts disabled, checks ESM/CommonJS and their types, runs the native lifecycle against the installed prebuild, and repeats it through an ASAR with `.node` files unpacked. It cleans up its temporary profile and installation. It does not use `build/Release` to hide a broken package.

Both CPU binaries must be present before `npm pack`. Packing checks their Mach-O CPU headers and refuses a missing or incorrectly labeled prebuild. Build both with `npm run build:prebuilds`; this cross-compiles and does not prove Intel execution. CI runs the installed package on both `macos-26` and `macos-26-intel`. `macos-15` separately exercises unavailable-glass behavior. Supported runners must fail if glass is unavailable instead of silently skipping the lifecycle.

GitHub's hosted macOS images enable Reduce Transparency to disable graphical effects. The shared `prepare-glass` action turns off Reduce Transparency and Increase Contrast only on disposable GitHub-hosted runners, then checks the actual AppKit class and accessibility policy with `test/host-support.swift`. It runs before both CI and publication tests. It does not bypass the addon's availability check or alter a developer Mac's settings.

## Release decision

- Review all changes, retain the upstream MIT attribution, update the changelog, and choose the version. Keep prereleases on the `next` npm tag; change `publishConfig.tag` to `latest` only for a stable release.
- All required GitHub checks must pass at the exact release commit, including real Intel execution and the older-macOS fallback. Record the tested Electron/macOS versions and architectures in the release notes.
- In the application that will ship, check transparent and opaque content, light/dark appearance, resize, traffic lights, drag regions, fullscreen, focus/keyboard input, and actual Reduce Transparency/Increase Contrast toggles. The automated accessibility test uses a native policy override; it does not change the user's preferences.
- Test a signed, notarized application on each architecture being advertised, including an ordinary Gatekeeper launch. Unpacked ASAR testing does not prove signing/notarization. Signing credentials belong to the consuming application and are not included here.
- Publish only after the above evidence is reviewed. A successful unit suite alone is insufficient to claim production compatibility.

## Publication

Commit the verified release, tag it `v<package.json version>`, and push the commit/tag. Run the **Publish** workflow manually against that tag. A branch run does not publish. The workflow repeats the full validation matrix before rebuilding, testing, and publishing the tagged package through OIDC with provenance. It archives the tarball as a workflow artifact. No npm token is stored in the repository.

For an initial local publication required by npm's package setup, use the same tested tarball and interactive account authentication. Never bypass failed verification or treat `npm publish --dry-run` as a completed publication. Confirm the registry version, dist-tag, tarball, and provenance after publication, then create GitHub release notes linking the validation results.
