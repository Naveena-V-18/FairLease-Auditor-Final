"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  LogOut,
  Loader2,
  FileSearch,
  Trash2,
  AlertCircle,
  Clock3,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { signOutWithRefresh } from "@/lib/signout";
import MarkdownReportViewer from "@/components/MarkdownReportViewer";

type LeaseRow = {
  id: string;
  user_id: string;
  filename: string | null;
  fairness_score: number | null;
  created_at: string | null;
  analysis_text: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreBadge(score: number | null) {
  if (typeof score !== "number") {
    return "bg-slate-100 text-slate-500 border border-slate-200";
  }
  if (score >= 75) {
    return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  }
  if (score >= 50) {
    return "bg-amber-50 text-amber-700 border border-amber-100";
  }
  return "bg-red-50 text-red-600 border border-red-100";
}

export default function HistoryPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<LeaseRow[]>([]);
  const [selectedLease, setSelectedLease] = useState<LeaseRow | null>(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!isMounted) return;

      const role = data.user?.user_metadata?.role;
      if (role === "admin") {
        window.location.replace("/admin");
        return;
      }

      if (authError || !data.user) {
        window.location.replace("/");
        return;
      }

      setUserId(data.user.id);
      setUserEmail(data.user.email ?? "");
      setAuthLoading(false);
    };

    void boot();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        window.location.replace("/");
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const loadHistory = async () => {
      setLoading(true);
      setError("");

      const { data, error: dbError } = await supabase
        .from("leases")
        .select("id, user_id, filename, fairness_score, created_at, analysis_text")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (dbError) {
        setRows([]);
        setError(dbError.message || "Unable to load vault history");
      } else {
        setRows((data ?? []) as LeaseRow[]);
      }

      setLoading(false);
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const avgFairness = useMemo(() => {
    const scored = rows.filter((row) => typeof row.fairness_score === "number");
    if (!scored.length) return "0.0";
    const total = scored.reduce((sum, row) => sum + (row.fairness_score ?? 0), 0);
    return (total / scored.length).toFixed(1);
  }, [rows]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOutWithRefresh("/");
  };

  const deleteLease = async (leaseId: string) => {
    if (!userId) return;
    setDeletingId(leaseId);
    setError("");

    const { error: deleteError } = await supabase
      .from("leases")
      .delete()
      .eq("id", leaseId)
      .eq("user_id", userId);

    if (deleteError) {
      setError(deleteError.message || "Could not delete this record");
    } else {
      setRows((prev) => prev.filter((row) => row.id !== leaseId));
      if (selectedLease?.id === leaseId) {
        setSelectedLease(null);
      }
    }

    setDeletingId(null);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#FDFDFD] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </main>
    );
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
            <Link href="/" className="text-slate-500 hover:text-indigo-600 transition-colors">Dashboard</Link>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100">
              <ShieldCheck className="w-4 h-4" /> Vault
            </div>
            <div className="group relative py-2">
              <button
                type="button"
                aria-label="Open account menu"
                className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold cursor-pointer hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 ring-2 ring-white"
              >
                {(userEmail[0] || "U").toUpperCase()}
              </button>
              <div className="absolute right-0 top-full w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-3 hidden group-hover:block group-focus-within:block animate-in fade-in zoom-in-95 duration-200 z-[100]">
                <div className="absolute -top-2 left-0 right-0 h-2 bg-transparent" />
                <div className="px-4 pb-3 mb-2 border-b border-slate-50">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Active Account</p>
                  <p className="text-xs font-bold text-slate-700 truncate mt-1">{userEmail}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-bold transition-colors disabled:opacity-60"
                >
                  {isSigningOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} {isSigningOut ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-10">
        <section className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Vault History</h1>
          <p className="text-slate-500 text-base">Your previously audited lease reports with quick review and cleanup controls.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Total Audits</p>
              <p className="text-4xl font-black text-slate-900 tracking-tight mt-2">{rows.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Average Fairness</p>
              <p className="text-4xl font-black text-slate-900 tracking-tight mt-2">{avgFairness}%</p>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900">Audit Records</h2>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">User Vault</span>
          </div>

          {error ? (
            <div className="px-8 py-4 text-sm text-red-600 border-b border-slate-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.14em]">
                <tr>
                  <th className="text-left px-8 py-4 font-bold">File Name</th>
                  <th className="text-left px-8 py-4 font-bold">Fairness</th>
                  <th className="text-left px-8 py-4 font-bold">Created</th>
                  <th className="text-left px-8 py-4 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="px-8 py-4"><div className="h-4 w-56 bg-slate-100 rounded animate-pulse" /></td>
                      <td className="px-8 py-4"><div className="h-7 w-24 bg-slate-100 rounded-xl animate-pulse" /></td>
                      <td className="px-8 py-4"><div className="h-4 w-40 bg-slate-100 rounded animate-pulse" /></td>
                      <td className="px-8 py-4"><div className="h-9 w-40 bg-slate-100 rounded-xl animate-pulse" /></td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td colSpan={4} className="px-8 py-12 text-slate-400 text-center font-medium">
                      <div className="flex flex-col items-center gap-3">
                        <Clock3 className="w-5 h-5" />
                        No reports in your vault yet.
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-8 py-4 text-slate-800 font-semibold">{row.filename || "Untitled Lease"}</td>
                      <td className="px-8 py-4">
                        <span className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-tight ${scoreBadge(row.fairness_score)}`}>
                          {typeof row.fairness_score === "number" ? `${row.fairness_score}%` : "N/A"}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-slate-500 font-medium">{formatDate(row.created_at)}</td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedLease(row)}
                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                            Review Report
                          </button>
                          <button
                            onClick={() => deleteLease(row.id)}
                            disabled={deletingId === row.id}
                            className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-50 transition-all flex items-center gap-2 disabled:opacity-60"
                          >
                            {deletingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

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
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-[0.2em]">Vault Report</p>
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
