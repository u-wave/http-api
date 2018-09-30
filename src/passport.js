import { Passport } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { callbackify } from 'util';
import createDebug from 'debug';
import JWTStrategy from './auth/JWTStrategy';
import schema from './auth/schema';

const debug = createDebug('uwave:http-api:passport');

export default function configurePassport(uw, options) {
  uw.config.register('http-api:auth', schema);

  const passport = new Passport();

  async function localLogin(email, password) {
    return uw.users.login({ type: 'local', email, password });
  }

  async function socialLogin(accessToken, refreshToken, profile) {
    return uw.users.login({
      type: profile.provider,
      profile,
    });
  }

  async function serializeUser(user) {
    return user.id;
  }
  async function deserializeUser(id) {
    return uw.getUser(id);
  }

  async function configureSocialAuth() {
    const options = await uw.config.get('http-api:auth');
    if (!options) return;

    if (options.google && options.google.enabled) {
      const googleOptions = {
        callbackURL: '/auth/service/google/callback',
        ...options.google,
        scope: ['profile'],
      };
      delete googleOptions.enabled;
      passport.use('google', new GoogleStrategy(googleOptions, callbackify(socialLogin)));
    } else {
      passport.unuse('google');
    }
  }

  passport.use('local', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    session: false,
  }, callbackify(localLogin)));

  configureSocialAuth().catch((err) => {
    debug('social auth error', err);
  });

  passport.use('jwt', new JWTStrategy(options.secret, user => uw.getUser(user.id)));
  passport.serializeUser(callbackify(serializeUser));
  passport.deserializeUser(callbackify(deserializeUser));

  passport.supports = strategy => (
    passport._strategy(strategy) !== undefined // eslint-disable-line no-underscore-dangle
  );
  passport.strategies = () => (
    Object.keys(passport._strategies) // eslint-disable-line no-underscore-dangle
      .filter(strategy => strategy !== 'session' && strategy !== 'jwt')
  );

  return passport;
}
