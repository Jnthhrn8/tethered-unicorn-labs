# Tethered Unicorn Labs public website

Public company website for **Tethered Unicorn Labs**, a product lab making personalized software and AI-driven hardware more attainable and playful. The first product tracks are **Unicorn Forge** and **UniCrypt**.

## Public pages

- `index.html` — colorful Tethered Unicorn Labs company homepage;
- `forge.html` — dedicated black-and-gold Unicorn Forge product page;
- `unicrypt.html` — dedicated UniCrypt founders-prototype page;
- `investors.html` — early investor overview and funding cases;
- `contact.html` — direct email, text, phone, and WhatsApp links;
- `partners.html` — colorful collaboration, sponsorship, and affiliate-partnership information.

## Boundaries

The company positioning leads with Unicorn Forge and TraceWell, software capabilities, and planned hosted SaaS services. UniCrypt is a complementary hardware research project. Hosted subscriptions and service capacity remain under validation; the original funding scenarios need reconciliation with the SaaS operating budget. Public copy does not describe the owner's authentication method.

This is a public marketing property. It must remain separate from:

- tester chats and memories;
- the gated field-test portal;
- the owner command console;
- device, activity, or debugging records;
- private legal-acceptance records.

## Local preview

Open `index.html` directly, or run a simple static web server in this directory.

## Domain

The canonical domain is `tetheredunicorn.com`. The included `CNAME` file supports a GitHub Pages deployment. HTTPS certificate provisioning was restarted and HTTPS enforcement enabled on October 5, 2026. Both HTTP and www redirect to the canonical HTTPS site.

## Before launch

- Complete preliminary trademark and entity-name clearance.
- Replace the provisional company-formation footer once the legal entity exists.
- Privacy, website terms, accessibility, and contact pages are present. Public policies cover the marketing site only; independent legal and accessibility review remains outstanding.
- [ ] Verify end-to-end delivery for `theunicorn@tetheredunicorn.com`; routing is configured but receipt is not yet proven.
- WebP delivery assets, a small favicon, and three 1200 × 630 social cards are included; original PNG artwork is preserved.
- Test mobile layout, accessibility, links, metadata, and HTTPS.

## Contact Worker

Public contact uses direct email, text, phone, and WhatsApp links on `contact.html`; it does not use Workers KV. The old `/contact` Worker endpoint returns HTTP 410 and performs no KV operations. The separate field-test application still posts structured entrance answers to the Worker at `messages.tetheredunicorn.com`, which holds them in a 30-day queue for the private Forge bridge. This avoids exposing a Tailscale service or ntfy credential to the public internet.

The scheduled bridge uses `forge-contact-bridge.vbs` so polling remains completely hidden. Its latest health result is written to `%LOCALAPPDATA%\HermesCommandCenter\contact-bridge\bridge-status.json`; credentials are never written to that status file.

The `UnicornForge Website Contact Bridge` Windows task must repeat **every three hours** (eight checks/day), not every minute. Each inbox check currently makes two Workers KV list requests (one contact queue and one field-request queue), even when both are empty. A one-minute schedule consumes roughly 2,880 list requests/day per computer; the three-hour schedule uses about 16/day, with up to a three-hour delivery delay. Keep only one bridge task active for this queue when possible, and use the status file to confirm the most recent check. Do not shorten the interval without rechecking the current [Workers KV list allowance](https://developers.cloudflare.com/kv/platform/pricing/).

The field-test portal posts completed 18+ access applications to the Worker's `/field-request` route. Those structured applications remain queued while Forge is offline. The bridge relays them to the loopback-only field API, which creates the pending owner-console record and publishes the private ntfy alert.

Required Worker secret:

- `FORGE_INBOX_TOKEN`

Deploy from `worker/` with Wrangler after authenticating the Cloudflare account. The browser never receives the inbox token.

## Website verification

Run `node preview-site.cjs` with Playwright available to start an ephemeral loopback preview, check all public pages at desktop and mobile widths, and generate ignored screenshots. `PREVIEW_BASE_URL` can point to the deployed site. Results do not establish full accessibility conformance.
