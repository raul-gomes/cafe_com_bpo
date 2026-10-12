import { z } from 'zod';

/**
 * Contracts of the platform content managed by administrators: lessons,
 * announcements, site settings (login notice, open café), café attendance and
 * the users list with courtesy grants.
 *
 * `.strict()` everywhere (same rule as `schemas/beta.ts`): a field the backend
 * starts sending must show up here on purpose, not slip in silently.
 */

export const lessonSectionSchema = z.enum(['primeiros-passos', 'bpo-primeiros-passos', 'mentorias']);
export type LessonSection = z.infer<typeof lessonSectionSchema>;

export const lessonSchema = z
  .object({
    id: z.string(),
    section: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    youtube_id: z.string().nullable(),
    position: z.number(),
  })
  .strict();
export const lessonListSchema = z.array(lessonSchema);
export type Lesson = z.infer<typeof lessonSchema>;

export const adminLessonSchema = lessonSchema
  .extend({ video_url: z.string().nullable(), is_published: z.boolean() })
  .strict();
export const adminLessonListSchema = z.array(adminLessonSchema);
export type AdminLesson = z.infer<typeof adminLessonSchema>;

export interface LessonInput {
  section: LessonSection;
  title: string;
  summary?: string | null;
  video_url?: string | null;
  position: number;
  is_published: boolean;
}

export const announcementSchema = z
  .object({ id: z.string(), title: z.string(), message: z.string(), created_at: z.string() })
  .strict();
export const announcementListSchema = z.array(announcementSchema);
export type Announcement = z.infer<typeof announcementSchema>;

export const audienceSchema = z.enum(['all', 'paying', 'free']);
export type Audience = z.infer<typeof audienceSchema>;

export const adminAnnouncementSchema = announcementSchema
  .extend({
    audience: z.string(),
    show_on_home: z.boolean(),
    expires_at: z.string().nullable(),
    recipients_count: z.number(),
  })
  .strict();
export const adminAnnouncementListSchema = z.array(adminAnnouncementSchema);
export type AdminAnnouncement = z.infer<typeof adminAnnouncementSchema>;

export interface AnnouncementInput {
  title: string;
  message: string;
  audience: Audience;
  show_on_home: boolean;
  expires_at?: string | null;
}

export const loginNoticeSchema = z
  .object({
    title: z.string(),
    message: z.string(),
    link_label: z.string().nullable(),
    link_url: z.string().nullable(),
  })
  .strict();
export type LoginNotice = z.infer<typeof loginNoticeSchema>;

export const publicSiteSchema = z
  .object({
    login_notice: loginNoticeSchema,
    cafe_meeting: z
      .object({ title: z.string(), starts_at: z.string(), duration_minutes: z.number() })
      .strict(),
  })
  .strict();
export type PublicSite = z.infer<typeof publicSiteSchema>;

export const cafeMeetingSchema = z
  .object({
    title: z.string(),
    meet_url: z.string().nullable(),
    starts_at: z.string().nullable(),
    duration_minutes: z.number(),
  })
  .strict();
export type CafeMeeting = z.infer<typeof cafeMeetingSchema>;

export const adminSiteSchema = z
  .object({
    login_notice: loginNoticeSchema,
    cafe_meeting: cafeMeetingSchema,
    next_meeting_starts_at: z.string(),
  })
  .strict();
export type AdminSite = z.infer<typeof adminSiteSchema>;

export interface CafeRsvpInput {
  name: string;
  email?: string;
  phone?: string;
  /** Honeypot against bots: stays empty for people. */
  website?: string;
}

export const cafeRsvpAcceptedSchema = z
  .object({
    title: z.string(),
    starts_at: z.string(),
    duration_minutes: z.number(),
    meet_url: z.string().nullable(),
  })
  .strict();
export type CafeRsvpAccepted = z.infer<typeof cafeRsvpAcceptedSchema>;

export const cafeRsvpSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    meeting_starts_at: z.string(),
    created_at: z.string(),
  })
  .strict();
export const cafeRsvpListSchema = z.array(cafeRsvpSchema);
export type CafeRsvp = z.infer<typeof cafeRsvpSchema>;

export const courtesySchema = z
  .object({ id: z.string(), expires_at: z.string(), reason: z.string().nullable() })
  .strict();
export type Courtesy = z.infer<typeof courtesySchema>;

export const adminUserSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    role: z.string(),
    created_at: z.string().nullable(),
    access_state: z.string(),
    access_expires_at: z.string().nullable(),
    courtesy: courtesySchema.nullable(),
  })
  .strict();
export const adminUserListSchema = z.array(adminUserSchema);
export type AdminUser = z.infer<typeof adminUserSchema>;
