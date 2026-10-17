// The unsaved-changes prompts (#160).
//
// These used `ask()`, which can only offer two buttons and resolves to "was the
// OK button clicked". Escape and the close box both resolve to `false`, so the
// cancel-position button doubles as the Escape action — and with the safe
// answer on OK (so a reflexive Return could not destroy work), Escape meant
// Discard. Pressing it on Cmd+Q threw away every dirty tab, with no recovery:
// a `new://` document is not in the session that gets restored.
//
// `message()` with three custom buttons does not have that constraint. Return
// activates the first button, Escape the one titled "Cancel" — NSAlert gives
// that exact title the Escape key equivalent — so both reflexes are now safe
// and Discard is only ever reached by clicking it.
//
// Two rules hold the fix in place:
//
//  1. The destructive answer is matched explicitly. Everything else, including
//     a label we do not recognise and a dialog that throws, is treated as
//     Cancel. The old code did the opposite: it fell through to the
//     destructive path, which is why a dialog failure also quit the app.
//  2. The cancel button is titled exactly "Cancel". That string is what makes
//     Escape work on macOS; renaming it silently removes the Escape route.
//     So it stays in English even when the other buttons are translated, until
//     a translated Cancel is shown to keep Escape there.

import { translate } from "../i18n";

/** The English labels. With custom buttons the dialog resolves to the label
 *  string of the button that was clicked, not to "Yes"/"No"/"Cancel". */
export const SAVE_LABEL = "Save";
export const DISCARD_LABEL = "Discard";
export const CANCEL_LABEL = "Cancel";
export const OVERWRITE_LABEL = "Overwrite";

/** The labels in the interface language, bar Cancel (rule 2). Each prompt
 *  reads them once and compares the result against the same strings it showed. */
function labels() {
  return {
    save: translate("common.save"),
    discard: translate("page.discard"),
    overwrite: translate("page.overwrite"),
    cancel: CANCEL_LABEL,
  };
}

export type UnsavedChoice = "save" | "discard" | "cancel";

/** Save / Discard / Cancel on unsaved edits. Anything other than an explicit
 *  Save or Discard is a cancel — including Escape, the close box, an
 *  unrecognised result and a dialog that fails to open. */
export async function promptUnsaved(message: string, title = "Unsaved changes"): Promise<UnsavedChoice> {
  try {
    const { message: dialog } = await import("@tauri-apps/plugin-dialog");
    const label = labels();
    const choice = await dialog(message, {
      title,
      kind: "warning",
      buttons: { yes: label.save, no: label.discard, cancel: label.cancel },
    });
    if (choice === label.save) return "save";
    if (choice === label.discard) return "discard";
    return "cancel";
  } catch (err) {
    console.error("Unsaved-changes dialog failed:", err);
    return "cancel";
  }
}

/** Overwrite / Cancel when the file changed on disk under unsaved edits (#97).
 *  There is no third answer here — not overwriting just leaves the edits in the
 *  tab — so this one is two buttons. True only on an explicit Overwrite. */
export async function promptOverwrite(message: string, title = "File changed on disk"): Promise<boolean> {
  try {
    const { message: dialog } = await import("@tauri-apps/plugin-dialog");
    const label = labels();
    const choice = await dialog(message, {
      title,
      kind: "warning",
      buttons: { ok: label.overwrite, cancel: label.cancel },
    });
    return choice === label.overwrite;
  } catch (err) {
    console.error("File-changed dialog failed:", err);
    return false;
  }
}
