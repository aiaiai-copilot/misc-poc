import { AuthConfig } from './config.js';

/**
 * CSRF Protection Strategy Documentation
 *
 * This module documents the CSRF protection measures implemented through
 * secure cookie configuration, following security best practices.
 *
 * CSRF Protection Layers:
 * 1. SameSite cookie attribute (primary protection)
 * 2. Secure and HttpOnly flags
 * 3. Cookie signing for integrity
 * 4. Domain and path restrictions
 * 5. HTTPS enforcement in production
 */

/**
 * CSRF protection levels available
 */
export enum CSRFProtectionLevel {
  STRICT = 'strict', // Maximum protection (production)
  LAX = 'lax', // Balanced protection (development)
  DISABLED = 'none', // No CSRF protection (testing only)
}

/**
 * Get CSRF protection configuration based on environment
 */
export function getCSRFProtectionConfig(config: AuthConfig): {
  sameSite: CSRFProtectionLevel;
  secure: boolean;
  httpOnly: boolean;
  signed: boolean;
  domain?: string;
  path?: string;
  maxAge: number;
} {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    // Primary CSRF protection through SameSite cookies
    sameSite: isProduction
      ? CSRFProtectionLevel.STRICT
      : CSRFProtectionLevel.LAX,

    // Additional security measures
    secure: isProduction, // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    signed: true, // Integrity protection

    // Domain/path restrictions for additional security
    domain: config.session.domain,
    path: config.session.path,

    // Session timeout
    maxAge: config.session.maxAge,
  };
}

/**
 * Validate CSRF protection configuration
 */
export function validateCSRFProtection(cookieConfig: {
  sameSite?: string;
  secure?: boolean;
  httpOnly?: boolean;
  signed?: boolean;
  domain?: string;
}): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let isValid = true;

  // Check for essential CSRF protection
  if (!cookieConfig.sameSite || cookieConfig.sameSite === 'none') {
    warnings.push(
      'SameSite attribute not set or set to "none" - primary CSRF protection missing'
    );
    isValid = false;
  }

  // Check for production security requirements
  if (process.env.NODE_ENV === 'production') {
    if (!cookieConfig.secure) {
      warnings.push(
        'Secure flag not set in production - cookies may be sent over HTTP'
      );
      isValid = false;
    }

    if (cookieConfig.sameSite !== 'strict') {
      recommendations.push(
        'Consider using "strict" SameSite in production for maximum CSRF protection'
      );
    }
  }

  // Check for additional security measures
  if (!cookieConfig.httpOnly) {
    warnings.push('HttpOnly flag not set - cookies vulnerable to XSS attacks');
    isValid = false;
  }

  if (!cookieConfig.signed) {
    recommendations.push(
      'Consider enabling cookie signing for integrity protection'
    );
  }

  if (!cookieConfig.domain && process.env.NODE_ENV === 'production') {
    recommendations.push(
      'Consider setting cookie domain restriction in production'
    );
  }

  return { isValid, warnings, recommendations };
}

/**
 * Generate CSRF protection documentation
 */
export function generateCSRFProtectionReport(config: AuthConfig): string {
  const csrfConfig = getCSRFProtectionConfig(config);
  const validation = validateCSRFProtection(csrfConfig);

  const report = `
CSRF Protection Analysis Report
==============================

Current Configuration:
- SameSite: ${csrfConfig.sameSite}
- Secure: ${csrfConfig.secure}
- HttpOnly: ${csrfConfig.httpOnly}
- Signed: ${csrfConfig.signed}
- Domain: ${csrfConfig.domain || 'Not set'}
- Path: ${csrfConfig.path || 'Not set'}

Security Status: ${validation.isValid ? '✓ SECURE' : '⚠ NEEDS ATTENTION'}

${
  validation.warnings.length > 0
    ? `
Security Warnings:
${validation.warnings.map((w) => `- ${w}`).join('\n')}
`
    : ''
}

${
  validation.recommendations.length > 0
    ? `
Recommendations:
${validation.recommendations.map((r) => `- ${r}`).join('\n')}
`
    : ''
}

CSRF Protection Strategy:
========================

1. SameSite Cookies (Primary Defense):
   - Prevents browsers from sending cookies with cross-site requests
   - "strict": Maximum protection, blocks all cross-site requests
   - "lax": Balanced protection, allows safe cross-site navigation

2. Secure Flag:
   - Ensures cookies only sent over HTTPS in production
   - Prevents man-in-the-middle attacks

3. HttpOnly Flag:
   - Prevents JavaScript access to cookies
   - Mitigates XSS-based cookie theft

4. Cookie Signing:
   - Ensures cookie integrity with cryptographic signatures
   - Detects tampering attempts

5. Domain/Path Restrictions:
   - Limits cookie scope to specific domains/paths
   - Reduces attack surface

Additional Considerations:
========================

- Double Submit Cookie Pattern: Can be implemented for additional CSRF protection
- CSRF Tokens: Consider implementing for state-changing operations
- Content Security Policy: Additional XSS protection layer
- CORS Configuration: Ensure proper cross-origin request handling
`;

  return report.trim();
}
