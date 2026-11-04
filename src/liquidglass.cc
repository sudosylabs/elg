#include <napi.h>
#include <atomic>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <regex>
#include "glass_effect.h"

static std::atomic<uint64_t> nextOwner{1};

class LiquidGlassNative : public Napi::ObjectWrap<LiquidGlassNative> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("LiquidGlassNative", DefineClass(env, "LiquidGlassNative", {
      InstanceMethod("isSupported", &LiquidGlassNative::IsSupported),
      InstanceMethod("addView", &LiquidGlassNative::AddView),
      InstanceMethod("updateView", &LiquidGlassNative::UpdateView),
      InstanceMethod("removeView", &LiquidGlassNative::RemoveView),
      InstanceMethod("dispose", &LiquidGlassNative::Dispose),
      InstanceMethod("testingSetSupportOverride", &LiquidGlassNative::TestingSetSupportOverride),
      InstanceMethod("testingPostAccessibilityChange", &LiquidGlassNative::TestingPostAccessibilityChange),
      InstanceMethod("testingDescribeView", &LiquidGlassNative::TestingDescribeView),
    }));
    return exports;
  }

  LiquidGlassNative(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<LiquidGlassNative>(info), owner(nextOwner++) {}

  ~LiquidGlassNative() override {
    // Native teardown schedules onto AppKit if GC runs off the main thread.
    RemoveGlassEffectViews(owner);
  }

private:
  const uint64_t owner;
  bool disposed = false;

  bool CheckThread(Napi::Env env) {
    if (GlassIsMainThread()) return true;
    Napi::Error::New(env, "Liquid Glass requires the Electron main thread").ThrowAsJavaScriptException();
    return false;
  }

  bool ReadId(const Napi::CallbackInfo &info, int &id) {
    if (info.Length() && info[0].IsNumber()) {
      double value = info[0].As<Napi::Number>().DoubleValue();
      if (std::isfinite(value) && value >= 0 && value <= INT32_MAX && std::floor(value) == value) {
        id = static_cast<int>(value);
        return true;
      }
    }
    Napi::TypeError::New(info.Env(), "view id must be a non-negative int32").ThrowAsJavaScriptException();
    return false;
  }

  struct Options { double radius = 0; std::string tint; bool opaque = false; bool framed = false; GlassFrame frame; };

  bool ReadOptions(const Napi::CallbackInfo &info, size_t index, Options &out) {
    if (info.Length() <= index || info[index].IsUndefined()) return true;
    auto env = info.Env();
    if (!info[index].IsObject() || info[index].IsNull() || info[index].IsArray()) {
      Napi::TypeError::New(env, "options must be an object").ThrowAsJavaScriptException();
      return false;
    }
    auto options = info[index].As<Napi::Object>();
    auto radius = options.Get("cornerRadius");
    auto tint = options.Get("tintColor");
    auto opaque = options.Get("opaque");
    auto frame = options.Get("frame");
    if (env.IsExceptionPending()) return false;
    if (!radius.IsUndefined()) {
      if (!radius.IsNumber() || !std::isfinite(radius.As<Napi::Number>().DoubleValue()) || radius.As<Napi::Number>().DoubleValue() < 0) {
        Napi::TypeError::New(env, "cornerRadius must be finite and non-negative").ThrowAsJavaScriptException();
        return false;
      }
      out.radius = radius.As<Napi::Number>().DoubleValue();
    }
    if (!tint.IsUndefined()) {
      if (!tint.IsString() || !std::regex_match(tint.As<Napi::String>().Utf8Value(), std::regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?"))) {
        Napi::TypeError::New(env, "tintColor must be #RRGGBB or #RRGGBBAA").ThrowAsJavaScriptException();
        return false;
      }
      out.tint = tint.As<Napi::String>().Utf8Value();
    }
    if (!opaque.IsUndefined()) {
      if (!opaque.IsBoolean()) {
        Napi::TypeError::New(env, "opaque must be a boolean").ThrowAsJavaScriptException();
        return false;
      }
      out.opaque = opaque.As<Napi::Boolean>().Value();
    }
    if (!frame.IsUndefined()) {
      if (!ReadFrame(env, frame, out.frame)) return false;
      out.framed = true;
    }
    return true;
  }

  static bool IsPlainObject(const Napi::Value &value) {
    return value.IsObject() && !value.IsNull() && !value.IsArray();
  }

  bool ReadFrame(Napi::Env env, const Napi::Value &value, GlassFrame &out) {
    if (!IsPlainObject(value)) {
      Napi::TypeError::New(env, "frame must be an object").ThrowAsJavaScriptException();
      return false;
    }
    auto frame = value.As<Napi::Object>();
    const char *names[] = {"x", "y", "width", "height"};
    double *fields[] = {&out.x, &out.y, &out.width, &out.height};
    for (int i = 0; i < 4; i++) {
      auto field = frame.Get(names[i]);
      if (env.IsExceptionPending()) return false;
      if (!field.IsNumber() || !std::isfinite(field.As<Napi::Number>().DoubleValue()) || field.As<Napi::Number>().DoubleValue() < 0) {
        Napi::TypeError::New(env, "frame x, y, width and height must be finite and non-negative").ThrowAsJavaScriptException();
        return false;
      }
      *fields[i] = field.As<Napi::Number>().DoubleValue();
    }
    auto anchors = frame.Get("anchors");
    if (env.IsExceptionPending()) return false;
    if (anchors.IsUndefined()) return true;
    if (!IsPlainObject(anchors)) {
      Napi::TypeError::New(env, "frame anchors must be an object").ThrowAsJavaScriptException();
      return false;
    }
    const char *edges[] = {"top", "right", "bottom", "left"};
    bool *flags[] = {&out.top, &out.right, &out.bottom, &out.left};
    for (int i = 0; i < 4; i++) {
      auto edge = anchors.As<Napi::Object>().Get(edges[i]);
      if (env.IsExceptionPending()) return false;
      if (!edge.IsUndefined() && !edge.IsBoolean()) {
        Napi::TypeError::New(env, "frame anchors must be booleans").ThrowAsJavaScriptException();
        return false;
      }
      *flags[i] = !edge.IsUndefined() && edge.As<Napi::Boolean>().Value();
    }
    return true;
  }

  Napi::Value IsSupported(const Napi::CallbackInfo &info) {
    if (!CheckThread(info.Env())) return info.Env().Undefined();
    return Napi::Boolean::New(info.Env(), !disposed && GlassIsSupported());
  }

  Napi::Value AddView(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    if (!CheckThread(env)) return env.Undefined();
    if (!info.Length() || !info[0].IsBuffer() || info[0].As<Napi::Buffer<uint8_t>>().Length() != sizeof(uintptr_t)) {
      Napi::TypeError::New(env, "handle must be a pointer-sized Buffer").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    uintptr_t handle = 0;
    std::memcpy(&handle, info[0].As<Napi::Buffer<uint8_t>>().Data(), sizeof(handle));
    if (!handle) {
      Napi::TypeError::New(env, "handle must not be null").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    Options options;
    if (!ReadOptions(info, 1, options)) return env.Undefined();
    return Napi::Number::New(env, disposed ? -1 : AddGlassEffectView(owner, handle, Presentation(options)));
  }

  Napi::Value UpdateView(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    if (!CheckThread(env)) return env.Undefined();
    int id; Options options;
    if (!ReadId(info, id) || !ReadOptions(info, 1, options)) return env.Undefined();
    return Napi::Boolean::New(env, !disposed && UpdateGlassEffectView(owner, id, Presentation(options)));
  }

  Napi::Value RemoveView(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    if (!CheckThread(env)) return env.Undefined();
    int id;
    if (!ReadId(info, id)) return env.Undefined();
    return Napi::Boolean::New(env, !disposed && RemoveGlassEffectView(owner, id));
  }

  Napi::Value Dispose(const Napi::CallbackInfo &info) {
    if (!CheckThread(info.Env())) return info.Env().Undefined();
    if (!disposed) { disposed = true; RemoveGlassEffectViews(owner); }
    return info.Env().Undefined();
  }

  static bool TestingEnabled() {
    const char *value = std::getenv("ELG_TESTING");
    return value != nullptr && std::strcmp(value, "1") == 0;
  }

  static GlassPresentation Presentation(const Options &options) {
    return GlassPresentation{options.radius, options.tint.c_str(), options.opaque, options.framed, options.frame};
  }

  bool RequireTesting(Napi::Env env) {
    if (!CheckThread(env)) return false;
    if (TestingEnabled()) return true;
    Napi::Error::New(env, "ELG_TESTING=1 is required").ThrowAsJavaScriptException();
    return false;
  }

  Napi::Value TestingSetSupportOverride(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    if (!RequireTesting(env)) return env.Undefined();
    if (!info.Length() || info[0].IsNull() || info[0].IsUndefined()) GlassSetSupportOverride(0);
    else if (info[0].IsBoolean() && !info[0].As<Napi::Boolean>().Value()) GlassSetSupportOverride(-1);
    else Napi::TypeError::New(env, "support override must be false or null").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Value TestingDescribeView(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    if (!RequireTesting(env)) return env.Undefined();
    int id;
    if (!ReadId(info, id)) return env.Undefined();
    GlassViewState state;
    if (disposed || !GlassDescribeView(owner, id, state)) return env.Undefined();
    auto result = Napi::Object::New(env);
    result.Set("x", state.x);
    result.Set("y", state.y);
    result.Set("width", state.width);
    result.Set("height", state.height);
    result.Set("backed", state.backed);
    result.Set("order", state.order);
    return result;
  }

  Napi::Value TestingPostAccessibilityChange(const Napi::CallbackInfo &info) {
    auto env = info.Env();
    if (!RequireTesting(env)) return env.Undefined();
    GlassDeliverAccessibilityChange();
    return env.Undefined();
  }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return LiquidGlassNative::Init(env, exports);
}
NODE_API_MODULE(liquidglass, Init)
