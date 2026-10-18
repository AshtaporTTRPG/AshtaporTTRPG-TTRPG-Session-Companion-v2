/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reliable async clipboard copy helper with fallback to document.execCommand('copy')
 * via a temporary off-screen textarea to prevent iframe security drops.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Attempt standard navigator.clipboard API first
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Iframe security permissions or insecure context might fail; fall back to execCommand below
    }
  }

  // Fallback using off-screen textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('Fallback copy failed:', err);
    return false;
  }
}
