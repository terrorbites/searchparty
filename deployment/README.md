# cPanel upload package

`searchparty-cpanel.zip` contains the compiled frontend and PHP runtime, including both `.htaccess` files. It contains no credentials, search records or local test data.

Upload and extract its contents into the document root assigned to SearchParty. Preserve any existing site first. The entry point is `index.php`; the `assets`, `vendor` and `server` folders must remain alongside it.

PHP 8.1+ with PDO SQLite is required. Private database storage must be outside all public document roots. See [the deployment guide](../DEPLOY-CPANEL.md) for setup and verification.

To rebuild this package from source, run `npm ci`, `npm run build`, then `python scripts/package-cpanel.py`. The freshly verified ZIP is written to `outputs/searchparty-cpanel.zip`.
