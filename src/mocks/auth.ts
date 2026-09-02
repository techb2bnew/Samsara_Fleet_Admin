/**
 * Mock content for the invite screen.
 *
 * There is no mock sign-in any more. Signing in always goes to Supabase, so a
 * fake login cannot be reached by accident — see features/auth/AuthProvider.
 *
 * What is left is the placeholder invitation the accept-invite screen shows
 * until a real invite token is read out of the link.
 */

export const MOCK_INVITATION = {
  orgName: 'Northline Haulage',
  roleName: 'Dispatcher',
  email: 'priya@northline.example',
} as const
