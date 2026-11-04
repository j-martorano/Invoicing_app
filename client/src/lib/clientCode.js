// Client code used as the invoice prefix: first word of the client name,
// lowercased, alphanumeric only, max 12 chars. Falls back to 'client'.
// Must stay in sync with clientCodeFromName() in server.js.
export function clientCodeFromName(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const code = first.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  return code || 'client';
}

export function pad4(n) {
  return String(n).padStart(4, '0');
}
