export default function SiteFooter() {
  return <footer className="site-footer legal-footer">
    <div className="footer-identity"><span>search pals<span className="brand-dot">.</span></span><p>Search together. Bring them home.</p></div>
    <nav aria-label="Information and privacy">
      <a href="/privacy">Privacy</a>
      <a href="/cookies#cookie-settings">Cookie information</a>
      <a href="/ad-settings" rel="noreferrer">Privacy and advertising choices</a>
      <a href="/terms">Terms</a>
      <a href="/safety">Search safety</a>
      <a href="/?app=1&privacy=1">Your data</a>
      <a href="/#support-search-pals">Support Search Pals</a>
    </nav>
  </footer>;
}
