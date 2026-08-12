import { describe, expect, it } from 'vitest';
import type { Database } from '../platform/database/types.js';
import type { FileStorageService } from '../platform/files/service.js';
import type { NotificationRepository } from '../platform/notifications/repository.js';
import { createFeatureRegistry } from './feature-registry.js';

const expectedFeatureIds = [
  'books',
  'courses',
  'countdowns',
  'goals',
  'tasks',
  'calendar',
  'inbox',
  'subscriptions',
  'finance',
  'life-countdown',
  'timetable',
] as const;

describe('feature registry search contract', () => {
  it('registers a search provider for every released feature', () => {
    const registry = createFeatureRegistry(
      {} as Database,
      {} as NotificationRepository,
      {} as FileStorageService,
    );

    expect(registry.map((registration) => registration.featureId)).toEqual(expectedFeatureIds);
    for (const registration of registry) {
      expect(registration.contribution.search, registration.featureId).toBeDefined();
      expect(registration.contribution.search?.featureId).toBe(registration.featureId);
    }
  });
});
