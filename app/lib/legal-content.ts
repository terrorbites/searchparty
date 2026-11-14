export type LegalPageKey = 'privacy' | 'cookies' | 'terms' | 'safety';
export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  links?: { label: string; href: string }[];
}
export interface LegalPage {
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
}

export const termsVersion = '2026-11-14.1';
export const operator = {
  name: 'Simon Woolston',
  address: '91 Millside, Stalham, NR12 9RL, United Kingdom',
  email: 'simonwoolston@live.com',
};
const contact = { label: 'Email Simon Woolston', href: 'mailto:simonwoolston@live.com' };
const dataControls = { label: "Manage this browser's data", href: '/?app=1&privacy=1' };
const adSettings = { label: 'Privacy and advertising choices', href: '/ad-settings' };

export const legalPages: Record<LegalPageKey, LegalPage> = {
  privacy: {
    title: 'Privacy notice',
    summary: 'What Search Pals collects, who can see it and how you can control it.',
    updated: '14 November 2026',
    sections: [
      {
        heading: 'Who is responsible',
        paragraphs: [
          'Simon Woolston operates Search Pals and controls your personal information. Contact: simonwoolston@live.com, or 91 Millside, Stalham, NR12 9RL, United Kingdom.',
          'This service is for adults aged 18 or over searching for dogs and cats. Do not post information about missing people or children.',
        ],
        links: [contact],
      },
      {
        heading: 'Information we use',
        bullets: [
          'Your display name, optional profile photo, guest identifier, age confirmation and terms version/time. No email address or password is required for a profile.',
          'Pet appeals and photos, last-seen locations, search membership, messages, map reports, timestamps and moderation reports. Other members may mention you or report your content.',
          'Your coordinates and accuracy during optional location sharing; security counters linked to your guest identifier or hashed IP address. Hosting logs may contain IP addresses, requested pages and errors. Contacting us provides your email and correspondence.',
        ],
      },
      {
        heading: 'Why we use it',
        bullets: [
          'Contract: to provide the coordination service you request, remember your guest identity, publish your appeal and contributions, manage membership and handle service requests.',
          'Consent: to share your live device location and display your optional profile photo. You can use the service without either. Stop sharing, remove your profile photo or contact us to withdraw; this does not undo earlier lawful use.',
          'Legitimate interests: to keep the service secure, prevent spam and misuse, investigate reports, respond to enquiries and provide the requested map. We must balance these purposes against your rights.',
          'Legal obligation: where disclosure or preservation is required by applicable law. Optional advertising uses consent where required, separately from accepting the terms or sharing GPS. We do not sell search-room content or run a separate site analytics service.',
        ],
      },
      {
        heading: 'Who can see search information',
        paragraphs: [
          'The appeal, pet photo, instructions and last-seen pin are public to anyone with the link or code. Do not include a home address or contact details you do not want shared. Links and screenshots can travel beyond the search party.',
          'Approved members see names/photos, messages, map reports and shared positions. Organisers/moderators also see join requests, removed members and moderation reports. Rooms are not end-to-end encrypted. Simon and Enix Ltd, trading as Brixly, our hosting processor, can access data for necessary operational/support purposes. Brixly’s published processing terms provide for adequacy decisions or UK transfer contracts where required. Contact us for applicable safeguards and account-specific locations; processing is not guaranteed to remain in the UK.',
        ],
      },
      {
        heading: 'Location and maps',
        paragraphs: [
          'Sharing needs your choice and browser permission. We store your latest position, not a GPS route history. Stop requests, removal and closure clear it when received. Positions disappear after 30 minutes without an update; housekeeping clears stored coordinates. A lost connection can delay stopping. Manually posted sightings and searched areas remain separate records.',
          'Maps load directly from the OpenStreetMap Foundation, an independent controller. Its servers receive your IP address, browser/request information and requested map area, which can suggest a location. We do not send chat or profile data to this service. Its global infrastructure can process requests outside the UK.',
        ],
        links: [
          { label: 'OpenStreetMap privacy policy', href: 'https://osmfoundation.org/wiki/Privacy_Policy' },
          { label: 'OpenStreetMap information for map users', href: 'https://osmfoundation.org/wiki/Services_and_tile_users_privacy_FAQ' },
          { label: 'Brixly privacy and data-processing terms', href: 'https://brixly.uk/terms-and-conditions/' },
        ],
      },
      {
        heading: 'Advertising and your choices',
        paragraphs: [
          'Google AdSense is configured for the public homepage on searchpals.co.uk and www.searchpals.co.uk, for browsers without a guest-profile cookie. Ad availability depends on Google’s approval and delivery. Search rooms, the demo, profile and data controls, and policy pages do not load Google advertising or consent scripts. A separate advertising-settings page loads Google’s consent service, including for returning members, but keeps ad requests paused.',
          'Where consent is required, Google’s published consent message lets you consent, decline or manage purposes and partners. Refusing does not limit the free search service. Use Privacy and advertising choices in the footer to change or withdraw your choice on this browser. This does not undo earlier lawful processing. We do not pass search codes, room content, profiles or shared GPS positions to the consent page or advertising system.',
          'Loading Google’s service sends technical information such as your IP address, browser/device details and the public page address, including to deliver and remember your choices. With the relevant permissions, Google and the advertising partners identified in the message may use identifiers, cookies and ad interactions to deliver, personalise and measure ads and prevent fraud. IP addresses can indicate an approximate location. Partners’ purposes, storage periods and privacy information are available through Manage options.',
          'Google acts as a separate controller: its advertising terms identify Google LLC for UK personal data and Google Ireland Limited for EEA and Swiss personal data. Other partners explain their roles in their linked notices. Processing can take place outside the UK, including in the US. Google describes adequacy arrangements, the UK Extension to the EU–US Data Privacy Framework and contractual safeguards where applicable. The links below explain these arrangements and Google’s retention and rights controls; deleting your Search Pals profile does not delete information held separately by these providers.',
        ],
        links: [
          adSettings,
          { label: 'Google’s use of information from partner sites', href: 'https://policies.google.com/technologies/partner-sites?hl=en-GB' },
          { label: 'Google privacy notice', href: 'https://policies.google.com/privacy?hl=en-GB' },
          { label: 'Google advertising controller terms', href: 'https://business.safety.google/adscontrollerterms/' },
          { label: 'Google international-transfer safeguards', href: 'https://policies.google.com/privacy/frameworks?hl=en-GB' },
        ],
      },
      {
        heading: 'Optional contributions through PayPal',
        paragraphs: [
          'If you choose to support Search Pals, the link opens PayPal, which handles the payment under its own terms and privacy notice. We do not embed PayPal scripts or send it search codes, chat, profile identifiers or locations. Search Pals does not collect card details or PayPal passwords.',
          'Simon receives payment information through PayPal, including your name, email address, amount, currency, date and transaction reference, and any message you provide. We use it to administer contributions, handle enquiries, refunds or disputes and keep necessary financial records. Our lawful bases are legitimate interests in managing voluntary support and legal obligations where record-keeping is required; contributing does not subscribe you to marketing.',
          'Payment records are separate from the search database and are not included in the browser-profile export or deletion controls. We keep necessary records for as long as needed to resolve payment matters and meet applicable financial record-keeping duties, then remove records we control when no longer needed. Contact Simon about these records. PayPal determines its own retention and may process information internationally, as explained in its privacy notice.',
        ],
        links: [{ label: 'PayPal privacy notice', href: 'https://www.paypal.com/uk/legalhub/paypal/privacy-full' }, contact],
      },
      {
        heading: 'Retention and removal',
        paragraphs: [
          'Searches become eligible for deletion 90 days after closure, or after 180 days without an approved participant’s contribution, location update or management action. Reading and pending join requests do not extend this. Cleanup runs in batches; eligible records remain until processed. Older closed searches without a closure date start their 90 days when this retention policy is introduced.',
          'Guest access expires after 180 days. This does not itself delete your profile: attribution can remain while related search records are retained. Expired, unreferenced profiles are removed by housekeeping. Short-lived spam/security records are periodically cleared. Support correspondence is reviewed when the matter closes and retained only where needed for follow-up or legal duties.',
          'Data controls export submitted data and offer profile/contribution deletion; contact us for a fuller access request. Deleting organised searches also removes others’ contributions and needs separate confirmation. Clearing cookies only removes browser access. Deletion cannot erase others’ copies; hosting logs and private backups have separate retention arrangements.',
        ],
        links: [dataControls],
      },
      {
        heading: 'Your rights and complaints',
        paragraphs: [
          'Depending on the circumstances, you can request access, correction, deletion, restriction or a portable copy of your information. You can object to processing based on legitimate interests. Contact Simon using the details above; we may need proportionate information to identify your records. We normally respond within one month and explain any permitted extension.',
          'Rules block repeated messages or flag phrases; we make no legally or similarly significant automated decisions about you. Contact us to challenge moderation or complain about privacy. We acknowledge privacy complaints within 30 days, investigate and communicate the outcome without undue delay. You can also complain to the Information Commissioner’s Office.',
        ],
        links: [contact, { label: 'Complain to the ICO', href: 'https://ico.org.uk/make-a-complaint/' }],
      },
    ],
  },
  cookies: {
    title: 'Cookies and browser storage',
    summary: 'Storage for search features, optional advertising and how to change your choices.',
    updated: '14 November 2026',
    sections: [
      {
        heading: 'Guest access cookie',
        paragraphs: [
          'When you create a guest profile, Search Pals sets a first-party cookie called sp_guest. It contains a random access token, not your name or photo, and lets the server recognise your profile and permissions. It lasts up to 180 days unless you delete it sooner. It is HttpOnly, uses SameSite=Lax and is sent securely over HTTPS.',
          'This cookie is necessary for the guest service you request. Blocking or clearing it can make you lose access to searches you organise. Clearing it does not delete records held by the service; use the data controls first if you want those removed.',
        ],
        links: [dataControls],
      },
      {
        heading: 'Mute preferences and map files',
        paragraphs: [
          'Choosing “Mute chat” saves the muted guest identifiers in localStorage under searchparty-muted. This stays on your device until you unmute people or clear site storage; it is not sent to our server. We use it only to remember the preference you requested.',
          'Your browser may cache application files and map tiles to display the site efficiently. OpenStreetMap receives network requests when a map is shown, including in the demo. This is separate from sharing your live location with search members.',
        ],
        links: [{ label: 'OpenStreetMap privacy information', href: 'https://osmfoundation.org/wiki/Services_and_tile_users_privacy_FAQ' }],
      },
      {
        heading: 'Advertising and consent storage',
        paragraphs: [
          'Google AdSense is configured for the public homepage on our permanent domains, for browsers without a guest-profile cookie. Displaying ads depends on Google’s approval and delivery. Private search pages and policy pages do not load Google scripts. The separate advertising-settings page loads the consent service without requesting ads. We have no separate site analytics service; Google’s consent service can measure its messages and ads can include measurement.',
          'Where consent is required, choose consent, decline or Manage options in Google’s message. Advertising requests stay paused until the consent service provides the required decision. Accepting the terms is not advertising consent. Consent storage can remember a refusal as well as an acceptance; loading the consent service itself sends technical information to Google.',
          'Google’s published catalogue lists these possible first-party cookies set through its services on a publisher’s domain: FCCDCF for consent-message functionality, up to 13 months; FCNEC for consent-message measurement, up to 365 days; and __gads and __gpi for advertising/security, up to 13 months each. The actual cookies depend on your choices, browser and the services used. Other advertising partners and their storage details are listed in Manage options. Cookie expiry is separate from how long a provider retains information already received.',
        ],
        links: [adSettings, { label: 'Google advertising and consent cookie catalogue', href: 'https://business.safety.google/adscookies/' }],
      },
      {
        heading: 'Change or withdraw your advertising choice',
        paragraphs: [
          'Follow Privacy and advertising choices in the footer, then reopen Google’s message to change or withdraw consent. This works separately from your guest profile and does not restrict searching. Choices apply to the browser and site where they are saved; another device or clearing storage may require a new choice. If the consent service cannot load, the page explains this rather than claiming your choice was saved.',
          'Withdrawing consent changes future use; it does not automatically erase information already held by Google or other partners. You can remove existing advertising cookies through your browser’s settings and use providers’ privacy controls. Avoid deleting sp_guest if you still need access to your searches; export or delete your profile first if appropriate.',
        ],
        links: [adSettings, { label: 'Google privacy controls and information', href: 'https://policies.google.com/privacy?hl=en-GB' }],
      },
      {
        heading: 'Following the PayPal support link',
        paragraphs: [
          'The optional support button is an ordinary link. It does not load PayPal scripts, images or cookies on Search Pals. PayPal opens only when you follow the link and manages cookies and privacy choices on its own website.',
        ],
        links: [{ label: 'PayPal privacy notice', href: 'https://www.paypal.com/uk/legalhub/paypal/privacy-full' }],
      },
      {
        heading: 'Your browser and the hosting preview',
        paragraphs: [
          'You can inspect or remove cookies and local storage in your browser’s site settings. Browser location permission is managed separately. Our privacy notice explains server-side data rights.',
          'The temporary cpanel.site preview address may show a separate hosting-provider notice with its own settings. That notice is not our advertising consent mechanism; review its information before saving a preference.',
          'Questions: Simon Woolston, simonwoolston@live.com, 91 Millside, Stalham, NR12 9RL, United Kingdom.',
        ],
        links: [{ label: 'Privacy notice', href: '/privacy' }, contact],
      },
    ],
  },
  terms: {
    title: 'Terms and acceptable use',
    summary: 'The rules for using Search Pals and taking part in a pet search.',
    updated: '14 November 2026',
    sections: [
      {
        heading: 'The service and operator',
        paragraphs: [
          'Search Pals is provided by Simon Woolston, 91 Millside, Stalham, NR12 9RL, United Kingdom; email simonwoolston@live.com. These terms apply to the coordination service. You must be 18 or over and accept them to create a profile.',
          'The current service is free and supports missing dogs and cats. It is not a missing-person service, emergency service, veterinary service or professional search operation. It does not verify identities, ownership, sightings or the suitability of volunteers.',
        ],
        links: [contact, { label: 'Search safety', href: '/safety' }],
      },
      {
        heading: 'Optional support for the website',
        paragraphs: [
          'You may voluntarily contribute towards hosting and running Search Pals. Contributions go to Simon Woolston through the PayPal account simonwoolston@live.com, displayed as “Digital online”. Search Pals is independently run and is not a registered charity; these contributions are not offered as Gift Aid donations.',
          'Searching and joining remain free. Contributing buys no priority, extra access or promise of a successful search. Choose the amount and any available payment frequency on PayPal; a monthly contribution applies only if you select that option there. PayPal processes payments under its own terms and may deduct its normal fees.',
          'For a mistaken payment, refund request or payment question, email Simon with the transaction reference. Do not send card details or passwords. Any rights you have under applicable law and PayPal’s terms remain unaffected. If you choose recurring support, manage or cancel it through PayPal; deleting a Search Pals profile does not cancel a PayPal payment arrangement.',
        ],
        links: [contact, { label: 'Support Search Pals', href: '/#support-search-pals' }, { label: 'PayPal terms', href: 'https://www.paypal.com/uk/legalhub/paypal/useragreement-full' }],
      },
      {
        heading: 'Using a search room',
        paragraphs: [
          'Create appeals only for real pet searches you are entitled to organise. Be accurate, distinguish possible from confirmed sightings, and correct mistakes. Organisers approve members and appoint moderators. Approval does not certify that someone is safe or trustworthy.',
          'Keep your device secure. Guest access is tied to its browser cookie; there is no password-based recovery. Keep another trusted moderator involved where possible. Map markers can be inaccurate or stale, and updates depend on connectivity and an open page. Keep another way to contact your search group.',
        ],
      },
      {
        heading: 'Content and conduct',
        bullets: [
          'Use the service lawfully and for the search. Do not post threats, harassment, hate, sexual content, exploitation, animal abuse, scams, impersonation or deliberately false information.',
          'Do not post private information about others, identify children, publish accusations against named people, or use a search to track, stalk or confront someone.',
          'Only upload material you own or have permission to use. Avoid identifiable people, private documents and unnecessary addresses in pet photographs.',
          'Do not spam, bypass access restrictions or removals, harvest member information, interfere with the service, or use it to advertise, solicit payments or sell animals.',
          'Respect landowners, road rules, animal welfare and other people’s decisions about sharing location. An organiser’s instruction does not authorise unsafe conduct or trespass.',
        ],
        paragraphs: [
          'You keep ownership of your contributions. You give us a non-exclusive permission to store, resize and display them as needed to provide and moderate the service, including the public appeal you choose to publish. This does not give us permission to sell your content. Removal and retention follow the privacy notice.',
        ],
      },
      {
        heading: 'Reports, moderation and complaints',
        paragraphs: [
          'Use Report for a message or member, or email Simon to report illegal content, unsafe conduct or a problem with an organiser. Include the search code, relevant content and your concern; do not forward illegal images. Reports inside a room go to its organiser/moderators. Email reaches the site operator.',
          'We use message limits, duplicate checks and basic phrase flags. These can miss problems or flag innocent words. Organisers, moderators or the operator may remove content, restrict access or close a search where reasonably needed to address a breach, protect people or comply with law. Serious concerns may require immediate action.',
          'You can email a complaint or ask for a decision to be reconsidered, explaining what happened. We will consider the context and provide an explanation where appropriate and lawful. This is not a continuously staffed service; do not wait for a response in an emergency.',
        ],
      },
      {
        heading: 'Ending use, changes and responsibility',
        paragraphs: [
          'You may stop using the service and use the data controls to request or remove your information. Closing a search stops activity but does not immediately delete it. Deleting an organised search removes its room for everyone; consider other helpers before doing so.',
          'We may update features or terms for operational, security or legal reasons. We will explain material changes before they apply where practicable; urgent changes may take effect sooner. Changes do not remove existing rights.',
          'We will use reasonable care in providing the service, but cannot promise an uninterrupted connection, accurate user reports or a successful recovery. Nothing in these terms excludes or limits liability for death or personal injury caused by negligence, fraud, or any liability or consumer right that cannot lawfully be excluded or limited.',
          'English law applies, without removing mandatory consumer protections available where you live. You retain any right to bring proceedings in the courts available to you under applicable law.',
        ],
        links: [{ label: 'Privacy notice and retention', href: '/privacy' }, dataControls],
      },
    ],
  },
  safety: {
    title: 'Search safely',
    summary: 'Help the pet without putting yourself, other people or animals at risk.',
    updated: '14 November 2026',
    sections: [
      {
        heading: 'Use the right help',
        paragraphs: [
          'Search Pals is for adults coordinating dog and cat searches. It is not for missing children or adults. Contact police about a missing person. Call 999 if someone is in immediate danger or a crime is in progress; use 101 for non-emergency police matters.',
          'For an injured animal, seek advice from a vet or appropriate animal-welfare service. Do not handle an animal if doing so is unsafe. Report a missing dog to your council’s dog warden and contact local vets, rescues and the microchip database where relevant.',
        ],
        links: [
          { label: 'GOV.UK: contacting police', href: 'https://www.gov.uk/contact-police' },
          { label: 'GOV.UK: council missing-dog service', href: 'https://www.gov.uk/check-council-missing-dog' },
          { label: 'RSPCA: lost and found pets', href: 'https://www.rspca.org.uk/en/adviceandwelfare/pets/lost' },
        ],
      },
      {
        heading: 'Before and during a search',
        bullets: [
          'Arrange a check-in with someone you trust. Take a charged phone, suitable clothing and a torch when needed. Work with a trusted companion and stay within your abilities.',
          'Stay off railway lines and dangerous roads; avoid water, unstable ground and isolated places where you cannot search safely. Get permission before entering private land or buildings.',
          'Keep a calm distance from frightened animals. Do not chase, corner or attempt a risky capture. Send a useful sighting and ask the owner or an experienced animal handler what to do.',
          'Stop if conditions become unsafe. Do not drive while reading chat or marking the map.',
        ],
      },
      {
        heading: 'Treat reports and people carefully',
        paragraphs: [
          'Check each report’s time, location and certainty. “Searched” means someone reported checking an area, not that the animal cannot be there. A confirmed marker is a moderator’s assessment, not an independent guarantee.',
          'Share only necessary information. Keep home addresses, children’s details, access codes and payment information out of appeals and chat. Verify ownership through appropriate checks before handing over an animal; do not send money because a stranger claims to have found it.',
          'Joining a room does not verify identity. Meet cautiously, reject unsafe instructions, and report harassment or suspicious requests. GPS is optional and can be inaccurate or stop updating when the screen locks. Stop sharing when you finish; do not rely on the map as a safety check-in.',
        ],
        links: [contact, { label: 'Terms and reporting', href: '/terms' }],
      },
    ],
  },
};
