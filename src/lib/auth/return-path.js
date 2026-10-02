export function safeReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  // Reject protocol-relative URLs, backslashes, and encoded equivalents.
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return "/";
    const url = new URL(value, "https://internal.invalid");
    if (url.origin !== "https://internal.invalid") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
