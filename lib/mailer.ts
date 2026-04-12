import nodemailer from 'nodemailer';

export function createMailTransporter() {
  const senderEmail = process.env.EMAIL_USER;
  const senderPass = process.env.EMAIL_PASS;

  if (!senderEmail || !senderPass) {
    throw new Error('Email credentials are missing in .env.local');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: senderEmail,
      pass: senderPass,
    },
  });

  return { senderEmail, transporter };
}