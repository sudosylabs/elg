# Contributing

Thanks for helping out. Bug reports, fixes and ideas are all welcome.

## Setup

You'll need a Mac with Xcode command-line tools, Node.js 22.18 or later, and npm 11.

```sh
npm ci
npm run build:all
```

## Before opening a pull request

```sh
npm run check
npm test
npm run test:native
```

`test:native` launches Electron, so it needs a desktop session. It also needs macOS 26 or later to run the full glass tests; on older versions it only checks the fallback path.

If you change packaging or the native build, also run:

```sh
npm run build:prebuilds
npm run test:package
```

Some guidelines:

- Keep pull requests focused, and add a test for bug fixes.
- Use only public AppKit APIs.
- Commit `package-lock.json` when dependencies change.
- Keep the upstream copyright notice in `LICENSE`.

## Reporting issues

Open an issue with your macOS version, CPU architecture, Electron version, and a minimal reproduction. For security problems, follow [SECURITY.md](SECURITY.md) instead.

## Releasing (maintainers)

1. Update `CHANGELOG.md` and the version in `package.json`. Prereleases publish to the `next` tag; switch `publishConfig.tag` to `latest` for a stable release.
2. Make sure the Validate workflow passes on the release commit. It runs on Apple Silicon (macOS 26), on Intel (macOS 26), and checks the fallback on macOS 15.
3. Tag the commit `v<version>`, then push the commit and the tag.
4. Run the **Publish** workflow on the tag. It runs the validation again and publishes to npm with provenance, using trusted publishing.

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
