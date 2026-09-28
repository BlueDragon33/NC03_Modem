export async function fetchStaticSource(baseUrl, path, { fetchImpl = globalThis.fetch } = {}) {
  const url = new URL(path, baseUrl);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, {
      method:"GET",
      redirect:"manual",
      signal:AbortSignal.timeout(2200),
      headers:{ Accept:"text/html,application/javascript,text/javascript,*/*;q=0.5" }
    });
    const contentType = String(response.headers.get("content-type") || "");
    const diagnostic = {
      path:url.pathname,
      status:response.ok ? "HTTP_OK" : response.status >= 300 && response.status < 400 ? "REDIRECT" : "HTTP_ERROR",
      httpStatus:response.status,
      contentType:contentType.split(";")[0] || null,
      durationMs:Date.now() - startedAt
    };
    if (!response.ok) return { item:null, diagnostic };
    if (!/javascript|text\/(?:html|plain)|application\/x-javascript/i.test(contentType)) {
      return { item:null, diagnostic:{ ...diagnostic, status:"UNSUPPORTED_CONTENT" } };
    }
    const text = await response.text();
    return {
      item:{ path:url.pathname, source:text.slice(0, 524288) },
      diagnostic:{ ...diagnostic, bytes:Buffer.byteLength(text) }
    };
  } catch (error) {
    const name = String(error?.name || "");
    return {
      item:null,
      diagnostic:{
        path:url.pathname,
        status:name === "TimeoutError" || name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
        httpStatus:null,
        contentType:null,
        durationMs:Date.now() - startedAt
      }
    };
  }
}

export async function collectWriteSourceEvidence({ baseUrl, paths, fetchImpl } = {}) {
  const results = await Promise.all(paths.map((path) => fetchStaticSource(baseUrl, path, { fetchImpl })));
  const diagnostics = results.map((result) => result.diagnostic);
  return {
    sources:results.map((result) => result.item).filter(Boolean),
    diagnostics,
    summary:diagnostics.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {})
  };
}
