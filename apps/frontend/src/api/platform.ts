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

export async function adminListRsvps(): Promise<CafeRsvp[]> {
  const { data } = await apiClient.get('/admin/cafes/rsvps');
  return cafeRsvpListSchema.parse(data);
}

export async function adminListUsers(search?: string): Promise<AdminUser[]> {
  const { data } = await apiClient.get('/admin/users', { params: search ? { search } : undefined });
  return adminUserListSchema.parse(data);
}

export async function adminGrantCourtesy(userId: string, days: number, reason?: string): Promise<Courtesy> {
  const { data } = await apiClient.post(`/admin/users/${userId}/courtesy`, { days, reason: reason || null });
  return courtesySchema.parse(data);
}

export async function adminRevokeCourtesy(grantId: string): Promise<void> {
  await apiClient.delete(`/admin/courtesies/${grantId}`);
}
