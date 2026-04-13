import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import AuditResultEmail from '@/emails/AuditResultEmail';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createMailTransporter } from '@/lib/mailer';

type AuditPayload = {
  email: string;
  userName: string;
  score: number;
  verdict: string;
  analysis?: string;
  fileName?: string;
};

async function readJsonBody(request: Request) {
  const rawBody = await request.text();
  if (!rawBody.trim()) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON payload');
  }
}

function cleanInlineMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizePdfText(text: string) {
  return text
    .replace(/₹/g, 'Rs.')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[–—]/g, '-')
    // Keep printable ASCII plus newlines/tabs to avoid WinAnsi encode errors.
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function splitWrappedLines(text: string, maxWidth: number, size: number, widthOf: (s: string, sz: number) => number) {
  const safeText = sanitizePdfText(text);
  const words = safeText.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (widthOf(candidate, size) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

async function generateAuditPdf(payload: AuditPayload) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  let page = pdf.addPage([pageWidth, pageHeight]);

  const margin = 48;
  const width = pageWidth - margin * 2;
  const contentBottom = 56;
  let y = page.getHeight() - 64;

  const ensureSpace = (required = 16) => {
    if (y - required >= contentBottom) return;
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - 64;

    page.drawText('FAIRLEASE AUDIT REPORT', {
      x: margin,
      y,
      size: 12,
      font: bold,
      color: rgb(0.05, 0.09, 0.16),
    });
    y -= 24;
  };

  const drawLine = (
    text: string,
    options?: { size?: number; lineHeight?: number; isBold?: boolean; x?: number; color?: [number, number, number] }
  ) => {
    const size = options?.size ?? 11;
    const lineHeight = options?.lineHeight ?? 16;
    const x = options?.x ?? margin;
    const isBold = options?.isBold ?? false;
    const colorTuple = options?.color ?? [0.2, 0.23, 0.28];

    const safeText = sanitizePdfText(text);
    ensureSpace(lineHeight);
    page.drawText(safeText, {
      x,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(colorTuple[0], colorTuple[1], colorTuple[2]),
    });
    y -= lineHeight;
  };

  const drawWrapped = (
    text: string,
    options?: { size?: number; lineHeight?: number; isBold?: boolean; x?: number; maxWidth?: number; color?: [number, number, number] }
  ) => {
    const size = options?.size ?? 11;
    const lineHeight = options?.lineHeight ?? 16;
    const x = options?.x ?? margin;
    const maxWidth = options?.maxWidth ?? width;
    const isBold = options?.isBold ?? false;
    const fontToUse = isBold ? bold : font;
    const lines = splitWrappedLines(text, maxWidth, size, (s, sz) => fontToUse.widthOfTextAtSize(s, sz));

    for (const line of lines) {
      drawLine(line, {
        size,
        lineHeight,
        isBold,
        x,
        color: options?.color,
      });
    }
  };

  page.drawRectangle({
    x: 0,
    y: page.getHeight() - 86,
    width: page.getWidth(),
    height: 86,
    color: rgb(0.05, 0.09, 0.16),
  });

  page.drawText('FAIRLEASE AUDIT REPORT', {
    x: margin,
    y: page.getHeight() - 42,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });

  y = page.getHeight() - 122;
  drawWrapped(`User: ${payload.userName}`, { size: 12, lineHeight: 18, isBold: true });
  drawWrapped(`Original File: ${payload.fileName ?? 'Lease Document'}`, { size: 11, lineHeight: 16 });
  drawWrapped(`Fairness Score: ${payload.score}%`, { size: 11, lineHeight: 16 });
  drawWrapped(`Verdict: ${payload.verdict}`, { size: 11, lineHeight: 22, isBold: true });

  y -= 4;
  drawLine('Detailed Analysis', { size: 14, lineHeight: 20, isBold: true, color: [0.08, 0.14, 0.24] });
  y -= 2;

  const analysis = sanitizePdfText(payload.analysis || 'No analysis provided.');
  const normalized = analysis
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\s+##\s+/g, '\n## ')
    .replace(/\s+###\s+/g, '\n### ')
    .replace(/\s+\*\s+/g, '\n* ')
    .replace(/\s+\d+\.\s+/g, (m) => `\n${m.trim()} `)
    .trim();
  const lines = normalized.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      y -= 6;
      ensureSpace(0);
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      const level = (line.match(/^#+/)?.[0].length ?? 1);
      const text = cleanInlineMarkdown(line.replace(/^#{1,3}\s+/, ''));
      y -= 2;
      drawWrapped(text, {
        size: level === 1 ? 14 : level === 2 ? 13 : 12,
        lineHeight: 18,
        isBold: true,
        color: [0.08, 0.14, 0.24],
      });
      y -= 2;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const text = cleanInlineMarkdown(line.replace(/^[-*]\s+/, ''));
      const bulletX = margin + 6;
      const textX = margin + 18;
      const bulletWidth = width - 18;

      ensureSpace(16);
      page.drawText('-', {
        x: bulletX,
        y,
        size: 11,
        font,
        color: rgb(0.2, 0.23, 0.28),
      });
      drawWrapped(text, {
        size: 11,
        lineHeight: 16,
        x: textX,
        maxWidth: bulletWidth,
      });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const marker = (line.match(/^\d+\./)?.[0] ?? '1.');
      const text = cleanInlineMarkdown(line.replace(/^\d+\.\s+/, ''));
      const markerX = margin;
      const textX = margin + 22;
      const markerWidth = bold.widthOfTextAtSize(marker, 11);
      const blockWidth = width - 22;

      ensureSpace(16);
      page.drawText(marker, {
        x: markerX,
        y,
        size: 11,
        font: bold,
        color: rgb(0.2, 0.23, 0.28),
      });
      drawWrapped(text, {
        size: 11,
        lineHeight: 16,
        x: textX + Math.min(markerWidth, 12),
        maxWidth: blockWidth,
      });
      continue;
    }

    drawWrapped(cleanInlineMarkdown(line), { size: 11, lineHeight: 16 });
  }

  return Buffer.from(await pdf.save());
}

export async function POST(request: Request) {
  try {
    const payload = (await readJsonBody(request)) as Partial<AuditPayload>;
    const { email, userName, score, verdict } = payload;

    if (!email || !userName || typeof score !== 'number' || !verdict) {
      return NextResponse.json({ success: false, error: 'Invalid audit payload' }, { status: 400 });
    }

    const validatedPayload: AuditPayload = {
      email,
      userName,
      score,
      verdict,
      analysis: typeof payload.analysis === 'string' ? payload.analysis : undefined,
      fileName: typeof payload.fileName === 'string' ? payload.fileName : undefined,
    };

    const pdfBytes = await generateAuditPdf(validatedPayload);

    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') ?? 'http';
    const reportUrl = `${protocol}://${host}/history`;

    const { senderEmail, transporter } = createMailTransporter();

    // 2. Render your React template to HTML
    // Using await ensures the HTML is fully generated before sending
    const emailHtml = await render(
      <AuditResultEmail
        userName={userName}
        score={score}
        verdict={verdict}
        reportUrl={reportUrl}
      />
    );

    // 3. Send the email
    const info = await transporter.sendMail({
      from: `"FairLease Auditor" <${senderEmail}>`,
      to: email,
      subject: `Your Lease Audit Results: ${verdict} (${score}%)`,
      html: emailHtml,
      text: `Hi ${userName}, your lease audit is ready. Score: ${score}%. Verdict: ${verdict}. Download: ${reportUrl}`,
      attachments: [
        {
          filename: 'FairLease_Audit_Report.pdf',
          content: pdfBytes,
          contentType: 'application/pdf',
        },
      ],
    });

    const accepted = Array.isArray(info.accepted) ? info.accepted.map(String) : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected.map(String) : [];

    if (accepted.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'SMTP did not accept recipient',
          accepted,
          rejected,
          envelope: info.envelope,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      accepted,
      rejected,
      messageId: info.messageId,
      envelope: info.envelope,
    });
  } catch (error) {
    console.error("Gmail Send Error:", error);
    if ((error as Error).message === 'Invalid JSON payload') {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}