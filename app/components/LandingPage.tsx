import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Cat, Check, Dog, Heart, MapPin, PawPrint } from 'lucide-react';
import type { SessionResponse } from '../types';
import SupportCard from './SupportCard';
import './landing.css';

interface LandingPageProps {
  session: SessionResponse;
  onStart: () => void;
  onOpenSearch: (code: string) => void | Promise<void>;
  onDemo: () => void;
}

export default function LandingPage({ session, onStart, onOpenSearch, onDemo }: LandingPageProps) {
  const [joinCode, setJoinCode] = useState('');

  function joinSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onOpenSearch(joinCode);
  }

  return <main className="pet-landing">
    <section className="notice-hero" aria-labelledby="notice-heading">
      <div className="notice-intro">
        <p className="notice-kicker"><PawPrint size={17} aria-hidden="true"/>A missing pet. A neighbourhood that cares.</p>
        <h1 id="notice-heading"><span>Someone’s best friend.</span><span>Everyone’s helping hand.</span></h1>
        <p className="notice-description">When your dog or cat goes missing, bring the people who want to help into one place. Share a map, sightings and updates — straight from your phone.</p>
        <div className="notice-actions">
          <button className="notice-primary" onClick={onStart}>Start a search<ArrowRight size={19} aria-hidden="true"/></button>
          <button className="notice-demo" onClick={onDemo}>Take a look around<ArrowUpRight size={18} aria-hidden="true"/><span>Try the interactive demo</span></button>
        </div>
        <p className="notice-reassurance"><span><Check size={15} aria-hidden="true"/>Free to use</span><span><Check size={15} aria-hidden="true"/>No app to install</span></p>
      </div>

      <figure className="notice-pet-paper">
        <figcaption>Dogs, cats &amp; the people who love them</figcaption>
        <img src="/assets/dalmatian-pals.webp" width="1536" height="1024" fetchPriority="high" alt="A hand-painted illustration of a Dalmatian sitting beside a black-and-white cat."/>
        <div className="notice-paper-signoff"><PawPrint size={21} aria-hidden="true"/><span>Search together. Bring them home.</span><Heart size={21} aria-hidden="true"/></div>
      </figure>

      <section className="notice-code-slip" id="join-search" aria-labelledby="notice-join-heading">
        <div className="notice-slip-label"><span>HAVE A SEARCH CODE?</span><h2 id="notice-join-heading">Your helping hands are needed.</h2><p>Enter the code you’ve been given to join the search.</p></div>
        <form onSubmit={joinSearch} className="notice-code-form">
          <label htmlFor="join-code">Search code</label>
          <div><input id="join-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="e.g. AB12CD34" maxLength={12} required value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())}/><button className="notice-primary" type="submit">Join search<ArrowRight size={18} aria-hidden="true"/></button></div>
        </form>
      </section>
    </section>

    {session.searches.length > 0 && <section className="notice-remembered" aria-labelledby="notice-remembered-heading">
      <div className="notice-section-heading"><h2 id="notice-remembered-heading">Back to your search</h2><p>Remembered on this device</p></div>
      <div className="notice-search-list">{session.searches.map(({ search, status }) => <button className="notice-saved-search" key={search.id} onClick={() => void onOpenSearch(search.code)}>
        <span className="notice-saved-pet" aria-hidden="true">{search.petType === 'dog' ? <Dog size={28}/> : <Cat size={28}/>}</span>
        <span className="notice-saved-description"><strong>{search.petName}’s search</strong><span><MapPin size={13} aria-hidden="true"/>{search.locationLabel}</span></span>
        <span className={`notice-search-status ${search.status === 'found' ? 'notice-search-found' : ''}`}>{search.status === 'found' ? 'Found safe' : status === 'pending' ? 'Awaiting approval' : status === 'banned' ? 'Access removed' : 'Active search'}</span>
        <ArrowUpRight className="notice-saved-arrow" size={20} aria-hidden="true"/>
      </button>)}</div>
    </section>}

    <section className="notice-process" id="how-it-works" aria-labelledby="notice-process-heading">
      <div className="notice-process-heading"><p className="notice-kicker">A little organisation. A lot of care.</p><h2 id="notice-process-heading">Turn “How can I help?”<br/>into a plan.</h2><p>No scattered messages or wondering who’s checked where. Give your search a shared place to happen.</p></div>
      <ol className="notice-steps">
        <li><span className="notice-step-number" aria-hidden="true">01</span><div><h3>Tell us who we’re looking for.</h3><p>Add your pet’s photo, description and the place they were last seen.</p></div></li>
        <li><span className="notice-step-number" aria-hidden="true">02</span><div><h3>Get your people together.</h3><p>Share one link or code. Helpers choose a name and request to join; you decide who comes in.</p></div></li>
        <li><span className="notice-step-number" aria-hidden="true">03</span><div><h3>Keep everyone in the loop.</h3><p>Mark sightings and searched areas on the map. Post updates and talk to each other as you go.</p></div></li>
      </ol>
    </section>

    <section className="notice-neighbours" aria-labelledby="notice-neighbours-heading">
      <span className="notice-neighbour-symbol" aria-hidden="true"><PawPrint size={34}/></span>
      <div><p className="notice-kicker">The next street over could make all the difference.</p><h2 id="notice-neighbours-heading">Put the word around.</h2><p>Try local lost-pet Facebook groups, neighbourhood WhatsApp groups and Nextdoor. Ask nearby vets and rescues to pass on your appeal. Your search’s Share panel has links and tips to help.</p></div>
      <a className="notice-safety-link" href="/safety">A few tips for a safer search<ArrowUpRight size={18} aria-hidden="true"/></a>
    </section>

    <SupportCard/>
    <div className="notice-care-note"><Heart size={17} aria-hidden="true"/><p>For people helping people find the pets they love.</p><span>Dogs &amp; cats. All welcome.</span></div>
  </main>;
}
