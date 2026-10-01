const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Makes text safe inside HTML built by hand (the printable receipts opened in
 * a new tab). Those tabs share the panel's origin, so a buyer or animal name
 * containing markup would otherwise run as script with the user's login.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ENTITIES[c]);
}
