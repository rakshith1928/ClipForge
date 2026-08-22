// Only allow same-origin root-relative paths (AUDIT B2: ?redirect=//evil.com).

export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}
