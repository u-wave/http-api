import debug from 'debug';
import nodemailer from 'nodemailer';
import EmailError from './errors';

const log = debug('uwave:api:v1:email');

export function sendEmail(emailAddress, subject, token) {
  const smtpOptions = {
    host: 'localhost',
    port: 25,
    debug: true,
    tls: {
    rejectUnauthorized: false
    }
  };

  // create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport(smtpOptions);

  // setup e-mail data with unicode symbols
  const mailOptions = {
    from: '"welovekpop u-wave" <noreply@welovekpop.club>',
    to: emailAddress,
    subject: subject,
    text: 'token is: ' + token
  };

  // send mail with defined transport object
  return transporter.sendMail(mailOptions);
}
