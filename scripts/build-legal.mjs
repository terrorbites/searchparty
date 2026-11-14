import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PawPrint } from 'lucide-react';

// Generate public, readable policy pages without requiring JavaScript or cookies.
const source = readFileSync('app/lib/legal-content.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { legalPages } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const shell = readFileSync('release-upload/index.html', 'utf8');
const stylesheet = shell.match(/<link\s+rel="stylesheet"[^>]*href="([^"]+)"/);
if (!stylesheet) throw new Error('The built stylesheet is missing.');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const brandIcon = `<span class="brand-mark">${renderToStaticMarkup(createElement(PawPrint, { size: 22, 'aria-hidden': true }))}</span>`;
const link = ({ href, label }) => {
  if (!/^(?:\/(?!\/)|https:\/\/|mailto:)/.test(href)) throw new Error('Unexpected policy link.');
  return `<a href="${escape(href)}"${href.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(label)}</a>`;
};
const footer = `<footer class="site-footer legal-footer"><div class="footer-identity"><span>search pals<span class="brand-dot">.</span></span><p>Search together. Bring them home.</p></div><nav aria-label="Information and privacy">${[
  { href: '/privacy', label: 'Privacy' }, { href: '/cookies#cookie-settings', label: 'Cookie information' }, { href: '/terms', label: 'Terms' }, { href: '/safety', label: 'Search safety' }, { href: '/?app=1&privacy=1', label: 'Your data' }, { href: '/#support-search-pals', label: 'Support Search Pals' }
].map(link).join('')}</nav></footer>`;

for (const [key, page] of Object.entries(legalPages)) {
  if (!['privacy', 'cookies', 'terms', 'safety'].includes(key)) throw new Error('Unexpected legal page key.');
  const contents = page.sections.map((section, index) => `<a href="#section-${index + 1}">${escape(section.heading)}</a>`).join('');
  const sections = page.sections.map((section, index) => `<section class="legal-section" id="section-${index + 1}"><h2>${escape(section.heading)}</h2>${(section.paragraphs || []).map(text => `<p>${escape(text)}</p>`).join('')}${section.bullets ? `<ul>${section.bullets.map(text => `<li>${escape(text)}</li>`).join('')}</ul>` : ''}${section.links ? `<div class="legal-section-links">${section.links.map(link).join('')}</div>` : ''}</section>`).join('');
  const cookies = key !== 'cookies' ? '' : `<section class="storage-summary" id="cookie-settings" aria-labelledby="storage-heading"><div><h2 id="storage-heading">Cookie information &amp; settings</h2><p>Essential storage supports the features you choose to use, such as remembering your profile and muted chats.</p><div class="storage-status"><span>Essential storage: used for requested features</span><span>Advertising: off</span><span>Analytics: off</span></div><p>There are currently no optional cookies to accept or reject. You can clear site storage in your browser, but deleting your profile cookie removes this browser’s access to your searches. Export or delete your data first if needed.</p><a class="text-button" href="/?app=1&amp;privacy=1">Manage this browser’s data</a></div></section>`;
  const management = key !== 'privacy' ? '' : `<section class="privacy-deleted-notice" id="data-deleted" role="status"><h2>Deletion confirmed</h2><p>The app has confirmed deletion of your profile, its contributions and any searches you organised from the active service. This does not remove copies made by other people or immediately erase hosting backups; see the retention information in this notice.</p></section><section class="privacy-management"><div><h2>Your browser, your profile</h2><p>Export or delete the profile recognised on this browser. If you cannot access that browser, use the contact details in this notice.</p></div><a class="button button-secondary" href="/?app=1&amp;privacy=1">Manage your data</a></section>`;
  writeFileSync(`release-upload/${key}.html`, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#253b42"><meta name="description" content="${escape(page.summary)}"><title>${escape(page.title)} — Search Pals</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${escape(stylesheet[1])}"></head><body><div class="app legal-app"><header class="site-header"><div class="header-inner"><a class="brand" href="/" aria-label="Search Pals home">${brandIcon}<span>search <span class="brand-light">pals</span><span class="brand-dot">.</span></span></a><a class="text-button" href="/?app=1">Back to Search Pals</a></div></header><main class="legal-main" id="main-content"><div class="legal-intro"><span class="eyebrow">Search Pals information</span><h1>${escape(page.title)}</h1><p>${escape(page.summary)}</p><span class="legal-updated">Last updated ${escape(page.updated)}</span></div>${cookies}<div class="legal-layout"><nav class="legal-contents" aria-label="On this page"><strong>On this page</strong>${contents}</nav><div class="legal-body">${sections}</div></div>${management}</main>${footer}</div></body></html>\n`);
}
console.log('Generated four policy pages with no JavaScript or advertising.');
