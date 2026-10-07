# Forge availability page

Cloudflare Worker `unicorn-forge-availability` runs on the existing proxied route `forge.tetheredunicorn.com/*`. It fetches the original Tunnel origin with the incoming request. DNS and the laptop's startup behavior are unchanged.

Gateway failures and failed connections return an uncached, branded HTTP 503 page for document navigation. API failures return JSON; asset failures return plain text. Authentication errors, successful responses, cookies, and streams pass through. Requests are never automatically retried. Page navigation has a 12-second response-header timeout; API workloads do not inherit it.

The page needs no JavaScript or storage. Its optional brand image is served by the independent main website. The copy remains usable even if the image cannot load. There is no advertised recovery time or claim that unsaved work was saved.

- Preview: https://forge.tetheredunicorn.com/__forge-unavailable (always 503, independent of origin state)
- Test: `node --test forge-edge/handler.test.mjs`
- Browser checks: `node forge-edge/preview.cjs` with Playwright available
- Deploy from the repository: `node worker/node_modules/wrangler/bin/wrangler.js deploy --config forge-edge/wrangler.jsonc` using Node 22 or newer
- Rollback: remove only this Worker's `forge.tetheredunicorn.com/*` route to return to direct Tunnel delivery; leave the DNS record and other Workers unchanged.

October 7, 2026 verification: six behavior tests, three viewport/retry checks, Wrangler type generation and dry run passed. The live origin was returning 502 before deployment; afterward `/` returned branded HTML 503 and `/api/field/status` returned a readable JSON 503. Healthy passthrough was tested with a simulated origin; live healthy-origin verification awaits Forge being online.
