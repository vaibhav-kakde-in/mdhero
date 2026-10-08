import { basename } from "./path";

/**
 * Copy rendered HTML as rich text using selection-based approach.
 * Works reliably in Tauri webviews where ClipboardItem may not be supported.
 */
export async function copyAsRichText(html: string, _markdown: string): Promise<boolean> {
  try {
    // Create a temporary container with the rendered HTML
    const container = document.createElement("div");
    container.innerHTML = html;
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.opacity = "0";
    document.body.appendChild(container);

    // Select the content
    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Copy (this preserves rich text formatting)
    document.execCommand("copy");

    // Clean up
    selection?.removeAllRanges();
    document.body.removeChild(container);

    return true;
  } catch {
    // Fallback to Clipboard API
    try {
      const htmlBlob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([_markdown], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob }),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Copy raw markdown source to clipboard.
 */
export async function copyAsMarkdown(markdown: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a file's absolute path to clipboard.
 */
export async function copyPath(path: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a file's name — the last segment of its path, extension included — to
 * clipboard.
 */
export async function copyFileName(path: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(basename(path));
    return true;
  } catch {
    return false;
  }
}
