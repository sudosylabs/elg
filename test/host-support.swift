import AppKit
import Foundation

// A separate process reads live AppKit policy after the hosted runner is configured.
// Do not mutate preferences here: this probe is also safe to run on a developer Mac.
let workspace = NSWorkspace.shared
let available = NSClassFromString("NSGlassEffectView") != nil
let reduceTransparency = workspace.accessibilityDisplayShouldReduceTransparency
let increaseContrast = workspace.accessibilityDisplayShouldIncreaseContrast
let version = ProcessInfo.processInfo.operatingSystemVersion
let details: [String: Any] = [
    "macos": ProcessInfo.processInfo.operatingSystemVersionString,
    "glassClassAvailable": available,
    "reduceTransparency": reduceTransparency,
    "increaseContrast": increaseContrast,
]
let json = try JSONSerialization.data(withJSONObject: details, options: [.sortedKeys])
print(String(decoding: json, as: UTF8.self))
guard version.majorVersion >= 26, available, !reduceTransparency, !increaseContrast else {
    fputs("Native glass prerequisites are not satisfied on this runner.\n", stderr)
    exit(1)
}
