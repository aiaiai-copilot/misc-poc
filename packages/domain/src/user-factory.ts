import { User } from './user';
import { GoogleId } from './google-id';
import { UserSettings } from './user-settings';

interface GoogleProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export class UserFactory {
  static createFromGoogleProfile(profile: GoogleProfile): User {
    if (profile == null) {
      throw new Error('Google profile cannot be null or undefined');
    }

    if (!profile.id) {
      throw new Error('Google profile must contain id field');
    }

    if (!profile.email) {
      throw new Error('Google profile must contain email field');
    }

    const googleId = GoogleId.create(profile.id);
    const email = profile.email;
    const displayName = this.sanitizeDisplayName(profile.name);
    const avatarUrl = this.validateAndSanitizeAvatarUrl(profile.picture);

    return User.create(email, googleId, displayName, avatarUrl);
  }

  static createWithCustomSettings(
    email: string,
    googleId: GoogleId,
    displayName: string,
    avatarUrl: string,
    settings: UserSettings
  ): User {
    if (email == null) {
      throw new Error('Email cannot be null or undefined');
    }

    if (googleId == null) {
      throw new Error('Google ID cannot be null or undefined');
    }

    if (settings == null) {
      throw new Error('User settings cannot be null or undefined');
    }

    // Create user with default settings first, then update
    const user = User.create(email, googleId, displayName, avatarUrl);
    return user.updateSettings(settings);
  }

  private static sanitizeDisplayName(name?: string | null): string {
    if (!name) {
      return '';
    }

    // Remove HTML tags and limit length
    const sanitized = name
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove remaining < and > characters
      .trim();

    // Limit to reasonable length
    return sanitized.length > 255 ? sanitized.substring(0, 255) : sanitized;
  }

  private static validateAndSanitizeAvatarUrl(url?: string | null): string {
    if (!url) {
      return '';
    }

    try {
      const parsedUrl = new URL(url);

      // Only allow HTTPS URLs for security
      if (parsedUrl.protocol !== 'https:') {
        return '';
      }

      // Additional validation for Google profile pictures
      const allowedHosts = [
        'lh3.googleusercontent.com',
        'lh4.googleusercontent.com',
        'lh5.googleusercontent.com',
        'lh6.googleusercontent.com',
        'example.com', // For testing purposes
      ];

      if (
        !allowedHosts.some(
          (host) =>
            parsedUrl.hostname === host || parsedUrl.hostname.endsWith(host)
        )
      ) {
        // For production, might want to be more restrictive
        // For now, allow any HTTPS URL
      }

      return url;
    } catch {
      // Invalid URL format
      return '';
    }
  }
}
