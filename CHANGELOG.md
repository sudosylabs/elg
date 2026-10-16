# Changelog

## 0.1.0-dev.0 — Unreleased

First prerelease preparation for `@vnilint/elg`, derived from Meridius Labs' MIT-licensed `electron-liquid-glass` 1.1.1. This package has a different API and is not a drop-in replacement.

- Use public macOS `NSGlassEffectView` properties with explicit per-instance ownership.
- Add update, removal, disposal, window-close cleanup, and garbage-collection cleanup.
- Validate native handles, IDs, options, and main-thread use.
- Respect Reduce Transparency and Increase Contrast, removing existing attachments when glass becomes unavailable.
- Load native code lazily and preserve load failures for diagnostics.
- Ship ESM, CommonJS, TypeScript declarations, and Node-API 8 prebuilds for Apple Silicon and Intel.
- Validate installed tarballs and unpacked ASAR applications, and add public-repository contribution and security guidance.
- Remove the upstream unstable variant, scrim, subdued, and EventEmitter APIs. There is no legacy blur fallback.
