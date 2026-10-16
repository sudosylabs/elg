#pragma once
#include <cstdint>

struct GlassPresentation {
  double radius = 0;
  const char *tint = nullptr;
  bool opaque = false;
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
