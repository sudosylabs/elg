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
  const id = liquidGlass.addView(window.getNativeWindowHandle(), { cornerRadius: 16 });
  if (id < 0) window.setBackgroundColor("#202124");
  window.setWindowButtonVisibility(true);
  window.once("closed", () => {
    if (id >= 0) liquidGlass.removeView(id);
  });
  await window.loadURL("data:text/html," + encodeURIComponent(`
    <html><head><title>Liquid Glass</title><style>
      body { margin: 0; font: 16px system-ui; color: white; }
      header { height: 70px; -webkit-app-region: drag; }
      main { margin: 24px; padding: 24px; background: #202124; border-radius: 12px; }
    </style></head><body><header></header><main>
      <h1>Liquid Glass</h1><p>Native glass surrounds this opaque content surface.</p>
      <p>${id >= 0 ? "Native glass attached" : "Opaque fallback (native glass unavailable)"}</p>
    </main></body></html>`));
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => liquidGlass.dispose());
