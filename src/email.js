import nodemailer from 'nodemailer';

export default function sendEmail(emailAddress, token, options) {
  const smtpOptions = {
    host: 'localhost',
    port: 25,
    debug: true,
    tls: {
      rejectUnauthorized: false,
    },
  };

  // create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport(options.mailTransport || smtpOptions);

  // setup e-mail data with unicode symbols
  const mailOptions = {
    from: options.from,
    to: emailAddress,
    subject: options.subject,
    text: `reset url is: https://welovekpop.club/reset/${token}`,
  };

  // send mail with defined transport object
  return transporter.sendMail(mailOptions)
    .then(() => ({}));
}
