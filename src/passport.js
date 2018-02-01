import { Passport } from 'passport';
import local from 'passport-local';
import { callbackify, promisify } from 'util';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import JWTStrategy from './auth/JWTStrategy';
import {
  NotFoundError,
  PasswordError,
  PermissionError,
} from './errors';

const jwtSign = promisify(jwt.sign);

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

    if (await auth.user.isBanned()) {
      throw new PermissionError('You have been banned.');
    }

    const token = await jwtSign(
      { id: auth.user.id },
      secret,
      { expiresIn: '31d' },
    );

    return { user: auth.user, token };
    /* return toItemResponse(auth.user, {
      meta: { jwt: token },
    }); */
  }

  async function serializeUser(user) {
    return user.id;
  }
  async function deserializeUser(id) {
    return uw.getUser(id);
  }

  passport.use('local', new local.Strategy(callbackify(localLogin)));
  passport.use('jwt', new JWTStrategy(secret, user => uw.getUser(user.id)));
  passport.serializeUser(callbackify(serializeUser));
  passport.deserializeUser(callbackify(deserializeUser));

  return passport;
}
