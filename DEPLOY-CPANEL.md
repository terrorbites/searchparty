# Deploy SearchParty to cPanel

This guide describes the PHP deployment package. It does not certify that a particular upload or deployment has completed.

The user-selected hosting preview is [exquisite-cyan-aardvark.91-204-209-67.cpanel.site](https://exquisite-cyan-aardvark.91-204-209-67.cpanel.site/). It is a technical preview domain and may display the hosting provider's warning banner. The intended permanent domain is `searchparty.co.uk`; DNS and HTTPS for that domain must be verified separately before treating it as connected.

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

In **Git Version Control**, open **Manage** for SearchParty. Ensure the checked-out branch is `codex/searchparty-cpanel`. Under **Pull or Deploy**, click **Update from Remote**, then **Deploy HEAD Commit**. The second button runs deployment; pushing to GitHub or updating the checkout alone does not publish the site. cPanel requires a clean checkout and a committed root `.cpanel.yml`.

Use this deployment only while this account's main-domain `public_html` belongs to SearchParty. The deployment replaces the package's named files, including the root `.htaccess`, while preserving cPanel-generated PHP handler/INI blocks and existing `SetEnv SEARCHPARTY_ADSENSE_ENABLED`, `SEARCHPARTY_DATA_DIR` and `SEARCHPARTY_ORIGIN` settings. Other custom directives should be incorporated into `cpanel/.htaccess` before rebuilding. Private backups are retained for recovery and should be reviewed periodically; they are not database backups. Check the deployment output and the live verification steps below after deploying.

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

The package includes publisher `ca-pub-8610536439975607` and the corresponding root `ads.txt` declaration. The standard AdSense loader is emitted only on the public homepage for visitors without a `sp_guest` cookie. Search, demo, create and app query routes, other paths, existing guest browsers and localhost previews omit the loader. Entering the application uses a full document navigation so the public homepage script does not remain in a search document.

This is **not a sandboxed advertising integration**. Google's script executes in the public homepage document. A fresh CSP nonce authorises it; the nonce does not isolate the script or remove its normal page privileges. Private application documents keep their more restrictive CSP and contain no AdSense loader. The public policy follows [Google's AdSense CSP guidance](https://support.google.com/adsense/answer/16283098?hl=en).

Adding the code does not approve the site or configure consent in the publisher account. Add the intended serving domain in AdSense, complete its site review and verify that `/ads.txt` exposes the matching publisher entry. See Google's [site status guidance](https://support.google.com/adsense/answer/12170222) and [ads.txt guide](https://support.google.com/adsense/answer/12171612?hl=en).

Configure and publish the appropriate consent message in AdSense **Privacy & messaging**, or connect another suitable certified CMP. Google requires a certified CMP integrated with the IAB TCF when serving personalised ads to visitors in the EEA, UK and Switzerland. Follow the current [publisher CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en) and [Privacy & messaging setup](https://support.google.com/adsense/answer/10924669?hl=en); this repository does not configure the AdSense account or publish a consent message.

To omit advertising entirely, set `SEARCHPARTY_ADSENSE_ENABLED=0` in the PHP environment. Where the host supports passing Apache `SetEnv` values to PHP:

```apache
SetEnv SEARCHPARTY_ADSENSE_ENABLED 0
```

The loader is enabled on eligible public pages when that setting is absent or has another value. Keep it disabled while account or consent setup is incomplete, and confirm the intended setting reaches PHP after upload.

After rebuilding and starting the PHP preview, inspect the page separation without loading Google resources:

```powershell
$env:TEST_BASE_URL = 'http://127.0.0.1:8789'
node tests/page-shell.mjs
```

This test connects only to localhost and overrides the HTTP Host header to exercise public-homepage rendering. It reads HTML and headers without executing scripts, following redirects or requesting advertisements. It checks private/query/cookie/local-host exclusions, nonce consistency and freshness, and the restrictive private-page CSP. To also test the environment switch, start a second local PHP preview with `SEARCHPARTY_ADSENSE_ENABLED=0` and set `TEST_ADS_DISABLED_BASE_URL` to that server's local URL before running the same script. No API test records are created by the page-shell checks.

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
