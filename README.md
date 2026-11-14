# SearchParty

A phone-friendly website for coordinating a missing dog or cat search. Helpers open a link, choose a name and optionally add a photo. No app installation or helper account is required.

The primary deployment is a **static React website with a PHP and SQLite API on cPanel hosting**. Node.js is needed to build the website locally; it is not needed on the hosting account. See [DEPLOY-CPANEL.md](DEPLOY-CPANEL.md) for deployment and database setup.

The requested hosting preview is [the cPanel preview address](https://exquisite-cyan-aardvark.91-204-209-67.cpanel.site/). This is a technical preview domain and may display the hosting provider's banner. This documentation does not confirm deployment status or a DNS connection for `searchparty.co.uk`.

## Build and run locally

Requirements: Node.js 22.13 or newer (Node 24 recommended), npm, and PHP 8.1 or newer with the `pdo_sqlite` extension.

```sh
npm ci
npm run build
```

The build creates `release-upload/`, containing the static website, vendored map library, PHP backend and Apache configuration. The build recreates this directory; keep runtime data and any hosting-specific configuration outside it or in the tracked source under `cpanel/`.

For a local preview on Windows PowerShell, run these commands from the project directory:

```powershell
$env:SEARCHPARTY_DATA_DIR = Join-Path (Get-Location) '.sites-runtime/php-test-data'
php -S 127.0.0.1:8788 -t release-upload scripts/php-router.php
```

Open `http://127.0.0.1:8788`. The SQLite database is created automatically in the configured private data directory. This preview uses PHP's development server; production routing uses the included `.htaccess` files.

For frontend development with automatic refresh, start the PHP command above on **port 8088**, then run `npm run dev` in another terminal. Vite serves the interface at its printed local URL, normally `http://127.0.0.1:5174`, and proxies `/api` to PHP on port 8088. `npm run build:cpanel` and `npm run dev:cpanel` remain aliases for these default build and development commands.

GPS works on localhost and HTTPS websites. A plain HTTP address on your local network generally will not allow GPS on a phone.

## Included features

- Guest profiles remembered by a private, HttpOnly device cookie; optional photo avatars.
- Pet searches with a description, photo, last-seen location and time, and organiser instructions.
- Random share codes and direct links; organiser approval before private room access.
- An interactive map with last-seen pins, sightings, timestamped search areas and optional helper locations.
- Shared chat and separate organiser updates, refreshed every five seconds while the page is visible.
- Explicit start/stop location sharing, freshness indicators and server expiry. A location version prevents a delayed update from restarting sharing after a successful stop.
- Organiser and moderator roles, member approval/removal, paused joins, message/report deletion, abuse reports and a review queue.
- Server-enforced permissions, persistent rate limits, duplicate-message checks and a small phrase filter for human review.
- Local chat muting, optional photo uploads and a clearly labelled interactive demo that does not create real searches or share GPS.
- Search closure that clears helper positions and stops new search/chat activity.

Only dogs and cats are supported. Missing-person coordination needs a separate workflow and is outside this version.

## Validation

```sh
npm run typecheck
npm test
```

`npm test` runs `tests/php-validation.php` against the PHP validation code used by the deployed API. PHP must be on `PATH`; alternatively, set the `PHP_BINARY` environment variable to the absolute path of the PHP executable. No running web server is needed for these validation checks.

With the PHP preview running on port 8788, run the multi-session API checks in another PowerShell terminal:

```powershell
$env:TEST_BASE_URL = 'http://127.0.0.1:8788'
npm run test:integration
```

The integration tests create artificial searches in the local database and use separate cookie jars to exercise permissions, approval, chat, sightings, moderation and location sharing. The test runner refuses non-local URLs. This suite checks the actual API served at `TEST_BASE_URL`; use the PHP preview described above.

After a build, `node tests/page-shell.mjs` checks the PHP HTML entry point on localhost (default port 8789, configurable with `TEST_BASE_URL`). It inspects advertising exclusions and CSP nonces without executing scripts or contacting Google. See [AdSense setup and page separation](DEPLOY-CPANEL.md#adsense-setup-and-page-separation) for the account/CMP setup, environment disable switch and optional second-server test.

## Source layout

- `app/page.tsx`, `app/components/`, `app/lib/` — React interface, map, browser helpers and local demo.
- `app/types.ts`, `API-CONTRACT.md` — shared API contract.
- `index.html`, `web/main.tsx`, `vite.cpanel.config.ts` — static frontend entry and build configuration.
- `cpanel/index.php` — HTML entry point, homepage-only AdSense loader and document-specific CSP.
- `cpanel/api.php`, `cpanel/server/` — PHP API, validation and SQLite schema.
- `cpanel/.htaccess` — production routing, security headers and private-file restrictions.
- `scripts/build-cpanel.mjs`, `scripts/php-router.php` — upload packaging and local PHP preview.
- `tests/php-validation.php`, `tests/integration.mjs`, `tests/page-shell.mjs` — PHP validation, multi-session API checks and HTML/CSP checks.

Leaflet is vendored with its licence. Map tiles come from OpenStreetMap and need internet access; no map API key is required. Review the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before scaling traffic.

Unused Vinext/Cloudflare starter and reference files remain under `app/api/`, `lib/server/`, `db/`, `drizzle/` and related starter paths. They are excluded from the active TypeScript check and the upload package; they are not a supported deployment alternative. `.openai/hosting.json` does not configure the cPanel runtime. The supported build and development commands above use React, Vite and the PHP backend.

## Operational limits

Guest profiles belong to a browser, not a verified identity. Clearing browser data can lose organiser access and can let a banned person request access again. Organiser recovery and stronger identity checks are not implemented. Another moderator can help manage a search but cannot replace the organiser's exclusive controls.

The public appeal, including its pet photo and last-seen location, is visible to anyone with the search code. Exact helper positions and private chat are restricted to approved members. Positions are cleared when sharing stops, a member is removed, or a search closes. Stale positions expire from room responses after 30 minutes. An interrupted connection can prevent a stop request reaching the server, so expiry is enforced there too.

Location sharing pauses when the page is hidden or the phone is locked. This version uses foreground polling, not reliable background tracking, push notifications or SMS.

Photos are resized in the browser, checked on the server and stripped of JPEG metadata. Uploads have strict size limits. Profiles, photos and messages can be reported to the organiser; there is no external image moderation service or staffed review service. Phrase filtering is a baseline, not comprehensive automated moderation.

Closing a search does not delete its appeal, photos or chat history. Before broader operation, define retention/deletion procedures, database backups and abuse handling, and test capacity for the expected audience. Keep the SQLite database outside all public document roots and out of upload bundles.
