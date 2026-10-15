/**
 * Where the driver app is published.
 *
 * One place, because the same two links appear in three: the Help page, the
 * public support document, and the invitation email a driver is sent before
 * they have the app at all.
 *
 * The email is the exception that cannot import this file. It is sent by an
 * Edge Function, which runs on Deno in Supabase and has no access to the
 * console's source — supabase/functions/invite-driver/index.ts keeps its own
 * copy of these two strings. Change one, change the other.
 */
export const APP_STORE_URL = 'https://apps.apple.com/us/app/b2bsamsaradriver/id6811781965'

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.base2brand.samsaradriver'
