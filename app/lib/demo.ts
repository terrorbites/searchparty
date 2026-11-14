import type { Member, Room } from '../types';

export function makeDemo(): Room {
  const now = Date.now();
  const person = (id: string, name: string, role: Member['role'], lat: number | null, lng: number | null, status: Member['status'] = 'approved'): Member => ({ id, name, avatar: null, role, status, lat, lng, accuracy: lat ? 15 : null, locationAt: lat ? now - 22000 : null, joinedAt: now - 3600000 });
  const you = person('demo-you', 'Alex Morgan', 'organiser', null, null);
  return {
    search: { id: 'demo-search', code: 'MILO24', petName: 'Milo', petType: 'dog', description: 'Golden retriever, wearing a blue collar. Friendly but may be nervous. Please keep your distance and report any sightings.', photo: null, locationLabel: 'Clapham Common, London', lat: 51.4587, lng: -0.1493, lastSeenAt: now - 5400000, instructions: 'Please check the paths around the common. If you see Milo, stay calm, don’t chase him and share a sighting here.', status: 'active', joinPaused: false, createdAt: now - 4800000 },
    me: you,
    members: [you, person('demo-jo', 'Jo Wilson', 'moderator', 51.4613, -0.1505), person('demo-sam', 'Sam Patel', 'helper', 51.457, -0.1457), person('demo-emma', 'Emma Clarke', 'helper', 51.4562, -0.1522), person('demo-ben', 'Ben Taylor', 'helper', null, null, 'pending')],
    messages: [
      { id: 'demo-m1', authorId: 'demo-you', authorName: 'Alex Morgan', authorAvatar: null, role: 'organiser', kind: 'update', content: 'Thank you for helping us look for Milo. Please focus on the common and mark the areas you’ve checked on the map.', createdAt: now - 2400000, flagged: false },
      { id: 'demo-m2', authorId: 'demo-jo', authorName: 'Jo Wilson', authorAvatar: null, role: 'moderator', kind: 'chat', content: 'I’m checking the paths by the bandstand now.', createdAt: now - 720000, flagged: false },
      { id: 'demo-m3', authorId: 'demo-sam', authorName: 'Sam Patel', authorAvatar: null, role: 'helper', kind: 'chat', content: 'Finished the south side. I’ve marked it on the map.', createdAt: now - 420000, flagged: false },
      { id: 'demo-m4', authorId: 'demo-you', authorName: 'Alex Morgan', authorAvatar: null, role: 'organiser', kind: 'update', content: 'A possible sighting near the pond. Please check the eastern paths and keep an eye out for a blue collar.', createdAt: now - 240000, flagged: false },
    ],
    reports: [
      { id: 'demo-r1', authorId: 'demo-sam', authorName: 'Sam Patel', kind: 'searched', lat: 51.4564, lng: -0.1489, radius: 130, note: 'Checked the paths and open grass. No sign of Milo.', occurredAt: now - 600000, createdAt: now - 580000, confirmed: false },
      { id: 'demo-r2', authorId: 'demo-jo', authorName: 'Jo Wilson', kind: 'searching', lat: 51.461, lng: -0.1508, radius: 90, note: 'Checking around the bandstand.', occurredAt: now - 420000, createdAt: now - 400000, confirmed: false },
      { id: 'demo-r3', authorId: 'demo-emma', authorName: 'Emma Clarke', kind: 'sighting', lat: 51.4596, lng: -0.1448, radius: 30, note: 'Possibly a golden retriever heading towards the pond. Couldn’t see the collar.', occurredAt: now - 300000, createdAt: now - 280000, confirmed: false },
    ], abuseReports: [], serverTime: now,
  };
}

export function demoMutation(room: Room, suffix: string, method: string, body: any): Room {
  const next = structuredClone(room); const now = Date.now(); const id = () => `demo-${crypto.randomUUID()}`; const me = next.me!;
  if (suffix === '' && method === 'PATCH') { Object.assign(next.search, body); if (body.status === 'found') for (const member of next.members) { member.lat = null; member.lng = null; member.locationAt = null; } }
  if (suffix === '/messages' && method === 'POST') next.messages.push({ id: id(), authorId: me.id, authorName: me.name, authorAvatar: me.avatar, role: me.role, content: body.content, kind: body.kind, createdAt: now, flagged: false });
  if (suffix.startsWith('/messages/') && method === 'DELETE') next.messages = next.messages.filter(message => message.id !== suffix.split('/')[2]);
  if (suffix === '/reports' && method === 'POST') next.reports.push({ ...body, id: id(), authorId: me.id, authorName: me.name, createdAt: now, confirmed: false });
  if (suffix.startsWith('/reports/') && method === 'PATCH') { const report = next.reports.find(item => item.id === suffix.split('/')[2]); if (report) report.confirmed = body.confirmed; }
  if (suffix.startsWith('/reports/') && method === 'DELETE') next.reports = next.reports.filter(item => item.id !== suffix.split('/')[2]);
  if (suffix.startsWith('/members/') && method === 'PATCH') { const member = next.members.find(item => item.id === suffix.split('/')[2]); if (member) { if (body.status) member.status = body.status; if (body.role) member.role = body.role; if (body.removeAvatar) member.avatar = null; if (body.status === 'banned') { member.lat = null; member.lng = null; member.locationAt = null; } } }
  if (suffix === '/abuse' && method === 'POST') next.abuseReports.push({ ...body, id: id(), reporterName: me.name, createdAt: now, resolved: false });
  if (suffix.startsWith('/abuse/') && method === 'PATCH') next.abuseReports = next.abuseReports.filter(item => item.id !== suffix.split('/')[2]);
  return next;
}
