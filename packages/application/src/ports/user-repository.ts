import { Result } from '@misc-poc/shared';
import { User, GoogleId, DomainError } from '@misc-poc/domain';

/**
 * Repository interface for User entity persistence
 *
 * This interface defines the contract for user data operations.
 * All methods return Results to handle errors gracefully.
 */
export interface UserRepository {
  /**
   * Find a user by their Google OAuth ID
   * @param googleId The Google OAuth identifier
   * @returns Result containing the User if found, or null if not found
   */
  findByGoogleId(googleId: GoogleId): Promise<Result<User | null, DomainError>>;

  /**
   * Create a new user with Google profile information
   * @param user The User entity to persist
   * @returns Result containing the created User
   */
  create(user: User): Promise<Result<User, DomainError>>;

  /**
   * Update user settings
   * @param user The User entity with updated settings
   * @returns Result containing the updated User
   */
  updateSettings(user: User): Promise<Result<User, DomainError>>;

  /**
   * Update the last login timestamp for a user
   * @param user The User entity with updated last login
   * @returns Result containing the updated User
   */
  updateLastLogin(user: User): Promise<Result<User, DomainError>>;
}
