# @vnilint/elg

Native macOS Liquid Glass for Electron windows. From the main process, attach an `NSGlassEffectView` behind a `BrowserWindow`. Transparent HTML shows the glass. Opaque HTML covers it.

**Prerelease preparation; not published yet.** The package is configured for public publication under `@vnilint/elg`, initially on npm's `next` tag. See [release requirements](docs/RELEASING.md) before using it in a production app.

Derived from [Meridius Labs' electron-liquid-glass](https://github.com/Meridius-Labs/electron-liquid-glass), under the MIT license. This fork has a different API; the upstream variant, scrim, subdued, and EventEmitter APIs are not available.

## Requirements

- macOS 26 or later, with Reduce Transparency and Increase Contrast turned off.
- Electron main process. Node.js 22.18 or later, npm 11.6.2, and Xcode command-line tools for development.
- Darwin only. On Windows and Linux, keep your own window material or an opaque background.

For a cross-platform application, declare this Darwin-only package in `optionalDependencies` and load it conditionally from the macOS main-process path. A required dependency would make npm reject installation on Windows/Linux.

The addon uses public `NSGlassEffectView` properties. On an unsupported system, `addView` returns `-1`. Callers choose the fallback color.

Published tarballs contain Node-API 8 binaries for `darwin-arm64` and `darwin-x64`. Consumers need no compiler or install-time build. Keep the `prebuilds` directory when bundling. Until publication, build both prebuilds and use `npm pack` to install a local tarball.

## Usage

```ts
import { LiquidGlass } from '@vnilint/elg';

// After app.whenReady(), in the Electron main process:
const glass = new LiquidGlass();
const window = new BrowserWindow({
  transparent: true,
  backgroundColor: '#00000000',
  titleBarStyle: 'hiddenInset',
  webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
});
const id = glass.addView(window.getNativeWindowHandle(), { cornerRadius: 16 });
if (id < 0) window.setBackgroundColor('#202124');
window.once('closed', () => glass.dispose());
```

Leave Electron `vibrancy` unset. Glass fills the window behind the web content. It does not create separate glass regions in the DOM.

Pass the native handle from trusted main-process code. The binding checks that address against live AppKit windows. Keep keyboard and drag regions as usual, and check resize, traffic lights, and fullscreen on the Electron version you ship.

Externalize this package from the Electron main bundle. Load it from the main process only. `node-gyp-build` is a required runtime dependency. Packaged apps need the native binary unpacked from the ASAR, the license included, and a signed, notarized launch checked on each architecture you ship.

## API

Use one `LiquidGlass` instance per window. That instance owns its attachments. The default export is a shared owner. `dispose()` on it is permanent.

Imports do not load the addon and do not print to the console.

| Method | Behavior |
| --- | --- |
| `isGlassSupported(): boolean` | Loads the addon on first use and checks native availability and accessibility settings. Returns `false` when the addon is missing. `loadError` keeps the load failure. |
| `addView(handle, options?): number` | Attaches glass, or updates the attachment this owner already has on that window. Returns `-1` when glass is unavailable, the window is closed, this owner is disposed, or another instance already owns the window. A renderer reload does not need a new attachment. |
| `updateView(id, options?): boolean` | Replaces presentation options. An omitted radius, tint, or opacity resets to `0`, no tint, and transparent. Returns `false` when this owner has no live attachment with that id. |
| `removeView(id): boolean` | Detaches one attachment. A second removal returns `false`. |
| `dispose(): void` | Releases every attachment owned by this instance and refuses later loads. A call that throws, including a call from a worker, leaves the owner active so it can be retried on the main thread. Call it when the window closes. Native garbage collection also removes leftovers. |

`GlassOptions`:

- `cornerRadius`: finite number, `0` or greater.
- `tintColor`: `#RRGGBB` or `#RRGGBBAA`. Omit it to clear a tint.
- `opaque`: boolean.

Invalid options throw `TypeError`, including calls that reach the native binding directly.

Closing the window removes its attachment. Turning on Reduce Transparency or Increase Contrast removes current effects. Turning those settings back off does not reattach. Watch accessibility and theme changes in the app, apply an opaque fallback, and call `addView` again when glass should return. AppKit updates the material appearance. The renderer still owns palette and focus contrast.

Native calls run on the AppKit main thread. Calls from a worker are rejected. One owner cannot update or remove another owner's attachment.

## Build and test

```sh
npm ci
npm run check
npm test
npm run test:native
npm run build:prebuilds
npm run test:package
npm run example
```

`npm run test:native` builds for the current architecture and runs an isolated Electron app with a temporary profile. It needs a real macOS desktop. On older macOS it checks the unavailable path and reports that the native glass lifecycle did not run. `GLASS_TEST_ELECTRON` selects another Electron executable.

`npm run build:prebuilds` produces arm64 and x64 artifacts. A cross-compiled Intel binary still needs to be run on Intel.

`npm run test:package` installs a real tarball with only production dependencies, checks ESM/CommonJS and TypeScript consumers, then tests the installed native binary both unpackaged and inside an ASAR with native binaries unpacked. `ELG_REQUIRE_SUPPORTED=1` makes these tests fail if glass is unavailable. CI separately targets macOS 26 on Apple Silicon and Intel, plus the macOS 15 fallback. CI results become available after this repository is created and pushed.

Production compatibility also depends on your Electron version, UI, and signing configuration. Run the [application validation and release checklist](docs/RELEASING.md) for each architecture you ship. Automated lifecycle tests do not establish visual correctness or successful notarization.

## Contributing and security

See [Contributing](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md), [Security policy](SECURITY.md), and [Changelog](CHANGELOG.md). Report security issues privately through GitHub's security reporting flow.

## License

MIT. See [LICENSE](LICENSE).
