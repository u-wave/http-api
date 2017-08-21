import debug from 'debug';
import nodemailer from 'nodemailer';
import EmailError from './errors';

const log = debug('uwave:api:v1:email');

export function sendEmail(emailAddress, token, options) {
  const smtpOptions = {
    host: 'localhost',
    port: 25,
    debug: true,
    tls: {
      rejectUnauthorized: false,
    },
  };

  var mailTransport = null;
  if (options.mailTransport) {
    mailTransport = options.mailTransport;
  } else {
    mailTransport = nodemailer;
  }

  // create reusable transporter object using the default SMTP transport
  const transporter = mailTransport.createTransport(smtpOptions);

  // setup e-mail data with unicode symbols
  const mailOptions = {
    from: options.from,
    to: emailAddress,
    subject: options.subject,
    text: `reset url is: https://welovekpop.club/reset/${token}`,
  };

  // send mail with defined transport object
  return transporter.sendMail(mailOptions)
    .then(() => ({}))
}
