#import <AppKit/AppKit.h>
#include <map>
#include <limits>
#include "glass_effect.h"

// Only public NSGlassEffectView properties. Runtime lookup permits older SDK/OS loads.
@protocol VNLGlassProperties
@property CGFloat cornerRadius;
@property(strong) NSColor *tintColor;
@end

@interface VNLGlassAttachment : NSObject
@property uint64_t owner;
@property(weak) NSView *container;
@property(strong) NSView<VNLGlassProperties> *glass;
@property(strong) NSBox *background;
@property(strong) id closeObserver;
@property(strong) id accessibilityObserver;
- (void)detach;
@end

@implementation VNLGlassAttachment
- (void)detach {
  if (self.closeObserver) {
    [[NSNotificationCenter defaultCenter] removeObserver:self.closeObserver];
    self.closeObserver = nil;
  }
  if (self.accessibilityObserver) {
    [[[NSWorkspace sharedWorkspace] notificationCenter] removeObserver:self.accessibilityObserver];
    self.accessibilityObserver = nil;
  }
  [self.glass removeFromSuperview];
  [self.background removeFromSuperview];
  self.glass = nil;
  self.background = nil;
  self.container = nil;
}
@end

// Accessed on AppKit's main thread only.
// ARC does not retain ObjC objects inside C++ containers, so each entry is stored +1.
static std::map<int, void *> attachments;
static int64_t nextId = 0;
static int supportOverride = 0;

static VNLGlassAttachment *Peek(void *stored) {
  return (__bridge VNLGlassAttachment *)stored;
}

static void Take(std::map<int, void *>::iterator found) {
  void *stored = found->second;
  attachments.erase(found);
  VNLGlassAttachment *entry = (__bridge_transfer VNLGlassAttachment *)stored;
  [entry detach];
}

bool GlassIsMainThread() { return [NSThread isMainThread]; }

bool GlassIsSupported() {
  if (supportOverride < 0) return false;
  if (@available(macOS 26.0, *)) {
    NSWorkspace *workspace = [NSWorkspace sharedWorkspace];
    return NSClassFromString(@"NSGlassEffectView") != Nil
      && !workspace.accessibilityDisplayShouldReduceTransparency
      && !workspace.accessibilityDisplayShouldIncreaseContrast;
  }
  return false;
}

void GlassSetSupportOverride(int mode) { supportOverride = mode; }

void GlassDeliverAccessibilityChange() {
  [[[NSWorkspace sharedWorkspace] notificationCenter]
    postNotificationName:NSWorkspaceAccessibilityDisplayOptionsDidChangeNotification
    object:nil];
  NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:0.2];
  while ([NSDate.date compare:deadline] == NSOrderedAscending) {
    [[NSRunLoop mainRunLoop] runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.01]];
  }
}

// Compare addresses of known live views. Never message/dereference the supplied pointer.
static NSView *FindView(NSView *view, uintptr_t address) {
  if (reinterpret_cast<uintptr_t>((__bridge void *)view) == address) return view;
  for (NSView *child in view.subviews) {
    NSView *found = FindView(child, address);
    if (found) return found;
  }
  return nil;
}

static NSColor *ColorFromHex(const char *hex) {
  if (!hex || !*hex) return nil;
  NSString *text = [NSString stringWithUTF8String:hex];
  unsigned long long value = 0;
  [[NSScanner scannerWithString:[text substringFromIndex:1]] scanHexLongLong:&value];
  bool alpha = text.length == 9;
  return [NSColor colorWithSRGBRed:((value >> (alpha ? 24 : 16)) & 255) / 255.0
                            green:((value >> (alpha ? 16 : 8)) & 255) / 255.0
                             blue:((value >> (alpha ? 8 : 0)) & 255) / 255.0
                            alpha:alpha ? (value & 255) / 255.0 : 1.0];
}

bool RemoveGlassEffectView(uint64_t owner, int id) {
  auto found = attachments.find(id);
  if (found == attachments.end() || Peek(found->second).owner != owner) return false;
  Take(found);
  return true;
}

void RemoveGlassEffectViews(uint64_t owner) {
  auto remove = ^{
    for (auto it = attachments.begin(); it != attachments.end();) {
      if (Peek(it->second).owner != owner) { ++it; continue; }
      void *stored = it->second;
      it = attachments.erase(it);
      VNLGlassAttachment *entry = (__bridge_transfer VNLGlassAttachment *)stored;
      [entry detach];
    }
  };
  if (GlassIsMainThread()) remove();
  else dispatch_async(dispatch_get_main_queue(), remove);
}

bool UpdateGlassEffectView(uint64_t owner, int id, GlassPresentation presentation) {
  auto found = attachments.find(id);
  if (found == attachments.end() || Peek(found->second).owner != owner) return false;
  VNLGlassAttachment *entry = Peek(found->second);
  if (!GlassIsSupported()) {
    RemoveGlassEffectView(owner, id);
    return false;
  }
  if (!entry.container || !entry.container.window) {
    RemoveGlassEffectView(owner, id);
    return false;
  }
  entry.glass.cornerRadius = presentation.radius;
  entry.glass.tintColor = ColorFromHex(presentation.tint);
  if (presentation.opaque && !entry.background) {
    NSBox *background = [[NSBox alloc] initWithFrame:entry.container.bounds];
    background.boxType = NSBoxCustom;
    background.borderWidth = 0;
    background.fillColor = [NSColor windowBackgroundColor];
    background.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    background.accessibilityElement = NO;
    entry.background = background;
    [entry.container addSubview:background positioned:NSWindowBelow relativeTo:entry.glass];
  } else if (!presentation.opaque && entry.background) {
    [entry.background removeFromSuperview];
    entry.background = nil;
  }
  if (entry.background) {
    entry.background.wantsLayer = YES;
    entry.background.layer.cornerRadius = presentation.radius;
    entry.background.layer.masksToBounds = YES;
  }
  return true;
}

int AddGlassEffectView(uint64_t owner, uintptr_t handle, GlassPresentation presentation) {
  if (!GlassIsSupported() || !NSApp || nextId > INT32_MAX) return -1;
  NSView *container = nil;
  for (NSWindow *window in NSApp.windows) {
    container = FindView(window.contentView, handle);
    if (container) break;
  }
  if (!container || !container.window) return -1;
  for (const auto &pair : attachments) {
    VNLGlassAttachment *existing = Peek(pair.second);
    if (existing.container == container) {
      if (existing.owner != owner) return -1;
      return UpdateGlassEffectView(owner, pair.first, presentation) ? pair.first : -1;
    }
  }
  NSView<VNLGlassProperties> *glass = [[NSClassFromString(@"NSGlassEffectView") alloc] initWithFrame:container.bounds];
  if (!glass) return -1;
  glass.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  glass.accessibilityElement = NO;
  VNLGlassAttachment *entry = [VNLGlassAttachment new];
  entry.owner = owner;
  entry.container = container;
  entry.glass = glass;
  int id = static_cast<int>(nextId++);
  attachments.emplace(id, (__bridge_retained void *)entry);
  [container addSubview:glass positioned:NSWindowBelow relativeTo:nil];
  entry.closeObserver = [[NSNotificationCenter defaultCenter]
    addObserverForName:NSWindowWillCloseNotification object:container.window queue:nil
    usingBlock:^(NSNotification *) { RemoveGlassEffectView(owner, id); }];
  entry.accessibilityObserver = [[[NSWorkspace sharedWorkspace] notificationCenter]
    addObserverForName:NSWorkspaceAccessibilityDisplayOptionsDidChangeNotification object:nil queue:[NSOperationQueue mainQueue]
    usingBlock:^(NSNotification *) {
      if (!GlassIsSupported()) RemoveGlassEffectView(owner, id);
    }];
  if (!UpdateGlassEffectView(owner, id, presentation)) return -1;
  return id;
}
