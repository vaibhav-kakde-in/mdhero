import { describe, expect, it } from "vitest";
import { isMac, modifierKeyLabel } from "../../src/lib/utils/platform";

// Every shortcut label used to be hardcoded "Cmd" (#62's Ubuntu screenshot
// shows `Cmd+O` on the Linux home screen). The label is now derived from the
// platform string, which is what these pin down.
describe("modifierKeyLabel", () => {
  it("is Cmd on macOS", () => {
    expect(modifierKeyLabel("MacIntel")).toBe("Cmd");
    expect(modifierKeyLabel("macOS")).toBe("Cmd");
  });

  it("is Ctrl on Windows and Linux", () => {
    expect(modifierKeyLabel("Win32")).toBe("Ctrl");
    expect(modifierKeyLabel("Linux x86_64")).toBe("Ctrl");
    expect(modifierKeyLabel("Linux aarch64")).toBe("Ctrl");
  });

  it("falls back to Ctrl when the platform is unknown", () => {
    // An unknown platform must not claim a Command key it may not have.
    expect(modifierKeyLabel("")).toBe("Ctrl");
  });
});

// Gates the "open files in the existing window" setting (#71), which has no
// effect on macOS: the OS already sends files to the running app there.
describe("isMac", () => {
  it("is true only for macOS platform strings", () => {
    expect(isMac("MacIntel")).toBe(true);
    expect(isMac("Win32")).toBe(false);
    expect(isMac("Linux x86_64")).toBe(false);
    expect(isMac("")).toBe(false);
  });
});
