# Tethered Unicorn Labs public website

Public company website for **Tethered Unicorn Labs**, with **Unicorn Forge** as the flagship product.

## Public pages

- `index.html` — colorful Tethered Unicorn Labs company homepage;
- `forge.html` — dedicated black-and-gold Unicorn Forge product page;
- `contact.html` — direct contact form plus deliberately selected email and phone links;
- `partners.html` — sponsorship and affiliate-partnership information.

## Boundaries

This is a public marketing property. It must remain separate from:

- tester chats and memories;
- the gated field-test portal;
- the owner command console;
- device, activity, or debugging records;
- private legal-acceptance records.

## Local preview

Open `index.html` directly, or run a simple static web server in this directory.

## Domain

The canonical domain is `tetheredunicorn.com`. The included `CNAME` file supports a GitHub Pages deployment. Configure the registrar only after the hosting repository and HTTPS endpoint are ready.

## Before launch

- Complete preliminary trademark and entity-name clearance.
- Replace the provisional company-formation footer once the legal entity exists.
- Add reviewed privacy, terms, accessibility, and contact pages.
- [x] Configure `theunicorn@tetheredunicorn.com` to forward through Cloudflare Email Routing.
- Optimize the PNG brand asset and add social-card variants.
- Test mobile layout, accessibility, links, metadata, and HTTPS.

## Contact Worker

The public form posts to a separate Cloudflare Worker at `messages.tetheredunicorn.com`. The Worker validates and rate-limits submissions, then holds them in a 30-day queue. An outbound-only local bridge retrieves queued messages and publishes them into the Forge's private ntfy alert channel. This avoids exposing a Tailscale service or ntfy credential to the public internet.

The scheduled bridge uses `forge-contact-bridge.vbs` so polling remains completely hidden. Its latest health result is written to `%LOCALAPPDATA%\HermesCommandCenter\contact-bridge\bridge-status.json`; credentials are never written to that status file.

The field-test portal posts completed 18+ access applications to the Worker's `/field-request` route. Those structured applications remain queued while Forge is offline. The bridge relays them to the loopback-only field API, which creates the pending owner-console record and publishes the private ntfy alert.

Required Worker secret:

- `FORGE_INBOX_TOKEN`

Deploy from `worker/` with Wrangler after authenticating the Cloudflare account. The browser never receives the inbox token.
