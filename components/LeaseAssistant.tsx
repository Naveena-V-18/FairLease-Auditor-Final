"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, SendHorizonal, ShieldCheck, Sparkles, X } from "lucide-react";

type AssistantMode = "general" | "lease";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  confidence?: "high" | "medium" | "low";
  usedEvidence?: string[];
  actions?: string[];
};

type AssistantResponseData = {
  mode: AssistantMode;
  answer: string;
  confidence: "high" | "medium" | "low";
  used_evidence: string[];
  actions: string[];
  disclaimer: string;
};

type LeaseAssistantProps = {
  auditContext?: Record<string, unknown> | null;
  canUseLeaseMode?: boolean;
};

const quickPrompts = [
  "Explain my score in simple words",
  "Show evidence for my top risk",
  "Draft a message to negotiate risky clauses",
  "Simulate if deposit is reduced to two months",
  "What should I fix before signing this lease?",
];

function AssistantAvatar() {
  return (
    <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 p-[2px] shadow-lg shadow-indigo-300/30">
      <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white">
        <ShieldCheck className="h-5 w-5 text-indigo-600" />
      </div>
      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
    </div>
  );
}

export default function LeaseAssistant({ auditContext = null, canUseLeaseMode = false }: LeaseAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isIntroVisible, setIsIntroVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I am FairLease Ally. I can answer general questions and, when an audit is available, help you explain risks, draft negotiation messages, and plan next steps.",
      confidence: "high",
      usedEvidence: [],
      actions: ["Explain my score", "Draft negotiation message", "Build pre-sign checklist"],
    },
  ]);
  const [disclaimer, setDisclaimer] = useState(
    "This is decision support, not a substitute for professional legal advice."
  );

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const resolvedMode: AssistantMode = canUseLeaseMode && auditContext ? "lease" : "general";

  const chatHistory = useMemo(
    () =>
      messages.slice(-6).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const openAssistant = () => {
    setIsOpen(true);
    if (!window.localStorage.getItem("fairlease_assistant_seen_intro")) {
      setIsIntroVisible(true);
      window.localStorage.setItem("fairlease_assistant_seen_intro", "true");
    }
  };

  const pushAssistantMessage = (data: AssistantResponseData) => {
    setDisclaimer(data.disclaimer || disclaimer);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.answer,
        confidence: data.confidence,
        usedEvidence: data.used_evidence,
        actions: data.actions,
      },
    ]);
  };

  const submitMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setIsSending(true);

    try {
      const response = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          mode: resolvedMode,
          auditContext: resolvedMode === "lease" ? auditContext : null,
          history: chatHistory,
        }),
      });

      const rawBody = await response.text();
      let payload: any = null;
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        payload = {};
      }

      if (!response.ok || payload?.success === false || !payload?.data) {
        pushAssistantMessage({
          mode: resolvedMode,
          answer:
            "I could not process that right now. Please try again in a moment. If this continues, refresh the page and retry.",
          confidence: "low",
          used_evidence: [],
          actions: ["Retry", "Ask a shorter question"],
          disclaimer,
        });
        return;
      }

      pushAssistantMessage(payload.data as AssistantResponseData);
    } catch {
      pushAssistantMessage({
        mode: resolvedMode,
        answer: "Network issue while contacting assistant service. Please check your connection and retry.",
        confidence: "low",
        used_evidence: [],
        actions: ["Retry", "Refresh page"],
        disclaimer,
      });
    } finally {
      setIsSending(false);
    }
  };

  const isLeaseReady = resolvedMode === "lease";

  return (
    <>
      <button
        type="button"
        onClick={openAssistant}
        className="fixed bottom-5 right-5 z-[130] flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white/95 px-3 py-2 shadow-xl shadow-indigo-200/40 backdrop-blur-md transition-all hover:scale-[1.02] md:bottom-7 md:right-7"
        aria-label="Open FairLease assistant"
      >
        <AssistantAvatar />
        <div className="hidden pr-2 text-left sm:block">
          <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">FairLease Ally</p>
          <p className="text-xs font-semibold text-slate-600">Ask Anything</p>
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[140] flex items-end justify-end bg-slate-900/35 p-0 backdrop-blur-[2px] md:items-end md:p-6">
          <div className="flex h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl md:h-[720px] md:max-h-[88vh] md:w-[430px] md:rounded-[30px]">
            <div className="relative border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3">
                <AssistantAvatar />
                <div>
                  <p className="text-sm font-black tracking-tight text-slate-900">FairLease Ally</p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500">
                    {isLeaseReady ? "Lease-Aware Mode" : "General Mode"}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {isLeaseReady
                  ? "I can explain risk logic, draft negotiation messages, and suggest practical next steps."
                  : "I can answer general questions. Upload and audit a lease to unlock context-aware support."}
              </p>
            </div>

            <div ref={scrollerRef} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-slate-50/40 px-4 py-4">
              {isIntroVisible && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm">
                  <p className="mb-2 flex items-center gap-2 font-black text-indigo-700">
                    <Sparkles className="h-4 w-4" /> Welcome to FairLease Ally
                  </p>
                  <p className="text-xs leading-relaxed text-indigo-700/90">
                    Ask in natural language. I can switch between general chat and lease decision support automatically.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsIntroVisible(false)}
                    className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
                  >
                    Start Chat
                  </button>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {message.role === "assistant" && message.confidence && (
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Confidence: {message.confidence}
                      </p>
                    )}

                    {message.role === "assistant" && (message.usedEvidence?.length ?? 0) > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.usedEvidence?.slice(0, 3).map((evidence, chipIndex) => (
                          <span
                            key={`${chipIndex}-${evidence}`}
                            className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600"
                          >
                            {evidence}
                          </span>
                        ))}
                      </div>
                    )}

                    {message.role === "assistant" && (message.actions?.length ?? 0) > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions?.slice(0, 3).map((action, actionIndex) => (
                          <button
                            key={`${actionIndex}-${action}`}
                            type="button"
                            onClick={() => submitMessage(action)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-100"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {!isSending && messages.length <= 2 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Quick Start</p>
                  <div className="flex flex-wrap gap-2">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => submitMessage(prompt)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isSending && (
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 bg-white p-3">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitMessage(inputValue);
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitMessage(inputValue);
                    }
                  }}
                  rows={1}
                  className="max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  placeholder={isLeaseReady ? "Ask about your lease or negotiation..." : "Ask anything..."}
                />
                <button
                  type="submit"
                  disabled={isSending || inputValue.trim().length === 0}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                </button>
              </form>
              <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-slate-400">
                <Bot className="h-3 w-3" /> {disclaimer}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}