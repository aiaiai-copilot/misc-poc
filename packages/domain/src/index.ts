export { TagNormalizer } from './tag-normalizer';
export type { TagNormalizerConfig } from './tag-normalizer';
export { TagValidator } from './tag-validator';
export type { TagValidationResult } from './tag-validator';
export { TagParser } from './tag-parser';
export { Tag } from './tag';
export { TagFactory } from './tag-factory';
export { Record } from './record';
export { RecordFactory } from './record-factory';
export { RecordDuplicateChecker } from './record-duplicate-checker';
export { RecordMatcher } from './record-matcher';
export {
  DomainError,
  InvalidRecordContentError,
  InvalidTagError,
  DuplicateRecordError,
  TagLimitExceededError,
} from './domain-errors';

// User domain entities and value objects
export { User } from './user';
export { GoogleId } from './google-id';
export { UserSettings } from './user-settings';
export { AuthenticationContext } from './authentication-context';
export { UserFactory } from './user-factory';
