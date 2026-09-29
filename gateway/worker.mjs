const ORIGIN = "https://tscuite.github.io";
const SIGNATURE_HEADERS = ["X-Auth-Timestamp", "X-Auth-Nonce", "X-Auth-Signature"];
const PUBLIC_ROUTES = new Map([
  ["/api/public/memories", 300],
  ["/api/public/config/foods", 0], // Configuration reads must reflect a successful save immediately.
  ["/api/public/config/holidays", 3600],
]);
const EXTERNAL_ROUTES = new Map([
  ["/api/public/weather", ["https://api.open-meteo.com/v1/forecast?latitude=39.9042&longitude=116.4074&current=temperature_2m,weather_code&timezone=Asia%2FShanghai", 600]],
  ["/api/public/quote", ["https://v1.hitokoto.cn/?c=d&c=i&c=k", 1800]],
]);

function routeFor(path) {
  if (PUBLIC_ROUTES.has(path)) return { methods: ["GET", "HEAD"], ttl: PUBLIC_ROUTES.get(path) };
  if (EXTERNAL_ROUTES.has(path)) {
    const [upstream, ttl] = EXTERNAL_ROUTES.get(path);
    return { methods: ["GET", "HEAD"], upstream, ttl };
  }
  if (path === "/api/memories" || /^\/api\/memories\/[1-9]\d*$/.test(path)) return { methods: ["GET", "HEAD"], private: true };
  if (path === "/api/memories/query") return { methods: ["POST"], private: true };
  if (path === "/api/config/foods") return { methods: ["PUT"], private: true };
  return null;
}

function respond(response, request, ttl = 0) {
  // Do not relay upstream redirects, cookies, wildcard CORS or internal diagnostic headers.
  const headers = new Headers({
    "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8",
    "Cache-Control": ttl && response.ok ? `public, max-age=${ttl}` : "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  });
  if (request.headers.get("Origin") === ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ORIGIN);
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, OPTIONS");
    headers.set("Access-Control-Allow-Headers", `Content-Type, ${SIGNATURE_HEADERS.join(", ")}`);
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
}

function error(message, status, request) {
  return respond(Response.json({ error: message }, { status }), request);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (origin && origin !== ORIGIN) return error("Origin not allowed", 403, request);
    const route = routeFor(url.pathname);
    if (!route) return error("Not Found", 404, request);
    if (request.method === "OPTIONS") {
      const method = request.headers.get("Access-Control-Request-Method");
      return route.methods.includes(method)
        ? respond(new Response(null, { status: 204 }), request)
        : error("Method not allowed", 405, request);
    }
    if (!route.methods.includes(request.method)) return error("Method not allowed", 405, request);
    if (route.private && SIGNATURE_HEADERS.some(name => !request.headers.get(name))) return error("Signature required", 401, request);
    // The upstream verifies HMAC. This gateway never stores a key or signs on a visitor's behalf.
    if (url.search.length > 2048) return error("Query too long", 414, request);
    if (route.upstream && url.search) return error("This endpoint takes no query parameters", 400, request);

    try {
      const cache = globalThis.caches?.default;
      const cacheKey = new Request(url.href, { method: "GET" });
      const canCache = !route.private && route.ttl > 0 && request.method === "GET";
      if (canCache && cache) {
        const cached = await cache.match(cacheKey);
        if (cached) return respond(cached, request, route.ttl);
      }

      let response;
      if (route.upstream) {
        response = await fetch(route.upstream, { redirect: "error", signal: AbortSignal.timeout(8000) });
        if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) {
          return error("Upstream temporarily unavailable", 502, request);
        }
      } else {
        const headers = new Headers({ "Accept": "application/json" });
        for (const name of [...SIGNATURE_HEADERS, "Content-Type"]) {
          if (request.headers.has(name)) headers.set(name, request.headers.get(name));
        }
        let body;
        if (request.method !== "GET" && request.method !== "HEAD") {
          if (Number(request.headers.get("Content-Length")) > 65536) return error("Body too large", 413, request);
          const reader = request.body?.getReader();
          const chunks = [];
          let size = 0;
          while (reader) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 65536) { await reader.cancel(); return error("Body too large", 413, request); }
            chunks.push(value);
          }
          body = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        }
        // Host is irrelevant to the backend's HMAC; path, query, method and bytes stay unchanged.
        response = await env.MEMORY.fetch(new Request(request.url, { method: request.method, headers, body, redirect: "manual" }));
        if (response.status >= 300 && response.status < 400) return error("Unexpected upstream redirect", 502, request);
      }
      const result = respond(response, request, canCache ? route.ttl : 0);
      if (canCache && cache && result.ok) {
        const cached = new Response(result.clone().body, result);
        cached.headers.delete("Vary");
        cached.headers.delete("Access-Control-Allow-Origin");
        ctx.waitUntil(cache.put(cacheKey, cached));
      }
      return result;
    } catch {
      return error("Service temporarily unavailable", 502, request);
    }
  },
};
