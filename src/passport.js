import { Passport } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { callbackify } from 'util';
import SessionStrategy from './auth/SessionStrategy';

// Like callbackify, but spreads the resulting array across multiple callback arguments.
function callbackify2(fn) {
  return (...args) => {
    const cb = args.pop();
    fn(...args).then((result) => {
      cb(null, ...result);
    }, (err) => {
      cb(err);
    });
  };
}

export default function configurePassport(uw, options) {
  const passport = new Passport();

  async function localLogin(email, password) {
    const { token, user } = await uw.sessions.createSession({
      type: 'local',
      email,
      password,
    });

    return [user, { token }];
  }

  async function socialLogin(accessToken, refreshToken, profile) {
    const { token, user } = await uw.sessions.createSession({
      type: profile.provider,
      profile,
    });

    return [user, { token }];
  }

  async function serializeUser(token) {
    return { token: token.toString('base64') };
  }

  passport.use('local', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    session: false,
  }, callbackify2(localLogin)));

  if (options.auth && options.auth.google) {
    passport.use('google', new GoogleStrategy({
      callbackURL: '/auth/service/google/callback',
      ...options.auth.google,
      scope: ['profile'],
    }, callbackify2(socialLogin)));
  }

  // Replace default session strategy.
  passport.unuse('session');
  passport.use('session', new SessionStrategy(token =>
    uw.sessions.getSecureUser(Buffer.from(token, 'base64'))));

  // Deserialization is done by the SessionStrategy, so we do not need to register
  // a deserialization function here.
  passport.serializeUser(callbackify(serializeUser));

  passport.supports = strategy =>
    passport._strategy(strategy) !== undefined; // eslint-disable-line no-underscore-dangle
  passport.strategies = () =>
    Object.keys(passport._strategies) // eslint-disable-line no-underscore-dangle
      .filter(strategy => strategy !== 'session' && strategy !== 'jwt');

  return passport;
}
