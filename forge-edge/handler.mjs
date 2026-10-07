const GATEWAY_ERRORS = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);
const headers = {
  'Cache-Control': 'no-store, max-age=0',
  'Retry-After': '60',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https://tetheredunicorn.com; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};

export function createHandler(html, originFetch = fetch, timeoutMs = 12000) {
  return async function handle(request) {
    const url = new URL(request.url);
    const read = request.method === 'GET' || request.method === 'HEAD';
    const api = url.pathname.startsWith('/api/');
    const document = read && !api && (url.pathname === '/' || url.pathname === '/index.html' || request.headers.get('sec-fetch-dest') === 'document' || request.headers.get('accept')?.includes('text/html'));
    function unavailable(forcePage = false) {
      const isPage = forcePage || document;
      const body = isPage ? html : api
        ? JSON.stringify({ok:false, error:'Forge is temporarily unavailable. Please try again in a few minutes.'})
        : 'Forge is temporarily unavailable. Please try again in a few minutes.';
      return new Response(request.method === 'HEAD' ? null : body, {status:503, headers:{...headers, 'Content-Type':isPage ? 'text/html; charset=utf-8' : api ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8'}});
    }
    // Permanent review URL; does not change availability for other visitors.
    if (read && url.pathname === '/__forge-unavailable') return unavailable(true);
    let timer;
    const controller = new AbortController();
    try {
      // Bound page navigation only. Long-running API/streaming requests keep their original lifetime.
      if (document) timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await originFetch(request, document ? {signal:controller.signal} : undefined);
      if (GATEWAY_ERRORS.has(response.status) || (document && response.status >= 500)) {
        if (response.body) await response.body.cancel();
        return unavailable();
      }
      return response;
    } catch {
      // Never retry submitted work: a lost response does not prove the operation failed.
      return unavailable();
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
