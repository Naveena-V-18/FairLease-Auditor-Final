import { NextResponse } from 'next/server';

type AssistantMode = 'general' | 'lease';

type AssistantRequestBody = {
  message?: string;
  mode?: AssistantMode;
  auditContext?: Record<string, unknown> | null;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

type AssistantPayload = {
  mode: AssistantMode;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  used_evidence: string[];
  actions: string[];
  disclaimer: string;
};

const DEFAULT_DISCLAIMER = 'This is decision support, not a substitute for professional legal advice.';

async function readJsonBody(request: Request): Promise<AssistantRequestBody> {
  const rawBody = await request.text();
  if (!rawBody.trim()) return {};

  try {
    return JSON.parse(rawBody) as AssistantRequestBody;
  } catch {
    throw new Error('Invalid JSON payload');
  }
}

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function toAssistantMode(mode: unknown): AssistantMode {
  return mode === 'lease' ? 'lease' : 'general';
}

function detectMode(message: string, hasAuditContext: boolean): AssistantMode {
  if (!hasAuditContext) return 'general';
  const query = message.toLowerCase();
  const leaseKeywords = [
    'lease',
    'agreement',
    'rent',
    'deposit',
    'notice',
    'lock',
    'clause',
    'score',
    'risk',
    'eviction',
    'landlord',
    'tenant',
    'negotiat',
    'refund',
  ];
  return leaseKeywords.some((keyword) => query.includes(keyword)) ? 'lease' : 'general';
}

function sanitizeHistory(history: AssistantRequestBody['history']) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: safeString(item.content).slice(0, 1200),
    }));
}

function buildSystemPrompt(mode: AssistantMode) {
  if (mode === 'lease') {
    return [
      'You are FairLease Assistant, a lease decision-support copilot.',
      'Use provided audit context only. Do not invent user facts.',
      'If evidence is missing, explicitly say: Not enough document evidence.',
      'Prioritize actionable outputs: negotiation text, next steps, checklist items.',
      'Never provide final legal advice. Always include the legal disclaimer.',
      'Return JSON only with keys: mode, answer, confidence, used_evidence, actions, disclaimer.',
      'confidence must be one of high, medium, low.',
      'used_evidence must be an array of short strings from context.',
      'actions must be an array of practical next steps.',
      'Keep tone professional, supportive, concise.',
    ].join(' ');
  }

  return [
    'You are FairLease Assistant.',
    'Answer general user questions clearly and briefly.',
    'Do not claim personal data you do not have.',
    'If asked personal facts like age, say you do not have that information unless user provides it.',
    'If user asks lease help, suggest switching to lease guidance mode.',
    'Return JSON only with keys: mode, answer, confidence, used_evidence, actions, disclaimer.',
  ].join(' ');
}

function fallbackPayload(mode: AssistantMode, message: string): AssistantPayload {
  const query = message.toLowerCase();

  if (mode === 'general' && query.includes('my age')) {
    return {
      mode,
      answer: 'I do not have your personal age unless you share it. If you want, I can help with your lease questions now.',
      confidence: 'high',
      used_evidence: [],
      actions: ['Ask a lease question', 'Open lease guidance mode'],
      disclaimer: DEFAULT_DISCLAIMER,
    };
  }

  return {
    mode,
    answer:
      mode === 'lease'
        ? 'I can help with lease risks, negotiation drafts, and what-if checks. Please share a specific clause or ask what to improve first.'
        : 'I can answer general questions and also help with lease decisions when you share an audit context.',
    confidence: 'medium',
    used_evidence: [],
    actions:
      mode === 'lease'
        ? ['Explain highest risk', 'Draft landlord negotiation message', 'Build pre-sign checklist']
        : ['Ask a general question', 'Switch to lease assistance'],
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

function normalizePayload(payload: unknown, mode: AssistantMode, message: string): AssistantPayload {
  if (!payload || typeof payload !== 'object') {
    return fallbackPayload(mode, message);
  }

  const item = payload as Record<string, unknown>;
  const confidenceRaw = safeString(item.confidence, 'medium').toLowerCase();
  const confidence = confidenceRaw === 'high' || confidenceRaw === 'low' ? confidenceRaw : 'medium';

  const usedEvidence = Array.isArray(item.used_evidence)
    ? item.used_evidence.filter((entry): entry is string => typeof entry === 'string').slice(0, 5)
    : [];
  const actions = Array.isArray(item.actions)
    ? item.actions.filter((entry): entry is string => typeof entry === 'string').slice(0, 5)
    : [];

  return {
    mode: toAssistantMode(item.mode) || mode,
    answer: safeString(item.answer, fallbackPayload(mode, message).answer),
    confidence,
    used_evidence: usedEvidence,
    actions,
    disclaimer: safeString(item.disclaimer, DEFAULT_DISCLAIMER),
  };
}

function pickModelFromEnv() {
  return process.env.OPENROUTER_ASSISTANT_MODEL || 'google/gemini-2.0-flash-001';
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const message = safeString(body.message).trim();

    if (!message) {
      return NextResponse.json({ success: false, error: 'message is required' }, { status: 400 });
    }

    const hasAuditContext = Boolean(body.auditContext && typeof body.auditContext === 'object');
    const requestedMode = toAssistantMode(body.mode);
    const effectiveMode = requestedMode === 'lease' || requestedMode === 'general' ? requestedMode : detectMode(message, hasAuditContext);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      const fallback = fallbackPayload(effectiveMode, message);
      return NextResponse.json({ success: true, data: fallback, provider: 'fallback-no-key' });
    }

    const historyMessages = sanitizeHistory(body.history).map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));

    const contextPayload =
      effectiveMode === 'lease' && hasAuditContext
        ? JSON.stringify(body.auditContext, null, 2).slice(0, 7000)
        : 'No lease audit context was provided.';

    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt(effectiveMode),
      },
      {
        role: 'user',
        content: `Current lease context:\n${contextPayload}`,
      },
      ...historyMessages,
      {
        role: 'user',
        content: message,
      },
    ];

    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
    const siteUrl = `${protocol}://${host}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || siteUrl,
        'X-Title': process.env.OPENROUTER_APP_TITLE || 'FairLease Assistant',
      },
      body: JSON.stringify({
        model: pickModelFromEnv(),
        response_format: { type: 'json_object' },
        temperature: 0.3,
        messages,
      }),
    });

    const rawBody = await response.text();

    if (!response.ok) {
      const fallback = fallbackPayload(effectiveMode, message);
      return NextResponse.json(
        {
          success: true,
          data: fallback,
          provider: 'fallback-api-error',
          modelError: rawBody.slice(0, 400),
        },
        { status: 200 }
      );
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      const fallback = fallbackPayload(effectiveMode, message);
      return NextResponse.json({ success: true, data: fallback, provider: 'fallback-raw-non-json' });
    }

    const content = safeString(parsed?.choices && Array.isArray(parsed.choices)
      ? ((parsed.choices[0] as Record<string, unknown>)?.message as Record<string, unknown>)?.content
      : '');

    let modelPayload: unknown = null;
    try {
      modelPayload = content ? JSON.parse(content) : null;
    } catch {
      modelPayload = null;
    }

    const normalized = normalizePayload(modelPayload, effectiveMode, message);

    return NextResponse.json({
      success: true,
      data: normalized,
      provider: 'openrouter',
      mode: effectiveMode,
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'Invalid JSON payload') {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        data: fallbackPayload('general', ''),
        provider: 'fallback-exception',
      },
      { status: 200 }
    );
  }
}