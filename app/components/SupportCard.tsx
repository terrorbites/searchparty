import { ArrowUpRight, Heart } from 'lucide-react';
import { useEffect, useRef } from 'react';

const PAYPAL_SUPPORT_URL = 'https://www.paypal.com/donate?business=simonwoolston%40live.com&currency_code=GBP&item_name=Support%20Search%20Pals';

export default function SupportCard() {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === '#support-search-pals') sectionRef.current?.scrollIntoView({ block: 'start' });
  }, []);
  return <section ref={sectionRef} className="support-card" id="support-search-pals" aria-labelledby="support-search-pals-heading">
    <span className="support-card-icon" aria-hidden="true"><Heart size={23}/></span>
    <div className="support-card-copy">
      <h2 id="support-search-pals-heading">Help keep Search Pals running</h2>
      <p>Optional contributions help Simon Woolston cover hosting and running costs. Searching and joining are free, whether or not you contribute.</p>
      <p className="support-recipient">Recipient: Simon Woolston, shown as “Digital online” on PayPal. Search Pals is run by an individual and is not a registered charity.</p>
    </div>
    <div className="support-card-action">
      <a className="button button-secondary" href={PAYPAL_SUPPORT_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Support via PayPal<ArrowUpRight size={16}/><span className="sr-only"> (opens in a new tab)</span></a>
      <p>Choose your amount in GBP on PayPal. Any monthly support option is your choice there.</p>
    </div>
  </section>;
}
