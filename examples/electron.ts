import { app, BrowserWindow } from "electron";
import liquidGlass from "../dist/index.js";

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: "hiddenInset",
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const handle = window.getNativeWindowHandle();
  // Glass in the 70-point header, and in a sidebar inset 12 points below it.
  const ids = [
    liquidGlass.addView(handle, { opaque: true, frame: { x: 0, y: 0, width: 800, height: 70, anchors: { top: true, left: true, right: true } } }),
    liquidGlass.addView(handle, { opaque: true, cornerRadius: 12, frame: { x: 12, y: 82, width: 220, height: 506, anchors: { top: true, bottom: true, left: true } } }),
  ];
  const attached = ids.every(id => id >= 0);
  if (!attached) window.setBackgroundColor("#202124");
  window.setWindowButtonVisibility(true);
  window.once("closed", () => {
    for (const id of ids) if (id >= 0) liquidGlass.removeView(id);
  });
  await window.loadURL("data:text/html," + encodeURIComponent(`
    <html><head><title>Liquid Glass</title><style>
      :root { color-scheme: light dark; --page: light-dark(#fff, #202124); }
      body { margin: 0; height: 100vh; font: 16px system-ui; display: grid; grid-template: 70px 1fr / 244px 1fr; }
      header { grid-column: 1 / -1; -webkit-app-region: drag; }
      aside { overflow: hidden; display: flex; }
      nav { flex: 1; margin: 12px; border-radius: 12px; box-shadow: 0 0 0 100px var(--page); padding: 12px; }
      main { background: var(--page); padding: 24px; }
    </style></head><body><header></header><aside><nav>Sidebar</nav></aside><main>
      <h1>Liquid Glass</h1><p>Glass in the header and the sidebar; this page is opaque.</p>
      <p>${attached ? "Native glass attached" : "Opaque fallback (native glass unavailable)"}</p>
    </main></body></html>`));
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => liquidGlass.dispose());
