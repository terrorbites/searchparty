import { ArrowUpRight, Building2, MessageCircle, PawPrint, Users } from 'lucide-react';

const external = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' as const };

export default function SharingTips({ petType }: { petType: 'dog' | 'cat' }) {
  return <section className="share-tips" aria-labelledby="sharing-tips-heading">
    <h3 id="sharing-tips-heading">Get nearby eyes on your search</h3>
    <p>Copy your search link and share it with a clear photo, the area and time last seen, and any instructions for approaching your pet.</p>
    <ul>
      <li><Users size={19} aria-hidden="true"/><div><strong>Local Facebook groups</strong><p>Look for “your town + lost and found pets” and neighbourhood groups. Check the rules or ask an admin before posting.</p><a href="https://www.facebook.com/groups/" {...external}>Open Facebook groups<ArrowUpRight size={13}/><span className="sr-only"> (opens in a new tab)</span></a></div></li>
      <li><MessageCircle size={19} aria-hidden="true"/><div><strong>Neighbours, WhatsApp &amp; Nextdoor</strong><p>Share with your street or local community group. Ask neighbours to check sheds, garages and gardens, with permission.</p><a href="https://nextdoor.co.uk/" {...external}>Open Nextdoor<ArrowUpRight size={13}/><span className="sr-only"> (opens in a new tab)</span></a></div></li>
      <li><Building2 size={19} aria-hidden="true"/><div><strong>Nearby vets &amp; rescue centres</strong><p>Let them know your pet is missing and ask whether they can share your appeal or put up a notice.</p><a href="https://www.rcvs.org.uk/animal-owners/find-a-vet" {...external}>Find a vet<ArrowUpRight size={13}/><span className="sr-only"> (opens in a new tab)</span></a></div></li>
      <li><PawPrint size={19} aria-hidden="true"/><div><strong>{petType === 'dog' ? 'Your dog warden & microchip database' : 'Your microchip database'}</strong><p>Report your pet missing to their microchip database and check your contact details.{petType === 'dog' && ' Contact your council’s dog warden too.'}</p><a href={petType === 'dog' ? 'https://www.gov.uk/check-council-missing-dog' : 'https://www.gov.uk/get-your-dog-cat-microchipped'} {...external}>{petType === 'dog' ? 'Find a dog warden (England & Wales)' : 'Microchip database guidance'}<ArrowUpRight size={13}/><span className="sr-only"> (opens in a new tab)</span></a></div></li>
    </ul>
    <p className="share-tips-note">Opening a group does not post for you. Share the public appeal without adding your home address or private contact details. Approve helpers carefully, and update your posts when your pet is found.</p>
  </section>;
}
