#pragma once
#include <cstdint>

// A rectangle in the window's content, in points from its top-left corner. The view keeps
// its distance to each anchored edge as the window resizes; anchoring both opposite edges
// stretches it.
struct GlassFrame {
  double x = 0, y = 0, width = 0, height = 0;
  bool top = true, right = false, bottom = false, left = true;
};

struct GlassPresentation {
  double radius = 0;
  const char *tint = nullptr;
  bool opaque = false;
  // Without a frame the view covers the whole window.
  bool framed = false;
  GlassFrame frame;
};

// Where a view is now, for tests: its frame from the content's top-left, whether it has a
// backing, and its position among the window's glass views (0 is the bottom).
struct GlassViewState {
  double x = 0, y = 0, width = 0, height = 0;
  bool backed = false;
  int order = -1;
};

bool GlassIsMainThread();
bool GlassIsSupported();
int AddGlassEffectView(uint64_t owner, uintptr_t handle, GlassPresentation presentation);
bool UpdateGlassEffectView(uint64_t owner, int id, GlassPresentation presentation);
bool RemoveGlassEffectView(uint64_t owner, int id);
void RemoveGlassEffectViews(uint64_t owner);

// Test seam. Negative mode forces glass unavailable; 0 uses the live system policy.
void GlassSetSupportOverride(int mode);
void GlassDeliverAccessibilityChange();
bool GlassDescribeView(uint64_t owner, int id, GlassViewState &state);
