import WebApp from "@twa-dev/sdk";

type WebAppWithClipboard = typeof WebApp & {
  readTextFromClipboard?: (callback?: (text: string) => void) => void;
};

/** Копирование в буфер (Telegram Desktop WebView часто блокирует Clipboard API). */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback */
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("aria-hidden", "true");
    ta.style.cssText =
      "position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:none;outline:none;opacity:0.01;z-index:-1;";
    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    /* fallback */
  }

  try {
    const span = document.createElement("span");
    span.textContent = text;
    span.style.cssText = "position:fixed;top:0;left:0;opacity:0.01;white-space:pre;";
    document.body.appendChild(span);
    const range = document.createRange();
    range.selectNodeContents(span);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const ok = document.execCommand("copy");
    document.body.removeChild(span);
    sel?.removeAllRanges();
    if (ok) return true;
  } catch {
    /* fallback */
  }

  return false;
}

/** Выделить текст в поле — запасной способ копирования в Telegram Desktop. */
export function selectFieldText(el: HTMLInputElement | HTMLTextAreaElement): void {
  el.focus({ preventScroll: true });
  el.select();
  if (typeof el.setSelectionRange === "function") {
    el.setSelectionRange(0, el.value.length);
  }
}

/** Чтение из буфера (по клику; в TDesktop Ctrl+V часто не работает). */
export async function readFromClipboard(): Promise<string | null> {
  try {
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text) return text;
    }
  } catch {
    /* fallback */
  }

  const wa = WebApp as WebAppWithClipboard;
  if (typeof wa.readTextFromClipboard !== "function") return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      wa.readTextFromClipboard!((text) => {
        finish(text?.trim() ? text : null);
      });
    } catch {
      finish(null);
      return;
    }

    window.setTimeout(() => finish(null), 2500);
  });
}
