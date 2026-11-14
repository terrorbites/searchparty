#!/bin/bash
# cPanel invokes this from its Git checkout. No build tools are needed on hosting.
set -euo pipefail
umask 077

fail() { printf 'Search Pals deployment stopped: %s\n' "$*" >&2; exit 1; }
for tool in unzip mktemp cp mv chmod mkdir dirname awk cat; do
  command -v "$tool" >/dev/null || fail "Required command is unavailable: $tool"
done

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
archive="$repo_dir/deployment/searchparty-cpanel.zip"
# The override is for isolated test accounts; cPanel uses its own HOME unchanged.
account_dir=$(cd -- "${SEARCHPARTY_DEPLOY_HOME:-${HOME:?}}" && pwd -P)
[[ "$account_dir" != / ]] || fail 'The account home cannot be the filesystem root.'
target="$account_dir/public_html"
[[ -f "$archive" ]] || fail 'The committed deployment ZIP is missing.'
[[ -d "$target" && ! -L "$target" ]] || fail 'public_html must already exist as a real directory.'
[[ "$(cd -- "$target" && pwd -P)" == "$target" ]] || fail 'The web folder must stay inside this account.'

# Staging and backups remain private and outside the publicly served folder.
backup_root="$account_dir/.searchparty-deploy-backups"
[[ ! -L "$backup_root" ]] || fail 'The backup directory must not be a symbolic link.'
mkdir -p -- "$backup_root"
chmod 700 -- "$backup_root"
run_dir=$(mktemp -d "$backup_root/deploy.XXXXXXXX")
stage="$run_dir/package"
previous="$run_dir/previous"
mkdir -- "$stage" "$previous"

unzip -tq "$archive" >/dev/null || fail 'The deployment ZIP failed its integrity check.'
unzip -Z1 "$archive" > "$run_dir/files.txt"
files=()
while IFS= read -r file || [[ -n "$file" ]]; do
  [[ -n "$file" ]] || fail 'The ZIP contains an empty entry.'
  case "$file" in
    /*|*\\*|../*|*/../*|*/..|./*|*/./*|*/.|*//*|*/)
      fail "Unexpected ZIP path: $file" ;;
  esac
  # Only the packaged website is eligible, never the source checkout or database.
  case "$file" in
    index.php|index.html|api.php|ads.txt|favicon.svg|.htaccess|privacy.html|cookies.html|terms.html|safety.html|ad-settings.html|assets/*|vendor/leaflet/*|server/*) ;;
    *) fail "Unexpected ZIP file: $file" ;;
  esac
  files+=("$file")
done < "$run_dir/files.txt"
[[ ${#files[@]} -gt 0 ]] || fail 'The deployment ZIP is empty.'
unzip -q "$archive" -d "$stage"
for required in index.php index.html api.php .htaccess ads.txt privacy.html cookies.html terms.html safety.html ad-settings.html assets/advertising.js server/.htaccess server/api.php server/database.php server/schema.sql server/validation.php; do
  [[ -f "$stage/$required" && ! -L "$stage/$required" ]] || fail "Missing runtime file: $required"
done

# Check every path and save all replaced files before touching the live website.
for file in "${files[@]}"; do
  [[ -f "$stage/$file" && ! -L "$stage/$file" ]] || fail "Invalid packaged file: $file"
  relative="$file"
  while [[ "$relative" != . ]]; do
    [[ ! -L "$stage/$relative" && ! -L "$target/$relative" ]] || fail "Symbolic link in deployment path: $relative"
    if [[ "$relative" != "$file" && -e "$target/$relative" && ! -d "$target/$relative" ]]; then
      fail "A file blocks a required folder: $relative"
    fi
    relative=$(dirname -- "$relative")
  done
  if [[ -e "$target/$file" ]]; then
    [[ -f "$target/$file" ]] || fail "A directory blocks a required file: $file"
    mkdir -p -- "$previous/$(dirname -- "$file")"
    cp -p -- "$target/$file" "$previous/$file"
  fi
done

# Retain cPanel's generated PHP handler/INI blocks and existing app environment
# settings. Routing comes from the release; arbitrary old rewrite rules do not.
if [[ -f "$target/.htaccess" ]]; then
  awk '
    /^# (php -- BEGIN cPanel-generated handler|BEGIN cPanel-generated php ini directives)/ { keeping = 1 }
    keeping { print }
    /^# (php -- END cPanel-generated handler|END cPanel-generated php ini directives)/ { keeping = 0; next }
    !keeping && tolower($0) ~ /^[[:space:]]*setenv[[:space:]]+searchparty_(adsense_enabled|cmp_ready|data_dir|origin)[[:space:]]+/ { print }
    END { if (keeping) exit 1 }
  ' "$target/.htaccess" > "$run_dir/hosting-directives.txt" || fail 'An existing cPanel PHP configuration block is incomplete.'
  if [[ -s "$run_dir/hosting-directives.txt" ]]; then
    printf '\n# Hosting settings retained from the previous .htaccess\n' >> "$stage/.htaccess"
    cat "$run_dir/hosting-directives.txt" >> "$stage/.htaccess"
  fi
fi

install_file() {
  local file="$1" parent temporary
  parent=$(dirname -- "$target/$file")
  # New public folders need traversal/read permissions for the web server.
  (umask 022; mkdir -p -- "$parent")
  temporary=$(mktemp "$parent/.searchparty-install.XXXXXXXX")
  cp -- "$stage/$file" "$temporary"
  chmod 644 -- "$temporary"
  mv -f -- "$temporary" "$target/$file"
}

# Install access rules first, assets/backend next, then switch the page template.
install_file .htaccess
install_file server/.htaccess
for file in "${files[@]}"; do
  case "$file" in .htaccess|server/.htaccess|index.php|index.html) continue ;; esac
  install_file "$file"
done
install_file index.php
install_file index.html
printf 'Search Pals deployed to %s\nPrevious files saved in %s\n' "$target" "$previous"
printf 'Unrelated files and the private search database were left in place.\n'
