# site/ — engzero.dev

The public vision site for engzero. Static, zero JavaScript, no build step, no external
requests. Synthesized from the four landing-page drafts marked as favorites in the vault
(`07-Landing-Pages`): **04 graduate-into** (structure and positioning), **08 manifesto**
(the essay section), **12 faq-objections** (the honest FAQ), and **07 terminal-dark**
(the visual system).

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire site — one page, semantic sections, anchored nav |
| | Outbound links: `github.com/pacificseabass/engzero` (nav, hero, closing, FAQ, footer) |
| `styles.css` | Design system and layout. The only stylesheet |
| `favicon.svg` | Shell-prompt mark, dark-square lockup |
| `robots.txt` | Allow-all plus sitemap pointer |
| `sitemap.xml` | Single URL; update `lastmod` when the copy changes materially |
| `_headers` | Security headers for Cloudflare Pages / Netlify (strict CSP, HSTS) |

Because there is no JavaScript anywhere, the CSP in `_headers` can be
`default-src 'none'` with only `style-src 'self'` and `img-src 'self' data:` opened up.
If you ever add a script or an embedded form, that header has to be relaxed — do it
deliberately, and prefer a `<form>` posting to an external endpoint over inline JS.

## Preview locally

```sh
pnpm site:dev     # http://localhost:4173
```

That is just `python3 -m http.server 4173 --directory site`. Any static server works;
the site has no server-side requirements.

## Deployment: Cloudflare Pages (recommended)

**Why this and not GitHub Pages.** The engzero repo carries the open-engine / private-authority
split as a design principle, and it is not published yet. GitHub Pages on a free account
requires a public repo, which forces a decision about publishing the whole runtime before
the site can go live. Cloudflare Pages supports **direct upload** — you ship the `site/`
directory from your machine with no repo connection at all — so the site launches on its
own schedule. Free tier covers unlimited bandwidth and automatic TLS, and putting the
domain on Cloudflare DNS now makes later subdomains (`docs.`, `mcp.`, `api.`) a one-line
change rather than a migration.

### 1. Create and deploy the project — DONE

The project exists and the site is live:

- **Project:** `engzero` (direct upload, no Git provider, production branch `main`)
- **Account:** releasetheseabass@gmail.com — `af352e5f2e1764b74d2563200fd307be`
- **Live at:** https://engzero.pages.dev

To ship a new version after editing `site/`:

```sh
pnpm dlx wrangler pages deploy site --project-name engzero --branch main --commit-dirty=true
```

Every run is versioned and instantly rollback-able from the Cloudflare dashboard. Drop
`--commit-dirty=true` once the repo is clean and you want the deploy tagged with a commit.

Verified on the first deploy: all six files upload, `_headers` is applied (confirmed via
`curl -I` — CSP, HSTS, `X-Frame-Options`, `Referrer-Policy` all present on the response),
and `/styles.css`, `/favicon.svg`, `/robots.txt`, `/sitemap.xml` all return 200 with the
right content types.

### Gotcha: Cloudflare imports the registrar's parking records

When you add a domain, Cloudflare's onboarding scan copies whatever records the old DNS
provider had — including the registrar's **parking page**. For engzero.dev that meant four
imported records that silently hijacked the domain:

```
engzero.dev     A      207.207.210.229   Proxied   <- Porkbun parking IP
engzero.dev     A      207.207.210.107   Proxied   <- Porkbun parking IP
*.engzero.dev   CNAME  pixie.porkbun.com Proxied   <- Porkbun parking host
www.engzero.dev CNAME  pixie.porkbun.com Proxied   <- Porkbun parking host
```

Symptoms this produces, which look like a broken deploy but aren't:

- `https://engzero.dev` fails with `TLS alert, handshake failure` — Cloudflare has no
  certificate because the Pages custom domain is stuck `pending`.
- `http://engzero.dev` returns **200** — but it's Porkbun's parking page proxied through
  Cloudflare (look for `gtag('config', ..., {'page_path': '/parked'})` in the body).
- `dig` looks healthy: the domain resolves to Cloudflare anycast IPs (`172.67.x`,
  `104.21.x`) because the records are proxied. Resolution is not the problem — origin is.

**Fix:** delete all four records in Cloudflare → DNS → Records. The Pages custom domain
then takes ownership of the hostname and provisions a certificate. Deleting the wildcard
matters as much as the apex; it catches `www` and anything else.

Diagnose it with `curl -sv https://engzero.dev 2>&1 | grep -i tls` (handshake failure means
no cert yet) and `curl -s http://engzero.dev | grep -i parked` (a hit means a stale origin
record is still winning).

### 2. Point engzero.dev at it — NOT DONE YET

As of the last deploy, `engzero.dev` is still on **Porkbun's** nameservers
(`curitiba/fortaleza/maceio/salvador.ns.porkbun.com`) and resolves to Porkbun's parking
page. It is **not** a zone in the Cloudflare account — only `cold-frame.dev` is.

The wrangler OAuth token on this machine has `zone (read)` but **not**
`com.cloudflare.api.account.zone.create`, so adding the zone cannot be automated from here.
It's a dashboard step:

1. Cloudflare dashboard → **Add a domain** → `engzero.dev` → select the **Free** plan.
2. Cloudflare scans existing records and shows you **two assigned nameservers**
   (a per-zone pair — not necessarily the same `anderson`/`nicole` pair as cold-frame.dev).
3. Porkbun → **Domain Management** → `engzero.dev` → **Authoritative Nameservers** →
   replace all four Porkbun entries with Cloudflare's two.
4. Wait for the zone to flip from *Pending* to *Active* (usually minutes; up to 24h).
5. Attach the domains to the Pages project. **There is no `wrangler pages domain`
   subcommand** in wrangler 4.x — it's an API call:

   ```sh
   curl -X POST -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
     --data '{"name":"engzero.dev"}' \
     https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/engzero/domains
   ```

6. **Create the DNS records.** Attaching a custom domain via the API does *not* create them
   (the dashboard flow does; the API flow doesn't). Without a record the domain sits at
   `status=pending` forever and no certificate is issued. Add two records:

   | Type  | Name  | Target              | Proxy    | TTL  |
   |-------|-------|---------------------|----------|------|
   | CNAME | `@`   | `engzero.pages.dev` | Proxied  | Auto |
   | CNAME | `www` | `engzero.pages.dev` | Proxied  | Auto |

   A CNAME on the apex is fine — Cloudflare's CNAME flattening handles it. Both must be
   **Proxied** (orange cloud); DNS-only will not serve the Pages project.

   Cloudflare provisions the TLS certificate within a few minutes of the records existing.

This mirrors exactly what `cold-frame.dev` already does on this account, so the pattern is
proven — it just needs the nameserver move.

**Why not keep DNS at Porkbun.** You could instead leave the nameservers alone and add an
ALIAS record on the apex plus a CNAME on `www`, both pointing at `engzero.pages.dev`. That
works, but it forgoes Cloudflare-managed DNS for later subdomains (`docs.`, `mcp.`) and
splits your two domains across two DNS providers for no benefit. Given cold-frame.dev is
already on Cloudflare, moving engzero.dev there keeps things consistent.

### 3. Contact — currently disabled on purpose

**There is no email address on the site right now.** `hello@engzero.dev` does not exist,
so rather than ship a dead `mailto:`, the CTAs point at on-page anchors and the closing
section says plainly that early access isn't open yet. Three HTML comments marked
`CONTACT NOT LIVE YET` (hero, closing section, footer) hold the exact markup to restore.

**This changed when DNS moved to Cloudflare.** Porkbun's email forwarding depends on
Porkbun's MX records, and those did not survive the nameserver move — the Cloudflare DNS
page now warns "Email cannot reach @engzero.dev addresses and they could be spoofed."
Use **Cloudflare Email Routing** instead, which is free and lives in the same dashboard:

1. Cloudflare → `engzero.dev` → **Email** → **Email Routing** → enable.
   It creates the required MX and SPF records for you.
2. Add a custom address: `hello@engzero.dev` → forward to your real inbox.
3. Verify the destination address (Cloudflare emails you a confirmation link).
4. Send a test, then uncomment the three blocks and revert the closing-section copy.

Caveat worth knowing before you rely on it: routing only *receives*. Replies come from
your personal address unless you also configure send-as, which needs SPF/DKIM work and is
a bigger job than the forward itself. If you want proper two-way mail on the domain, a
hosted mailbox (Fastmail, Migadu, Google Workspace) is the less fiddly path.

If you'd rather capture emails on-page than via mailto, add a `<form>` posting to
Buttondown or Formspree and relax `form-action` in `_headers` to that origin.

## Alternatives considered

| Option | Trade-off |
|---|---|
| **GitHub Pages** | Free and simple, but needs a public repo on the free tier — forces publishing the runtime early. Good choice *after* the open-source release. |
| **Netlify** | Comparable to Cloudflare Pages; `_headers` here is already Netlify-compatible. Slightly tighter free bandwidth cap. |
| **Vercel** | Excellent DX, but the free tier is licensed for non-commercial use, which is awkward for a project that intends to be a product. |
| **Porkbun static hosting** | Porkbun sells hosting, but there's no reason to couple the registrar to the host. Keep the domain portable. |

## Before you announce it

- [ ] Decide on a contact channel. Right now the site has none, which is honest for a
      pre-launch page but means a reader who wants in has no way to say so. Either set up
      the `hello@` forward (above) or add a newsletter form before you drive traffic here.
- [ ] Add an Open Graph image. `index.html` declares `twitter:card: summary_large_image`
      but ships no `og:image`, so link previews will render bare. A 1200×630 PNG at
      `/og.png` plus an `<meta property="og:image">` line fixes it.
- [x] ~~Add a licence to the repo.~~ Done — Apache-2.0 (`LICENSE`, `NOTICE`), so the
      site's "open source" claim is now backed.
- [x] ~~Rename the CLI binary to `engzero`.~~ Done — the terminal panel was re-captured
      against the renamed binary.
- [ ] Update the repo's GitHub description. It currently reads "Personal coding harness",
      which contradicts the positioning the site sells — the first thing a visitor sees
      after clicking through shouldn't undercut the page they came from. Set the repo's
      Website field to `https://engzero.dev` at the same time.
- [ ] Re-read the roadmap section against the current ADR. It mirrors
      `2026-07-07 Revised MVP Sequence`; if that decision is superseded, this section is
      the first thing that goes stale.

## Naming: engzero vs 3ng0

**engzero** is the project — the repo, the engine, the product, the domain. **3ng0** is the
name of a *running instance* (the maintainer's own agent). The site says "engzero"
throughout for that reason.

The CLI binary is now `engzero` too, so the terminal transcript matches the branding. The
config env var is `ENGZERO_CONFIG` and the default paths are `~/.config/engzero/` and
`~/.local/share/engzero/`.

Instance-level naming is the part that stays `3ng0`: the `agent.name` field in a user's
own config, and the maintainer's vault at `~/obsidian/3ng0`. A fresh install defaults
`agent.name` to `engzero` — nobody else's install should be named after someone's personal
agent.

## Editing notes

The status chips (`chip--built`, `chip--wip`, `chip--next`, `chip--vision`) are the honesty
mechanism of the whole page — they are what let the site describe a platform that mostly
does not exist yet without overclaiming. When a primitive actually ships, move its chip.
Do not quietly promote things to `shipping` to make the grid look fuller.

The terminal and ledger panels contain **real output** captured from the current build,
not mockups. The only edit is cosmetic: the ledger note's ISO timestamps
(`2026-08-10T20:50:36.763Z`) are abridged to time-of-day so the lines fit the column, and
the note is shown as an excerpt — the empty `Deployment Impact` / `Rollback Notes` /
`Model Trace` sections are omitted. Everything else is verbatim.

To re-capture after a CLI change, point the runtime at a throwaway vault rather than your
real one:

```sh
export ENGZERO_CONFIG=/tmp/engzero-demo/config.yaml   # vault root -> /tmp/engzero-demo/vault
pnpm dev project init homelab --risk medium
pnpm dev change-set create --project homelab --goal "Pin Jellyfin to 10.9" \
  --title "Pin Jellyfin" --risk medium
```

Keep each rendered line at or under ~58 characters; the panels are a two-column grid at
1040px and longer lines force a horizontal scrollbar that reads as broken.
