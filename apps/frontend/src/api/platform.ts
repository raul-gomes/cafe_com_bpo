import { apiClient } from './client';
import {
  adminAnnouncementListSchema,
  adminAnnouncementSchema,
  adminLessonListSchema,
  adminLessonSchema,
  adminSiteSchema,
  adminUserListSchema,
  announcementListSchema,
  cafeRsvpAcceptedSchema,
  cafeRsvpListSchema,
  courtesySchema,
  lessonListSchema,
  publicSiteSchema,
  type AdminAnnouncement,
  type AdminLesson,
  type AdminSite,
  type AdminUser,
  type Announcement,
  type AnnouncementInput,
  type CafeMeeting,
  type CafeRsvp,
  type CafeRsvpAccepted,
  type CafeRsvpInput,
  type Courtesy,
  type Lesson,
  type LessonInput,
  type LoginNotice,
  type PublicSite,
} from '../schemas/platform';

/* ── Reads for everyone ─────────────────────────────────────────────────── */

/** Published lessons of every Aulas section. */
export async function listLessons(): Promise<Lesson[]> {
  const { data } = await apiClient.get('/lessons');
  return lessonListSchema.parse(data);
}

/** Post-its of the home panel for the signed-in user. */
export async function listActiveAnnouncements(): Promise<Announcement[]> {
  const { data } = await apiClient.get('/announcements/active');
  return announcementListSchema.parse(data);
}

/** Editable pieces of the public site (login notice, next open café). No login needed. */
export async function getPublicSite(): Promise<PublicSite> {
  const { data } = await apiClient.get('/site/public');
  return publicSiteSchema.parse(data);
}

/**
 * Public attendance confirmation for the next open café.
 *
 * @param input Name plus e-mail and/or phone.
 * @returns When the meeting happens and its link, once the team has set one.
 */
export async function confirmCafePresence(input: CafeRsvpInput): Promise<CafeRsvpAccepted> {
  const { data } = await apiClient.post('/cafes/rsvps', input);
  return cafeRsvpAcceptedSchema.parse(data);
}

/* ── Administrator ──────────────────────────────────────────────────────── */

export async function adminListLessons(): Promise<AdminLesson[]> {
  const { data } = await apiClient.get('/admin/lessons');
  return adminLessonListSchema.parse(data);
}

export async function adminSaveLesson(input: LessonInput, id?: string): Promise<AdminLesson> {
  const { data } = id
    ? await apiClient.put(`/admin/lessons/${id}`, input)
    : await apiClient.post('/admin/lessons', input);
  return adminLessonSchema.parse(data);
}

export async function adminDeleteLesson(id: string): Promise<void> {
  await apiClient.delete(`/admin/lessons/${id}`);
}

export async function adminListAnnouncements(): Promise<AdminAnnouncement[]> {
  const { data } = await apiClient.get('/admin/announcements');
  return adminAnnouncementListSchema.parse(data);
}

export async function adminSendAnnouncement(input: AnnouncementInput): Promise<AdminAnnouncement> {
  const { data } = await apiClient.post('/admin/announcements', input);
  return adminAnnouncementSchema.parse(data);
}

export async function adminDeleteAnnouncement(id: string): Promise<void> {
  await apiClient.delete(`/admin/announcements/${id}`);
}

export async function adminGetSite(): Promise<AdminSite> {
  const { data } = await apiClient.get('/admin/site');
  return adminSiteSchema.parse(data);
}

export async function adminSaveLoginNotice(notice: LoginNotice): Promise<AdminSite> {
  const { data } = await apiClient.put('/admin/site/login-notice', notice);
  return adminSiteSchema.parse(data);
}

export async function adminSaveCafeMeeting(meeting: CafeMeeting): Promise<AdminSite> {
  const { data } = await apiClient.put('/admin/site/cafe-meeting', meeting);
  return adminSiteSchema.parse(data);
}

/** An admin list and how many rows exist in all (header X-Total-Count). */
export interface AdminList<T> {
  items: T[];
  total: number;
}

/** Ceiling the API accepts for one admin list: what the Excel exports ask for. */
export const ADMIN_EXPORT_LIMIT = 20000;

/** Reads X-Total-Count; without it, the list is taken as complete. */
function totalFrom(headers: unknown, fallback: number): number {
  const raw = (headers as Record<string, unknown> | undefined)?.['x-total-count'];
  const total = Number(raw);
  return raw != null && Number.isFinite(total) ? total : fallback;
}

/** Confirmations of the open cafés; without `limit`, the screen default (500). */
export async function adminListRsvps(limit?: number): Promise<AdminList<CafeRsvp>> {
  const { data, headers } = await apiClient.get('/admin/cafes/rsvps', limit ? { params: { limit } } : undefined);
  const items = cafeRsvpListSchema.parse(data);
  return { items, total: totalFrom(headers, items.length) };
}

/** Users with their access; without `limit`, the screen default (300). */
export async function adminListUsers(search?: string, limit?: number): Promise<AdminList<AdminUser>> {
  const params = { ...(search ? { search } : {}), ...(limit ? { limit } : {}) };
  const { data, headers } = await apiClient.get('/admin/users', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  const items = adminUserListSchema.parse(data);
  return { items, total: totalFrom(headers, items.length) };
}

export async function adminGrantCourtesy(userId: string, days: number, reason?: string): Promise<Courtesy> {
  const { data } = await apiClient.post(`/admin/users/${userId}/courtesy`, { days, reason: reason || null });
  return courtesySchema.parse(data);
}

export async function adminRevokeCourtesy(grantId: string): Promise<void> {
  await apiClient.delete(`/admin/courtesies/${grantId}`);
}
