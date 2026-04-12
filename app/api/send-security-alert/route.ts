import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { createMailTransporter } from '@/lib/mailer';
import { SecurityAlertEmail } from '@/emails/SecurityAlertEmail';
import * as React from 'react';

async function readJsonBody(request: Request) {
  const rawBody = await request.text();
  if (!rawBody.trim()) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON payload');
  }
}

export async function POST(req: Request) {
  try {
    const { email } = (await readJsonBody(req)) as { email?: string };

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const { senderEmail, transporter } = createMailTransporter();
    const html = await render(React.createElement(SecurityAlertEmail));

    const mailOptions = {
      from: `"FairLease Auditor" <${senderEmail}>`,
      to: email,
      subject: 'Security Notification: Password Updated',
      html,
      text: 'Your FairLease Auditor password was successfully updated.',
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true, message: 'Security alert dispatched' });
  } catch (error: any) {
    console.error('Nodemailer Error:', error.message);
    if (error.message === 'Invalid JSON payload') {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}