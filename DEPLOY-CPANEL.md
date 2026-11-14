# Deploy Search Pals to cPanel

This guide describes the PHP deployment package. It does not certify that a particular upload or deployment has completed.

The user-selected hosting preview is [exquisite-cyan-aardvark.91-204-209-67.cpanel.site](https://exquisite-cyan-aardvark.91-204-209-67.cpanel.site/). It is a technical preview domain and may display the hosting provider's warning banner. The intended permanent domain is `searchpals.co.uk`; DNS and HTTPS for that domain must be verified separately before treating it as connected.

The Search Pals rebrand retains the existing `searchparty` repository/branch and ZIP paths, `SEARCHPARTY_*` environment variables, PHP namespace, `sp_guest` cookie, `searchparty-muted` preference key and private database location. Changing the visible brand does not require moving data or changing cPanel settings.

Before connecting the permanent domain, add it to this hosting account with the intended document root, configure its DNS and valid HTTPS certificate, and verify the application through the new host. Leave `SEARCHPARTY_ORIGIN` unset when automatic origin detection works; a configured value must match the actual host being used. Share links use the current site's origin. Guest cookies and local storage are bound to the browser's current host, so a redirect does not transfer existing organiser access from the preview domain. If there are active searches, plan access continuity before redirecting or retiring the preview host; the app does not yet implement cross-domain profile transfer.

## Hosting requirements

- PHP **8.1 or newer**, with PDO and **`pdo_sqlite`** enabled for the domain.
- Apache-compatible `.htaccess` handling with `mod_rewrite`. `mod_headers` enables the included response headers.
- HTTPS for phone location permission and secure cookies.
- A private directory outside every public document root that PHP can create or write to.

PHP's `intl` and `mbstring` extensions improve Unicode normalisation; conservative fallbacks exist when they are unavailable.

There is no production Node.js process, Composer installation, MySQL database or map API key to configure. SQLite stores searches, profiles, images, chat, reports and limits.

## Build the upload package

From this project directory, using Node.js 22.13 or newer:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

The test command needs PHP 8.1 or newer on `PATH`, or an absolute executable path in `PHP_BINARY`. It checks the deployed PHP validation implementation without a running server. `npm run build:cpanel` is an alias for `npm run build`.

`release-upload/` is the complete upload folder. It contains:

```text
index.php               HTML entry point and page-specific advertising/CSP
index.html              compiled HTML template, served through index.php
ads.txt                 configured AdSense publisher declaration
assets/                 compiled frontend
vendor/leaflet/          local map library and licence
api.php                 public API entry point
.htaccess               Apache routing and response headers
server/                 PHP implementation and schema
server/.htaccess        denies direct access to server files
```

Other files copied from `public/`, such as the site icon, also belong in the upload. Upload the **contents** of `release-upload/` into the document root assigned to the preview/domain, usually `public_html/`. Preserve both hidden `.htaccess` files. Do not upload the enclosing `release-upload` directory as an extra URL path.

The application is configured for the domain root: links and API calls use paths such as `/api/session`. Hosting it under a URL subdirectory requires changing the frontend base paths and routing.

Use cPanel File Manager or the hosting account's encrypted FTPS connection. Credentials must stay outside the repository and documentation. Do not upload source files, `node_modules`, test data, environment files or SQLite databases. Back up existing website files before replacing them; do not remove unrelated files in a shared hosting account.

## Deploy from cPanel Git

The confirmed main-domain document root is `public_html`. Keep the source checkout under `repositories/searchparty`; the repository root is not a web-serving directory.

The committed `.cpanel.yml` runs `scripts/deploy-cpanel.sh`, which installs the already-built `deployment/searchparty-cpanel.zip` into the cPanel account's `$HOME/public_html`. It requires Bash, unzip and standard Unix file utilities, with no Node.js build on the hosting server. It checks the archive and destination paths before replacing files, backs up replaced files under `$HOME/.searchparty-deploy-backups/deploy.*/previous`, installs hidden access-control files, and leaves unrelated files and the private database in place. Old compiled assets are retained, so browsers with an earlier page can finish loading them.

In **Git Version Control**, open **Manage** for Search Pals. Ensure the checked-out branch is `codex/searchparty-cpanel`. Under **Pull or Deploy**, click **Update from Remote**, then **Deploy HEAD Commit**. The second button runs deployment; pushing to GitHub or updating the checkout alone does not publish the site. cPanel requires a clean checkout and a committed root `.cpanel.yml`.

Use this deployment only while this account's main-domain `public_html` belongs to Search Pals. The deployment replaces the package's named files, including the root `.htaccess`, while preserving cPanel-generated PHP handler/INI blocks and existing `SetEnv SEARCHPARTY_ADSENSE_ENABLED`, `SEARCHPARTY_CMP_READY`, `SEARCHPARTY_DATA_DIR` and `SEARCHPARTY_ORIGIN` settings. Other custom directives should be incorporated into `cpanel/.htaccess` before rebuilding. Private backups are retained for recovery and should be reviewed periodically; they are not database backups. Check the deployment output and the live verification steps below after deploying.

For subsequent releases, rebuild and package locally, copy `outputs/searchparty-cpanel.zip` to `deployment/searchparty-cpanel.zip`, and commit/push both source changes and the ZIP before repeating those two cPanel actions. Follow [cPanel's pull deployment guide](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-set-up-deployment/) for the interface.

## Private database directory

On a standard document root such as `/home/ACCOUNT/public_html`, the API defaults to:

```text
/home/ACCOUNT/.searchparty-data/searchparty.sqlite
```

The first successful API request creates the directory, SQLite database and schema. No manual SQL import is needed. Directory permissions are restricted to the hosting user where supported; the database file is restricted as well.

If the default location is not writable or the domain uses an unusual document root, configure the PHP environment variable `SEARCHPARTY_DATA_DIR` to an **absolute private path**, for example `/home/ACCOUNT/.searchparty-data`. Use the hosting provider's supported PHP environment configuration. Where Apache `SetEnv` is supported, an optional line in the deployed root `.htaccess` is:

```apache
SetEnv SEARCHPARTY_DATA_DIR /home/ACCOUNT/.searchparty-data
```

Replace `ACCOUNT` with the actual account directory. Confirm that the setting is passed through to PHP on that host. Keep any persistent deployment configuration in `cpanel/.htaccess` or the hosting configuration, since rebuilding recreates `release-upload/`.

The API normally detects its origin from the HTTPS connection and host. If a trusted hosting proxy requires an explicit origin, `SEARCHPARTY_ORIGIN` can be set to the exact HTTPS origin used by visitors, without a path or wildcard. This must match the site being opened; requests from other origins are rejected.

The API refuses to open its database inside the document root or `public_html`, `htdocs` or `www` public tree. It does not fall back to a public database location. Never solve a permissions problem by moving the database into the upload directory.

Back up SQLite using a SQLite-aware backup or a consistent snapshot. WAL mode may create `searchparty.sqlite-wal` and `searchparty.sqlite-shm`; copying only the main database while writes are active can omit recent changes. Keep database backups outside public web directories and test restoration.

## Local PHP verification

Build first, then run from the project directory in PowerShell:

```powershell
$env:SEARCHPARTY_DATA_DIR = Join-Path (Get-Location) '.sites-runtime/php-test-data'
php -S 127.0.0.1:8788 -t release-upload scripts/php-router.php
```

Open `http://127.0.0.1:8788`. In another terminal:

```powershell
$env:TEST_BASE_URL = 'http://127.0.0.1:8788'
npm run test:integration
```

The router is for local development only and is not shipped. It invokes `cpanel/api.php` and serves the compiled frontend. Apache `.htaccess` behaviour must still be checked on the hosting server.

For automatic frontend refresh, run the same PHP command on **8088** and then `npm run dev` (`dev:cpanel` is an alias). Its Vite proxy expects PHP at `http://127.0.0.1:8088`; the default frontend address is `http://127.0.0.1:5174`.

## Verify the uploaded site

1. Open the HTTPS site and confirm that the landing page and clearly labelled demo load, including map tiles.
2. Open `/api/session` in a fresh browser. It should return JSON with `profile: null` and an empty `searches` array, without PHP warnings or filesystem paths.
3. Confirm that `/server/schema.sql` and `/server/api.php` return an access-denied response. Keep directory listings disabled.
4. Create an explicitly labelled test pet search. Open its link in a second browser/device, request membership, and approve it from the organiser's browser.
5. Confirm messages, organiser updates and map reports appear across both sessions. Test optional GPS on an HTTPS phone browser; stop sharing and check the helper marker disappears.
6. Close the test search. New messages and reports should be disabled, and helper locations cleared. Remove test records using a controlled private-database maintenance process if required; closure alone is not deletion.

The automated integration runner deliberately refuses public URLs, so it cannot accidentally populate a live deployment with test searches.

## AdSense setup and page separation

The operator has authorised preparing adverts for Search Pals. At the account check on **14 November 2026**, payment setup was complete and the site was **Getting ready**. This is not confirmation of approval, a delivered ad or earned revenue. The integration can be ready to request ads while Google's review remains pending. Record a subsequent **Ready** status and actual consent/delivery checks separately; do not describe the adverts as verified live solely because the code is deployed. See [Google's site status guidance](https://support.google.com/adsense/answer/12170222).

Google's European regulations message was confirmed **Published**. **Limited ads: Blocked** was saved and verified at **10:50 on 14 November 2026**. At approximately **10:56**, the placement settings were saved: anchor, side-rail and vignette overlays off (0/3); Intent off (0/1); in-page banners only (1/2), with Multiplex off; and maximum banner count at the slider minimum of 6. All pages beginning with `searchpals.co.uk/ad-settings` were excluded. Google's UI treats the `www` and non-`www` forms together and required the exclusion without `www`. The returned sites list showed **Auto ads On** and **Auto optimise Off**. These saved account settings do not establish site approval or actual ad delivery.

The publisher is `ca-pub-8610536439975607`. Root `/ads.txt` must return `google.com, pub-8610536439975607, DIRECT, f08c47fec0942fa0` as plain text on both permanent hosts. This declaration does not execute advertising code. See [Google's ads.txt guide](https://support.google.com/adsense/answer/12171612?hl=en).

Only `searchpals.co.uk` and `www.searchpals.co.uk` are eligible for Google integration. Localhost, technical hosting previews and other hosts remain excluded. The homepage loader requires both `SEARCHPARTY_ADSENSE_ENABLED=1` and `SEARCHPARTY_CMP_READY=1`, and no `sp_guest` cookie. Search, demo, create and app query routes, ordinary policy pages, other paths and returning-member homepages omit Google scripts. The dedicated `/ad-settings` page is the deliberate exception: it loads Google's consent service even with a guest cookie, without fetching profile/search data, and keeps `pauseAdRequests=1` throughout. It requires CMP readiness but remains available when the advertising switch is off.

These flags are operator declarations, not automated proof of a published message or valid consent. The homepage bootstrap pauses ad requests before loading Google, and resumes only after a successful completed TCF event reports either `gdprApplies === false`, or consent to purpose 1 and Google vendor 755. Google's own TCF processing still handles the other purposes and vendor restrictions; the local gate is not a complete consent validator. Unknown, failed or incomplete consent leaves requests paused. Do not equate `CONSENT_API_READY` with permission to advertise.

The packaged `cpanel/.htaccess` now explicitly sets both flags to `1`. PHP still defaults to off if a setting is absent. The Git deployment preserves existing hosting `SetEnv` overrides, including `0`, so a packaged `1` does not establish the effective live setting. Inspect the deployed configuration and response behaviour after deployment.

Entering the private application requires a full document navigation, not a client-side transition retaining Google's scripts. All footer links to `/ad-settings` suppress the referrer and carry no private query, search code or return URL. Preserve an origin-only effective referrer policy and check Apache does not override it with one that reveals a room URL on same-origin navigation.

This is **not a sandboxed advertising integration**. Google scripts have normal page privileges on the public homepage and the separate settings document. CSP nonces authorise those scripts; they do not isolate them. Private application documents retain their restrictive CSP. See [Google's AdSense CSP guidance](https://support.google.com/adsense/answer/16283098?hl=en).

Account configuration and release checks:

1. In AdSense **Privacy & messaging → European regulations**, select Search Pals and publish the message with the current privacy URL. Present first-screen consent, decline and Manage options; keep **Do not consent** enabled. Turn off consent-message optimisation if a fixed three-choice presentation is required. A saved draft is insufficient. See [Google's message setup](https://support.google.com/adsense/answer/10960768?hl=en-GB).
2. In **Brand safety → Blocking controls → Ad serving**, disable **Limited ads** for this deployment. Google says it is enabled by default and can use fraud-prevention storage on unconsented traffic. The site must not promise that refusing prevents advertising storage while leaving that feature enabled. Record the account setting. See [Limited ads](https://support.google.com/adsense/answer/14210870?hl=en).
3. Review Auto ads formats and placements, and exclude `/ad-settings` and its aliases. Confirm the settings page remains free of ads even after previously granting consent. Its permanent request pause is an additional control, not a replacement for this check. See [page exclusions](https://support.google.com/adsense/answer/9262311?hl=en-GB) and [Google's pause-request examples](https://support.google.com/adsense/answer/9042142?hl=en).
4. Verify the published message, refusal and reopening behaviour on the actual serving hosts. `/ad-settings` queues `googlefc.showRevocationMessage` only once the API is available, reports loading/failure honestly and remains reachable for guest browsers. Google documents [revocation](https://support.google.com/adsense/answer/10959060?hl=en) and the [callback/TCF API](https://developers.google.com/funding-choices/fc-api-docs). The production router strips unrecognised public query parameters with a 303 redirect before loading Google, including campaign parameters and `?fc=alwaysshow&fctype=gdpr`. Those debug URLs are therefore unsupported here: use the site's advertising-choice controls and the AdSense message preview instead. Neither is a sandbox for advertising requests.
5. Inspect browser storage before consent, after refusal, after consent and after withdrawal. Check the published partner list and update the notice if the actual inventory differs. The privacy notice names Google's UK and European controllers and links their purposes, retention and transfer information. Certification and this checklist do not establish legal compliance.

To stop new homepage advertising loads, set `SEARCHPARTY_ADSENSE_ENABLED=0`. Keep `SEARCHPARTY_CMP_READY=1` while the published consent service remains available so people can still withdraw an earlier choice. Where the host passes Apache `SetEnv` values to PHP:

```apache
SetEnv SEARCHPARTY_ADSENSE_ENABLED 0
SetEnv SEARCHPARTY_CMP_READY 1
```

Absent settings default to off. Removing CMP readiness also prevents the settings page from loading Google, so reserve that for an unavailable/unsafe integration and ensure the page explains that choices could not be changed. These switches affect new documents; they do not remove a script from an already open browser page. Confirm effective PHP environment values after upload.

After rebuilding and starting the PHP preview, inspect the page separation without loading Google resources:

```powershell
$env:TEST_BASE_URL = 'http://127.0.0.1:8789'
node tests/page-shell.mjs
```

This test connects only to localhost and overrides the HTTP Host header to exercise production-host classification. It reads HTML and headers without executing scripts or requesting advertisements. Use separate local previews for default-off, both-flags-on, advertising-on/CMP-off and advertising-off/CMP-on states. `TEST_ADS_ENABLED_BASE_URL` and `TEST_ADS_DISABLED_BASE_URL` select the additional server states supported by the test. Verify settings access for guest browsers, private/query/host exclusions, fresh nonces and static policies. No API test records are created. Local checks do not prove that Google has approved the site or that its live message/ads are delivered; complete the browser checks above without clicking advertisements.

## Privacy pages and operations

The build generates `/privacy`, `/cookies`, `/terms` and `/safety` as standalone HTML using the approved copy in `app/lib/legal-content.ts`. They load no scripts, advertising or maps, set no cookies and make no profile API requests. They work without JavaScript. Frontend development also renders the same content in React. Review `legal/LAUNCH-CHECKS.md` for the operator tasks that software and policy text cannot complete.

New guest profiles must confirm they are adults and accept the current Terms. This declaration is not identity verification or highly effective age assurance. The `Your data` controls export the current browser profile's data and allow its deletion; removal of organised searches requires an explicit additional acknowledgement. Email remains available for requests that cannot be handled from the original browser.

The database migrates existing records on the first API request. Retention housekeeping removes searches eligible after 90 days closed or 180 days without qualifying activity, clears stale GPS positions and removes expired unreferenced profiles. Cleanup is batched and also has a CLI entry point for a daily cPanel cron job. See the maintenance instructions and operator checklist; no cron is installed by a Git deployment. Back up production SQLite consistently before the first migration. Hosting logs, provider backups and support email have separate retention and access procedures.

### Scheduled retention cleanup

The deployed maintenance script is `/home/terror/public_html/server/maintenance.php`. It refuses HTTP execution. Use the PHP 8.1+ command-line binary recommended by Brixly for this account, with PDO SQLite enabled; confirm the binary and private data directory before configuring a cron job. First inspect eligible records:

```sh
SEARCHPARTY_DATA_DIR=/home/terror/.searchparty-data /PATH/TO/PHP /home/terror/public_html/server/maintenance.php --dry-run
```

Replace `/PATH/TO/PHP` with the confirmed executable. `--dry-run` does not delete records, but opening the database may create it or run a pending schema migration. It is not a completely read-only migration preview. Once verified, configure cPanel **Cron Jobs** to run the same command without `--dry-run` daily, for example at 03:15 server time. Save output in a private log or receive cron output by email and check failures. Each CLI run processes at most 100 eligible searches; a backlog may need further runs. API requests also process smaller batches, but scheduling cleanup avoids depending on visits to a quiet site.

The privacy notice describes eligibility and batching rather than promising deletion at an exact minute. Do not set up a second maintenance database by accidentally using a different data directory from the API. Confirm provider backup/log deletion periods separately.

## Optional PayPal support

The homepage support card links directly to PayPal for `simonwoolston@live.com`, with `GBP` as the currency and no fixed amount. On 14 November 2026 the checkout opened successfully with the recipient name **Digital online**, which Simon confirmed is his account. Verification stopped before entering an amount or sending a payment; successful settlement and account limits are not tested.

The link is configured in `app/components/SupportCard.tsx`. No PayPal SDK, iframe, tracking pixel, API credential, return URL or payment webhook is installed. The link suppresses the referrer and contains no search or profile information. It opens in a separate tab only when selected. PayPal may offer an optional recurring payment; the website does not preselect one or record payment success. Keep the recipient and purpose accurate if the PayPal account changes. Site profile export/deletion does not manage PayPal records or recurring payments.

## Common deployment issues

| Symptom | Check |
| --- | --- |
| Page loads, but `/api/session` returns HTML or 404 | The root `.htaccess` was uploaded, rewrite rules are permitted, and the files are in the correct document root. |
| API returns a generic 500 error | Inspect private PHP error logs. Check PHP version, `pdo_sqlite`, private-directory permissions and `SEARCHPARTY_DATA_DIR`. Public errors intentionally omit internal details. |
| Site returns 500 immediately | Check whether the host allows the `.htaccess` directives, including `Options -Indexes` and any optional `SetEnv` added locally. |
| Phone location is unavailable | Use HTTPS, grant browser location permission, and keep the page visible. Switching apps or locking the phone pauses sharing. |
| Map tiles do not load | Check internet access, the browser console and the OpenStreetMap tile request policy. The map library itself is served locally. |
| An existing search disappears after upload | Ensure PHP is using the same private data directory as before. Replacing frontend files should not replace the database. |

Keep production data separate from local tests. Remaining Vinext/D1 starter and reference files are unused, excluded from this package and not a supported deployment path.
