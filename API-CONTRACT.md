# SearchParty API contract

All endpoints use same-origin cookies and return `{error: string}` with an HTTP error status on failure. Responses are JSON except the public pet photo endpoint. Times are Unix milliseconds. Shared types are in app/types.ts. Unsafe requests require `Content-Type: application/json` and same origin. Successful mutation responses can be small `{ok: true}` unless specified; clients reload room state afterward. The production deployment target is PHP 8.1+ with PDO SQLite on cPanel; the earlier TypeScript/D1 handler is a reference implementation and does not include the later API additions below.

- `GET /api/session` -> SessionResponse (anonymous permitted)
- `POST /api/session` body `{name, avatar?: JPEG data URL|null}` -> SessionResponse, creates or updates a device guest profile and HttpOnly cookie. Updating a profile preserves member identity/roles.
- `POST /api/searches` body CreateSearchInput -> `{code}` (requires profile; creates approved organiser membership)
- `GET /api/searches/:code` -> Room. Nonmembers/pending/banned receive public appeal only, no messages, member list, precise helper locations, or reports. `me` remains available so client can display status.
- `GET /api/searches/:code/photo` -> public JPEG with `Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff` and cache headers, or 404 when absent. `Search.photo` in rooms and session summaries is this same-origin URL or null, avoiding a base64 photo in each poll.
- `POST /api/searches/:code/join` body `{}` -> `{ok:true}` (pending by default, existing membership idempotent; bans enforced)
- `PATCH /api/searches/:code` body `{joinPaused?: boolean, status?: 'active'|'found'}` organiser only; found clears shared locations and disables writes except moderation
- `POST /api/searches/:code/messages` body `{content, kind:'chat'|'update'}` approved members only; updates organiser/moderator only
- `DELETE /api/searches/:code/messages/:id` body `{}` author or organiser/moderator; no cross-search deletions
- `POST /api/searches/:code/reports` body `{kind:'sighting'|'searched'|'searching',lat,lng,radius,note,occurredAt}` approved members only
- `PATCH /api/searches/:code/reports/:id` body `{confirmed:boolean}` organiser/moderator; only sighting reports
- `DELETE /api/searches/:code/reports/:id` body `{}` author or organiser/moderator; no cross-search deletions; permitted after closure for moderation, like message deletion
- `POST /api/searches/:code/location` body `{lat,lng,accuracy,version}` or `{stop:true}` approved members only. `version` must be a nonnegative integer equal to the member's persisted location version, otherwise 409. `Room.me.locationVersion` provides the current version (initially 0); other member DTOs need not expose it. Stop atomically clears the coordinates and increments the version, preventing an older GPS callback from restarting sharing. Fetch the latest room before starting a new sharing session. Coordinates also clear on ban/closure, and regular updates require an active search.
- `PATCH /api/searches/:code/members/:id` body `{status?:'approved'|'banned',role?:'helper'|'moderator',removeAvatar?:true}`. :id is guest id. Organiser/moderator may approve/remove helpers; only organiser changes roles; cannot act on organiser or self, moderators cannot act on other moderators.
- `POST /api/searches/:code/abuse` body `{targetType:'message'|'member',targetId,reason}` approved members only, scoped targets
- `PATCH /api/searches/:code/abuse/:id` body `{resolved:true}` organiser/moderator

GET room returns maximum 150 recent messages, 200 map reports and only unresolved abuse reports. No unbounded arrays. Live message `authorAvatar` is null; clients look up the author's avatar in `Room.members`, so each photo is transmitted once instead of repeated for every message. Current shared positions expire after 30 minutes and must show freshness; poll room every 5 seconds only while visible. Joining/profile/create/write endpoints rate limited persistently. No automatic sample records in live database. Demo mode is entirely local, clearly labelled, and uses the same UI types.
