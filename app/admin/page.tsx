"use client";

import { useEffect, useMemo, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  LogOut,
  FileSearch,
  Loader2,
  Mail,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import MarkdownReportViewer from "@/components/MarkdownReportViewer";
import { signOutWithRefresh } from "@/lib/signout";

type LeaseRow = {
  id: string;
  user_id: string;
  filename: string | null;
  fairness_score: number | null;
  created_at: string | null;
  analysis_text: string | null;
};

type UserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function scoreBadge(score: number | null) {
  if (typeof score !== "number") {
    return "bg-slate-100 text-slate-500 border border-slate-200";
  }
  if (score >= 75) {
    return "bg-emerald-50 text-emerald-600 border border-emerald-100";
  }
  if (score >= 50) {
    return "bg-amber-50 text-amber-700 border border-amber-100";
  }
  return "bg-red-50 text-red-600 border border-red-100";
}

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const [loadingLeases, setLoadingLeases] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  const [leaseError, setLeaseError] = useState("");
  const [userError, setUserError] = useState("");

  const [selectedLease, setSelectedLease] = useState<LeaseRow | null>(null);

  const [recipientEmail, setRecipientEmail] = useState("ALL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendingMail, setSendingMail] = useState(false);
  const [mailError, setMailError] = useState("");
  const [mailToast, setMailToast] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const authReady = authChecked && isAdmin;

  useEffect(() => {
    let isMounted = true;

    const checkAdmin = async () => {
      const { data, error } = await supabase.auth.getUser();
      const role = data.user?.user_metadata?.role;

      if (!isMounted) return;

      if (error || !data.user || role !== "admin") {
        setIsAdmin(false);
        setAuthChecked(true);
        return;
      }

      setAdminEmail(data.user.email ?? "");
      setIsAdmin(true);
      setAuthChecked(true);
    };

    void checkAdmin();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    let isMounted = true;

    const loadLeases = async () => {
      setLoadingLeases(true);
      setLeaseError("");
      setLoadingUsers(true);
      setUserError("");

      const { data, error } = await supabase
        .from("leases")
        .select("id, user_id, filename, fairness_score, created_at, analysis_text")
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        setLeaseError(error.message);
        setLeases([]);
        setUsers([]);
        setLoadingUsers(false);
      } else {
        const leaseRows = (data ?? []) as LeaseRow[];
        setLeases(leaseRows);

        setLoadingUsers(false);
      }

      setLoadingLeases(false);
    };

    const loadUsers = async () => {
      setLoadingUsers(true);
      setUserError("");

      const response = await fetch('/api/get-users');
      const payload = await response.json().catch(() => ({}));

      if (!isMounted) return;

      if (!response.ok || !payload?.success) {
        setUsers([]);
        setUserError(payload?.error || 'Unable to fetch users');
      } else {
        setUsers(
          (payload.users ?? []).map((item: any) => ({
            id: item.id,
            email: item.email ?? null,
            created_at: item.lastActive ?? null,
            updated_at: item.lastActive ?? null,
          }))
        );
      }

      setLoadingUsers(false);
    };

    void loadLeases();
    void loadUsers();

    return () => {
      isMounted = false;
    };
  }, [authReady]);

  const totalAudits = leases.length;

  const averageFairness = useMemo(() => {
    const scored = leases.filter((row) => typeof row.fairness_score === "number");
    if (scored.length === 0) return "0.0";
    const total = scored.reduce((sum, row) => sum + (row.fairness_score ?? 0), 0);
    return (total / scored.length).toFixed(1);
  }, [leases]);

  const displayUsers = useMemo(() => {
    if (users.length > 0) return users;

    const fallback = new Map<string, UserRow>();
    for (const lease of leases) {
      if (!lease.user_id) continue;
      if (!fallback.has(lease.user_id)) {
        fallback.set(lease.user_id, {
          id: lease.user_id,
          email: null,
          created_at: lease.created_at,
          updated_at: lease.created_at,
        });
      }
    }

    return Array.from(fallback.values());
  }, [users, leases]);

  const allRecipientEmails = useMemo(
    () => displayUsers.map((user) => user.email).filter((mail): mail is string => Boolean(mail)),
    [displayUsers]
  );

  const normalizedRecipient = recipientEmail.trim();
  const isAllRecipients = normalizedRecipient.toUpperCase() === "ALL";
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipient);
  const isRecipientUid = isUuid(normalizedRecipient);
  const canSendMail =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    ((isAllRecipients && allRecipientEmails.length > 0) || isValidEmail || isRecipientUid);

  const sendCustomMail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMailError("");
    setMailToast("");

    if (!canSendMail) {
      setMailError("Provide Subject, Message, and a valid Recipient (email, user ID, or ALL).");
      return;
    }

    setSendingMail(true);

    try {
      const response = await fetch("/api/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: isAllRecipients ? "ALL" : normalizedRecipient,
          recipients: isAllRecipients ? allRecipientEmails : undefined,
          subject: subject.trim(),
          message: body.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Mail dispatch failed");
      }

      const payload = await response.json().catch(() => ({}));

      if (payload?.success === false) {
        throw new Error(payload?.error || "Mail dispatch failed");
      }

      if (typeof payload?.message === "string" && payload.message.trim().length > 0) {
        setMailToast(payload.message.trim());
      } else if (typeof payload?.sentCount === "number") {
        setMailToast(
          payload.sentCount === 1
            ? "Mail sent to user successfully"
            : `Mail sent to ${payload.sentCount} users successfully`
        );
      } else {
        setMailToast("Mail sent to user successfully");
      }
      setSubject("");
      setBody("");

      window.setTimeout(() => {
        setMailToast("");
      }, 2600);
    } catch (error: any) {
      setMailError(error?.message || "Mail dispatch failed");
    } finally {
      setSendingMail(false);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOutWithRefresh('/');
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-[#FDFDFD] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </main>
    );
  }

  if (!isAdmin) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans antialiased relative">
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Shield className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              FairLease<span className="text-indigo-600">Auditor</span>
            </span>
          </Link>

          <div className="flex gap-6 items-center text-sm font-semibold">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-100">
              <ShieldCheck className="w-4 h-4" /> Admin Console
            </div>
            <div className="group relative py-2">
              <button
                type="button"
                aria-label="Open admin account menu"
                className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold cursor-pointer hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 ring-2 ring-white"
              >
                {(adminEmail[0] || "A").toUpperCase()}
              </button>
              <div className="absolute right-0 top-full w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-3 hidden group-hover:block group-focus-within:block animate-in fade-in zoom-in-95 duration-200 z-[100]">
                <div className="absolute -top-2 left-0 right-0 h-2 bg-transparent" />
                <div className="px-4 pb-3 mb-2 border-b border-slate-50">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Active Admin</p>
                  <p className="text-xs font-bold text-slate-700 truncate mt-1">{adminEmail}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-bold transition-colors disabled:opacity-60"
                >
                  {isSigningOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-10">
        <section className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 text-base">Audit oversight and platform communication controls.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Total Audits</p>
              </div>
              {loadingLeases ? (
                <div className="h-10 w-24 bg-slate-100 rounded-xl animate-pulse" />
              ) : (
                <p className="text-4xl font-black text-slate-900 tracking-tight">{totalAudits}</p>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Average Fairness</p>
              </div>
              {loadingLeases ? (
                <div className="h-10 w-24 bg-slate-100 rounded-xl animate-pulse" />
              ) : (
                <p className="text-4xl font-black text-slate-900 tracking-tight">{averageFairness}%</p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">User List</h2>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Active Identities</span>
          </div>

          {userError ? (
            <div className="px-8 py-3 text-sm text-red-600 border-b border-slate-100">{userError}</div>
          ) : null}

          <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.14em]">
                  <tr>
                    <th className="text-left px-8 py-4 font-bold">UID</th>
                    <th className="text-left px-8 py-4 font-bold">Email</th>
                    <th className="text-left px-8 py-4 font-bold">Last Active</th>
                    <th className="text-left px-8 py-4 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-8 py-4"><div className="h-4 w-52 bg-slate-100 rounded animate-pulse" /></td>
                        <td className="px-8 py-4"><div className="h-4 w-52 bg-slate-100 rounded animate-pulse" /></td>
                        <td className="px-8 py-4"><div className="h-4 w-28 bg-slate-100 rounded animate-pulse" /></td>
                        <td className="px-8 py-4"><div className="h-8 w-24 bg-slate-100 rounded-xl animate-pulse" /></td>
                      </tr>
                    ))
                  ) : displayUsers.length === 0 ? (
                    <tr className="border-t border-slate-100">
                      <td colSpan={4} className="px-8 py-10 text-slate-400 text-center font-medium">
                        No identity records found.
                      </td>
                    </tr>
                  ) : (
                    displayUsers.map((user) => (
                      <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                        <td className="px-8 py-4 text-slate-700 font-medium">{user.id}</td>
                        <td className="px-8 py-4 text-slate-800 font-semibold">{user.email || "Email hidden"}</td>
                        <td className="px-8 py-4 text-slate-500 font-medium">{formatDate(user.created_at || user.updated_at)}</td>
                        <td className="px-8 py-4">
                          <button
                            onClick={() => {
                              if (user.email) {
                                setRecipientEmail(user.email);
                                setMailError("");
                              } else {
                                setMailError("No email found for this user.");
                              }
                            }}
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
                          >
                            Send Mail
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Custom Mailer</h2>
              <p className="text-sm text-slate-500">System-wide custom announcement for all registered users.</p>
            </div>
          </div>

          <form onSubmit={sendCustomMail} className="space-y-4">
            <input
              type="text"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Recipient (email, user ID, or ALL)"
              className="w-full pl-4 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all outline-none text-[15px]"
            />

            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full pl-4 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all outline-none text-[15px]"
            />

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message"
              rows={5}
              className="w-full pl-4 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all outline-none text-[15px] resize-none"
            />

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={!canSendMail || sendingMail}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-[15px] hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 flex justify-center items-center group active:scale-[0.98]"
              >
                {sendingMail ? <Loader2 className="animate-spin w-5 h-5" /> : (
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Send
                  </span>
                )}
              </button>

              {mailError ? (
                <span className="text-red-600 text-sm font-bold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {mailError}
                </span>
              ) : null}
            </div>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">Lease Table</h2>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">All Audits</span>
          </div>

          {leaseError ? (
            <div className="px-8 py-6 text-sm text-red-600">{leaseError}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.14em]">
                  <tr>
                    <th className="text-left px-8 py-4 font-bold">User ID</th>
                    <th className="text-left px-8 py-4 font-bold">File Name</th>
                    <th className="text-left px-8 py-4 font-bold">Fairness</th>
                    <th className="text-left px-8 py-4 font-bold">Created</th>
                    <th className="text-left px-8 py-4 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLeases ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-8 py-4"><div className="h-4 w-40 bg-slate-100 rounded animate-pulse" /></td>
                        <td className="px-8 py-4"><div className="h-4 w-52 bg-slate-100 rounded animate-pulse" /></td>
                        <td className="px-8 py-4"><div className="h-7 w-20 bg-slate-100 rounded-xl animate-pulse" /></td>
                        <td className="px-8 py-4"><div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /></td>
                        <td className="px-8 py-4"><div className="h-9 w-32 bg-slate-100 rounded-xl animate-pulse" /></td>
                      </tr>
                    ))
                  ) : leases.length === 0 ? (
                    <tr className="border-t border-slate-100">
                      <td colSpan={5} className="px-8 py-10 text-slate-400 text-center font-medium">
                        No lease records available.
                      </td>
                    </tr>
                  ) : (
                    leases.map((lease) => (
                      <tr key={lease.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                        <td className="px-8 py-4 text-slate-700 font-medium">{lease.user_id}</td>
                        <td className="px-8 py-4 text-slate-800 font-semibold">{lease.filename || "-"}</td>
                        <td className="px-8 py-4">
                          <span className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-tight ${scoreBadge(lease.fairness_score)}`}>
                            {typeof lease.fairness_score === "number" ? `${lease.fairness_score}%` : "N/A"}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-slate-500 font-medium">{formatDate(lease.created_at)}</td>
                        <td className="px-8 py-4">
                          <button
                            onClick={() => setSelectedLease(lease)}
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                            Review Report
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-100 flex justify-between items-center text-slate-400">
        <p className="text-xs font-bold uppercase tracking-widest">© 2026 FairLease Systems</p>
        <div className="flex gap-8 text-xs font-bold uppercase tracking-widest">
          <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
          <span className="text-slate-300">Admin</span>
        </div>
      </footer>

      {mailToast ? (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-50 border border-emerald-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-2 text-emerald-700 text-sm font-bold">
          <CheckCircle2 className="w-4 h-4" />
          {mailToast}
        </div>
      ) : null}

      {selectedLease && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setSelectedLease(null)}
              className="absolute top-4 right-4 z-[140] p-2 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-slate-200 text-slate-400 hover:text-slate-900 transition-all active:scale-90"
              aria-label="Close report"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="bg-white rounded-[32px] shadow-2xl overflow-y-auto custom-scrollbar border border-slate-100 p-6 md:p-8">
              <div className="mb-5">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-[0.2em]">Lease Audit Report</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{selectedLease.filename || "Untitled Lease"}</h3>
              </div>
              <MarkdownReportViewer content={selectedLease.analysis_text || "No stored analysis available."} compact />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
