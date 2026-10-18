# elg

[![Validate](https://github.com/sudosylabs/elg/actions/workflows/ci.yml/badge.svg)](https://github.com/sudosylabs/elg/actions/workflows/ci.yml)

Native macOS Liquid Glass for Electron windows.

`elg` attaches an `NSGlassEffectView` behind a `BrowserWindow`'s web content. Transparent parts of your page show the glass and opaque parts cover it.

> **Status:** pre-release. The package isn't on npm yet and the API may still change.

This is a fork of [electron-liquid-glass](https://github.com/Meridius-Labs/electron-liquid-glass) by Meridius Labs, with a smaller API focused on explicit ownership and cleanup. It isn't a drop-in replacement.

## Requirements

- macOS 26 or later. On older versions, or when Reduce Transparency or Increase Contrast is on, glass is unavailable and `addView` returns `-1`.
- Electron main process.
- Apple Silicon or Intel. Prebuilt binaries ship for both, so you don't need a compiler.

## Install

Until it's published, build a tarball from this repo:

```sh
npm ci
npm run build:prebuilds
npm pack
```

Then install it in your app:

```sh
npm install ./vnilink-elg-0.1.0-dev.0.tgz
```

The package is macOS-only. If your app also targets Windows or Linux, put it in `optionalDependencies` and only import it on macOS.

## Usage

```ts
import { app, BrowserWindow } from 'electron';
import { LiquidGlass } from '@vnilink/elg';

app.whenReady().then(() => {
  const window = new BrowserWindow({
    transparent: true,
    backgroundColor: '#00000000',
    titleBarStyle: 'hiddenInset',
  });

  const glass = new LiquidGlass();
  const id = glass.addView(window.getNativeWindowHandle(), { cornerRadius: 16 });
  if (id < 0) window.setBackgroundColor('#202124'); // fallback when glass is unavailable

  window.once('closed', () => glass.dispose());
});
```

Leave Electron's `vibrancy` option unset. The glass fills the whole window; it doesn't create separate glass regions in the DOM.

### Keep a reference to the `LiquidGlass` instance

When an instance is garbage-collected, it removes all the glass it attached. If nothing holds a reference to it, the glass can disappear at a random moment without an error. Holding only the returned `id` doesn't keep the instance alive.

In the example above, the `'closed'` listener's closure keeps `glass` alive. If you don't register a listener like that, store the instance yourself, for example in a `Map` keyed by window. The default export is a shared instance that is never collected.

### Accessibility changes

If the user turns on Reduce Transparency or Increase Contrast, existing glass is removed. When they turn it back off, the glass is not reattached automatically. Listen for the change in your app, for example with Electron's `nativeTheme`, then show your fallback or call `addView` again.

## API

Use one `LiquidGlass` instance per window. Each instance only manages the attachments it created.

| Method | Description |
| --- | --- |
| `isGlassSupported()` | Whether glass can be shown right now. Returns `false` if the native addon failed to load; check `loadError` to see why. |
| `addView(handle, options?)` | Attaches glass to a window and returns its id. Calling it again on the same window updates the existing attachment. Returns `-1` if glass is unavailable, the window is closed, or another instance already owns the window. |
| `updateView(id, options?)` | Replaces the options. Any option you leave out resets to its default. Returns `false` if the attachment no longer exists. |
| `removeView(id)` | Removes one attachment. Returns `false` if it was already removed. |
| `dispose()` | Removes every attachment from this instance. The instance can't be reused afterwards. |

Options:

- `cornerRadius`: a number `>= 0`. Default `0`.
- `tintColor`: `#RRGGBB` or `#RRGGBBAA`. Default: no tint.
- `opaque`: puts a solid window-colored backing behind the glass. Default `false`.

Invalid arguments throw a `TypeError`. Closing a window removes its glass automatically.

Importing the package doesn't load the native addon. It loads on the first call.

## Packaging your app

- Mark the package as external in your main-process bundler (Vite, webpack, etc.).
- Unpack the `.node` binaries from the ASAR (for example `asarUnpack: ["**/*.node"]` in electron-builder) and keep the `prebuilds` directory.
- Test a signed, notarized build on each architecture you ship.
- Only pass handles from your own `BrowserWindow` objects. Never accept a handle from a renderer or over IPC.

## Development

```sh
npm ci
npm run check          # type check
npm test               # unit tests
npm run test:native    # native lifecycle tests in Electron (needs a macOS desktop session)
npm run test:package   # installs the packed tarball and tests it, including inside an ASAR
npm run example        # opens a demo window
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT. See [LICENSE](LICENSE).
