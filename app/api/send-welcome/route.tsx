import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import WelcomeEmail from '@/emails/WelcomeEmail';
import * as React from 'react';
import { createClient } from '@supabase/supabase-js';
import { createMailTransporter } from '@/lib/mailer';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function readJsonBody(request: Request) {
  const rawBody = await request.text();
  if (!rawBody.trim()) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON payload');
  }
}

function resolveBaseUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl && /^https?:\/\//i.test(configuredUrl)) {
    return configuredUrl.replace(/\/$/, '');
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
  if (host) {
    return `${protocol}://${host}`;
  }

  return 'http://localhost:3000';
}

export async function POST(request: Request) {
  try {
    const bodyPayload = await readJsonBody(request);
    const {
      email,
      userName,
      to,
      recipientEmail,
      recipients: recipientList,
      subject,
      body,
      message,
    } = bodyPayload;

    const messageText = typeof message === 'string' && message.trim().length > 0 ? message : body;
    const hasCustomContent =
      typeof subject === 'string' &&
      subject.trim().length > 0 &&
      typeof messageText === 'string' &&
      messageText.trim().length > 0;

    // 1. Setup Base URL for the "Start Here" button
    // This dynamically points to your landing page
    const baseUrl = resolveBaseUrl(request);

    const { senderEmail, transporter } = createMailTransporter();

    let recipients: string[] = [];

    if (Array.isArray(recipientList) && recipientList.length > 0) {
      recipients = recipientList
        .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
        .filter(isEmail);
    }

    if (hasCustomContent && recipients.length === 0) {
      const recipient = typeof to === 'string' && to.trim().length > 0 ? to : recipientEmail;

      if (typeof recipient !== 'string' || recipient.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'to is required for custom mail' },
          { status: 400 }
        );
      }

      const target = recipient.trim();
      if (target.toUpperCase() === 'ALL') {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (!supabaseUrl) {
            return NextResponse.json(
              { success: false, error: 'NEXT_PUBLIC_SUPABASE_URL is required' },
              { status: 500 }
            );
          }

          const adminClient = createClient(
            supabaseUrl,
            serviceRoleKey
          );

          const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });

          if (usersError) {
            return NextResponse.json(
              { success: false, error: usersError.message },
              { status: 500 }
            );
          }

          recipients = (usersData.users ?? [])
            .map((user) => user.email)
            .filter((mail): mail is string => Boolean(mail));
        } else {
          return NextResponse.json(
            {
              success: false,
              error: 'ALL recipients require a direct recipient list from the admin UI or a service role key',
            },
            { status: 400 }
          );
        }
      } else {
        if (isEmail(target)) {
          recipients = [target];
        } else if (isUuid(target)) {
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (serviceRoleKey) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            if (!supabaseUrl) {
              return NextResponse.json(
                { success: false, error: 'NEXT_PUBLIC_SUPABASE_URL is required' },
                { status: 500 }
              );
            }

            const adminClient = createClient(
              supabaseUrl,
              serviceRoleKey
            );

            const { data: userById, error: userByIdError } = await adminClient.auth.admin.getUserById(target);
            if (!userByIdError && userById?.user?.email) {
              recipients = [userById.user.email];
            }

            if (recipients.length === 0) {
              const { data: profileById } = await adminClient
                .from('profiles')
                .select('email')
                .eq('id', target)
                .maybeSingle();
              if (profileById?.email) {
                recipients = [profileById.email];
              }
            }
          }

          if (recipients.length === 0) {
            return NextResponse.json(
              { success: false, error: 'Could not resolve email for this user ID' },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json(
            { success: false, error: 'Recipient must be a valid email, user ID, or ALL' },
            { status: 400 }
          );
        }
      }
    } else {
      if (!email) {
        return NextResponse.json(
          { success: false, error: 'Email is required' },
          { status: 400 }
        );
      }
      recipients = [email];
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No recipients available for this request' },
        { status: 400 }
      );
    }

    const emailHtml = hasCustomContent
      ? `
        <div style="font-family: Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; background: #ffffff;">
          <h2 style="margin: 0 0 14px; color: #0f172a; font-size: 24px; font-weight: 800;">${escapeHtml(subject.trim())}</h2>
          <div style="color: #475569; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(messageText.trim())}</div>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">FairLease Auditor Communication</p>
        </div>
      `
      : await render(
          <WelcomeEmail userName={userName || 'User'} baseUrl={baseUrl} />
        );

    const resolvedSubject = hasCustomContent
      ? subject.trim()
      : 'Welcome to FairLease Auditor!';

    const plainText = hasCustomContent
      ? messageText.trim()
      : `Welcome to FairLease Auditor, ${userName || 'User'}! Start your first audit at ${baseUrl}`;

    const sendInfos = await Promise.all(
      recipients.map((recipient) =>
        transporter.sendMail({
          from: `"FairLease Auditor" <${senderEmail}>`,
          to: recipient,
          subject: resolvedSubject,
          html: emailHtml,
          text: plainText,
        })
      )
    );

    const accepted = sendInfos.flatMap((info) => (Array.isArray(info.accepted) ? info.accepted.map(String) : []));
    const rejected = sendInfos.flatMap((info) => (Array.isArray(info.rejected) ? info.rejected.map(String) : []));

    if (accepted.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'SMTP did not accept any recipients',
          accepted,
          rejected,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      sentCount: accepted.length,
      rejectedCount: rejected.length,
      accepted,
      rejected,
      message: accepted.length === 1
        ? 'Mail sent to user successfully'
        : `Mail sent to ${accepted.length} users successfully`,
    });
  } catch (error) {
    console.error("Welcome Email Error:", error);
    if ((error as Error).message === 'Invalid JSON payload') {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || 'Mail dispatch failed' },
      { status: 500 }
    );
  }
}