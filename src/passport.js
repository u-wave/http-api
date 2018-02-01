import { Passport } from 'passport';
import local from 'passport-local';
import { callbackify } from 'util';
import bcrypt from 'bcryptjs';
import JWTStrategy from './auth/JWTStrategy';
import { NotFoundError, PasswordError } from './errors';

export default function configurePassport(uw, { secret }) {
  const passport = new Passport();

  async function localLogin(email, password) {
    const Authentication = uw.model('Authentication');

    const auth = await Authentication.findOne({
      email: email.toLowerCase(),
    }).populate('user').exec();
    if (!auth) {
      throw new NotFoundError('No user was found with that email address.');
    }

    const correct = await bcrypt.compare(password, auth.hash);
    if (!correct) {
      throw new PasswordError('That password is incorrect.');
    }

    return auth.user;
  }

  async function serializeUser(user) {
    return user.id;
  }
  async function deserializeUser(id) {
    return uw.getUser(id);
  }

  passport.use('local', new local.Strategy({
    usernameField: 'email',
    passwordField: 'password',
    session: false,
  }, callbackify(localLogin)));
  passport.use('jwt', new JWTStrategy(secret, user => uw.getUser(user.id)));
  passport.serializeUser(callbackify(serializeUser));
  passport.deserializeUser(callbackify(deserializeUser));

  return passport;
}
