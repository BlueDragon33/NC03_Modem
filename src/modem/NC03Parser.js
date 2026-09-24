export function parseNC03Response({ contentType = "", body = "" } = {}) {
  const type = String(contentType).toLowerCase();
  if (type.includes("application/json") || type.includes("+json")) {
    try { return { kind: "json", value: JSON.parse(body) }; }
    catch { return { kind: "invalid-json", value: String(body) }; }
  }
  if (type.includes("xml") || /^\s*</.test(String(body))) {
    return { kind: "xml-or-markup", value: String(body) };
  }
  return { kind: "text", value: String(body) };
}
