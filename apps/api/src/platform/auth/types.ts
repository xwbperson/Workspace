import type { SessionView } from '@workspace/client-sdk';

export interface OwnerRow {
  id: string;
  username: 'owner';
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRow {
  sessionId: string;
  sessionFamilyId: string;
  currentTokenHash: string;
  previousTokenHash: string | null;
  previousTokenGraceUntil: Date | null;
  csrfTokenHash: string;
  clientLabel: string;
  remembered: boolean;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  lastRotatedAt: Date;
  revokedAt: Date | null;
}

export interface SessionAuth {
  userId: string;
  workspaceId: string;
  sessionId: string;
  sessionFamilyId: string;
  csrfTokenHash: string;
  remembered: boolean;
}

export interface AuthenticatedSession {
  auth: SessionAuth;
  view: SessionView;
  replacementCookieValue?: string;
  replacementCookieMaxAgeSeconds?: number;
}
