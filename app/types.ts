export type PetType = 'dog' | 'cat';
export type Role = 'organiser' | 'moderator' | 'helper';
export type MemberStatus = 'pending' | 'approved' | 'banned';
export interface Profile { id: string; name: string; avatar: string | null }
export interface Search { id: string; code: string; petName: string; petType: PetType; description: string; photo: string | null; locationLabel: string; lat: number; lng: number; lastSeenAt: number; instructions: string; status: 'active' | 'found'; joinPaused: boolean; createdAt: number }
export interface Member extends Profile { role: Role; status: MemberStatus; lat: number | null; lng: number | null; accuracy: number | null; locationAt: number | null; locationVersion?: number; joinedAt: number }
export interface Message { id: string; authorId: string; authorName: string; authorAvatar: string | null; role: Role; kind: 'chat' | 'update'; content: string; createdAt: number; flagged: boolean }
export interface MapReport { id: string; authorId: string; authorName: string; kind: 'sighting' | 'searched' | 'searching'; lat: number; lng: number; radius: number; note: string; occurredAt: number; createdAt: number; confirmed: boolean }
export interface AbuseReport { id: string; reporterName: string; targetType: 'message' | 'member'; targetId: string; reason: string; createdAt: number; resolved: boolean }
export interface Room { search: Search; me: Member | null; members: Member[]; messages: Message[]; reports: MapReport[]; abuseReports: AbuseReport[]; serverTime: number }
export interface SearchSummary { search: Search; role: Role; status: MemberStatus }
export interface SessionResponse { profile: Profile | null; searches: SearchSummary[] }
export interface CreateSearchInput { petName: string; petType: PetType; description: string; photo?: string | null; locationLabel: string; lat: number; lng: number; lastSeenAt: number; instructions?: string }
