import passport from 'passport';
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptions,
} from 'passport-jwt';
import { AuthConfig } from '../config.js';
import { JwtPayload } from '../jwt.js';

export type JwtAuthCallback = (
  payload: JwtPayload
) => Promise<{ id: string; email: string } | null>;

/**
 * Configure JWT authentication strategy
 */
export function configureJwtStrategy(
  config: AuthConfig,
  callback: JwtAuthCallback
): void {
  const options: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: config.jwt.secret,
    issuer: config.jwt.issuer,
    algorithms: ['HS256'],
  };

  passport.use(
    new JwtStrategy(options, async (payload: JwtPayload, done) => {
      try {
        const user = await callback(payload);
        if (user) {
          done(null, user);
        } else {
          done(null, false);
        }
      } catch (error) {
        done(error, false);
      }
    })
  );
}
