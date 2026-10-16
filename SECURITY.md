# Security policy

Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/sudosylabs/elg/security/advisories/new). Do not include exploit details, native handles, crash dumps containing private application data, or credentials in public issues. If private reporting is unavailable, open an issue asking maintainers to enable it without disclosing the vulnerability.

Include the package version, Electron version, macOS version, CPU architecture, a minimal reproduction, and the expected impact. Maintainers will investigate and coordinate a fix and advisory; no fixed response time is promised.

Security fixes target the latest release. Prereleases may change their API. Older releases do not receive a separate maintenance branch.

This package runs native code in Electron's main process. Only pass handles obtained directly from trusted `BrowserWindow` instances. Never expose its methods or a native handle to renderer code or accept handles from IPC. Keep Electron's sandbox and context isolation enabled. macOS accessibility preferences can disable glass at runtime; the host application owns its accessible fallback.
