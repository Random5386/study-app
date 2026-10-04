// Sample API responses shared by the web tests.
import type { PublicUser } from '@studyapp/shared';

export const testUser: PublicUser = {
  id: '0192f3a0-0000-7000-8000-000000000001',
  email: 'ada@test.dev',
  displayName: 'Ada',
  emailVerified: true,
  mfaEnabled: true,
  studyLevel: 'UNIVERSITY',
  schoolGrade: null,
  createdAt: '2026-01-15T10:00:00.000Z',
};

/** Fakes for the calls every signed-in page makes (the home page lists). */
export const signedInFakes = (user: PublicUser = testUser) => ({
  'GET /api/auth/session': { status: 200, body: { user, mfaPending: false } },
  'GET /api/auth/csrf': { status: 200, body: { csrfToken: 'test-csrf-token' } },
  'GET /api/subjects': { status: 200, body: [] },
  'GET /api/documents': { status: 200, body: [] },
  'GET /api/documents/stats': { status: 200, body: { usedBytes: 0, quotaBytes: 52428800, documentCount: 0 } },
  'GET /api/health': { status: 200, body: { ok: true, app: 'StudyApp', database: 'up', time: '' } },
});
