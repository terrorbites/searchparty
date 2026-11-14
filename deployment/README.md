# cPanel upload package

`searchparty-cpanel.zip` contains the compiled frontend and PHP runtime, including both `.htaccess` files. It contains no credentials, search records or local test data.

Upload and extract its contents into the document root assigned to SearchParty. Preserve any existing site first. The entry point is `index.php`; the `assets`, `vendor` and `server` folders must remain alongside it.

PHP 8.1+ with PDO SQLite is required. Private database storage must be outside all public document roots. See [the deployment guide](../DEPLOY-CPANEL.md) for setup and verification.

For the confirmed main-domain web folder, cPanel can deploy this ZIP directly: open **Git Version Control → Manage → Pull or Deploy**, click **Update from Remote**, then **Deploy HEAD Commit**. The checked-in `.cpanel.yml` runs `scripts/deploy-cpanel.sh` and installs into the account's `public_html`. Replaced files are backed up under the private `.searchparty-deploy-backups` directory. The script preserves unrelated web files and private search data. A GitHub push alone does not publish the website.

To rebuild this package from source, run `npm ci`, `npm run build`, then `python scripts/package-cpanel.py`. The freshly verified ZIP is written to `outputs/searchparty-cpanel.zip`. Copy it to `deployment/searchparty-cpanel.zip` and commit it with the corresponding source before using cPanel deployment.
