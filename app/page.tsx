"use client";

import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle2, Loader2, AlertCircle, 
  ShieldCheck, Download, LogOut, Eye, Scale, 
  ArrowRight, FileSearch, Shield, FileCheck, Gavel
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { supabase } from '@/lib/supabase'; 
import Auth from '@/components/Auth';
import jsPDF from 'jspdf';
import { signOutWithRefresh } from '@/lib/signout';
import ProductStoryCards from '@/components/ProductStoryCards';

// Helper to get API URL - uses NEXT_PUBLIC_API_URL for local dev, relative paths for Vercel
const getApiUrl = (endpoint: string): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`;
  }
  return endpoint; // Use relative path for Vercel
};

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [modalMode, setModalMode] = useState<'login' | 'signup'>('login');
  const [legalContent, setLegalContent] = useState<{title: string, isOpen: boolean} | null>(null);
  const [view, setView] = useState<'home' | 'privacy' | 'terms' | 'admin'>('home');
  const ADMIN_EMAIL = "fairlease.auditor@gmail.com";
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'rejected' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const role = session?.user?.user_metadata?.role;
      if (role === 'admin') {
        window.location.href = '/admin';
        return;
      }
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const role = session?.user?.user_metadata?.role;
      if (role === 'admin') {
        window.location.href = '/admin';
        return;
      }
      setSession(session);
      if (session) setShowAuthModal(false); 
    });
    return () => subscription.unsubscribe();
  }, []);

const openAuth = (mode: 'login' | 'signup') => {
  setModalMode(mode); // Sets whether it's login or signup
  setShowAuthModal(true); // Opens the overlay
};

  const handleProtectedAction = (action: () => void) => {
    if (session) {
      action();
    } else {
      openAuth('login'); 
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    handleProtectedAction(() => {
      setFile(acceptedFiles[0]);
      setStatus('idle');
      setResult(null);
    });
  };

  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop, 
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    noClick: !session 
  });
  const sendAuditEmail = async (analysisData: any, sourceFileName: string) => {
    if (!session?.user?.email) return;

    try {
      // Extract a simple name from email (e.g., 'naveen' from 'naveen@gmail.com')
      const extractedName = session.user.email.split('@')[0];
      const capitalizedName = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);

      await fetch('/api/send-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session.user.email,
          userName: capitalizedName,
          score: analysisData.score,
          verdict: analysisData.verdict,
          analysis: analysisData.analysis,
          fileName: sourceFileName,
        }),
      });
      console.log("Audit result email sent to user.");
    } catch (error) {
      console.error("Failed to trigger audit email:", error);
    }
  };

  const handleUpload = async () => {
    if (!file || !session) return;
    
    setStatus('processing');
    const steps = [
      "Establishing Encrypted Connection...",
      "Executing Document Validation...",
      "Analyzing Regulatory Compliance...",
      "Generating Risk Assessment Report..."
    ];

    for (const step of steps) {
      setStatusMessage(step);
      await new Promise(r => setTimeout(r, 800)); 
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(getApiUrl('/api/upload-lease'), {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();

      if (data.status === 'rejected' || data.status === 'invalid') {
        setResult({
          rejection_reason: data.rejection_reason,
          explanation: data.explanation,
          detected_as: data.detected_as
        });
        setStatus('rejected');
        return;
      }

      // Replace everything from setResult down to setStatus('success') with this:
      // Replace your existing mapping with this "Safe Map"
const auditResults = {
  score: data.score || 0,
  verdict: data.verdict || "UNCERTAIN",
  theme: data.theme || "Standard",
  risks: data.risks || [],
  // This line is the most common fail point:
  analysis: data.explanation || data.analysis || "No analysis provided by engine.", 
  summary: data.summary || {}
};

      setResult(auditResults);

      await supabase.from('leases').insert([{ 
        filename: file.name, 
        analysis_text: data.explanation,
        fairness_score: data.score, 
        user_id: session.user.id
      }]);

      // --- NEW: TRIGGER THE EMAIL ---
      await sendAuditEmail(auditResults, file.name);
      // ------------------------------

      setStatus('success');
    } catch (error) {
      setStatus('error');
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOutWithRefresh('/');
  };

  const downloadReport = () => {
    if (!result || !file) return;
    setIsDownloading(true);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const timestamp = new Date().toLocaleString();

    const safe = (val: any) => val !== undefined && val !== null ? String(val) : "N/A";

    const formatCurrency = (val: any) => {
      if (!val) return "N/A";
      return `Rs. ${Number(val).toLocaleString("en-IN")}`;
    };

    const cleanText = (text: string) => {
      if (!text) return "";
      return text
        .replace(/[#*_`>-]/g, "")
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/\n+/g, "\n")
        .replace(/\s{2,}/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/(\d)([A-Za-z])/g, "$1 $2")
        .replace(/([A-Za-z])(\d)/g, "$1 $2")
        .trim();
    };

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("FAIRLEASE AUDITOR", 20, 22);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("PROFESSIONAL LEASE COMPLIANCE AUDIT", 20, 32);
    doc.text(`REF: ${file.name.toUpperCase()}`, pageWidth - 20, 22, { align: "right" });
    doc.text(`ISSUED: ${timestamp}`, pageWidth - 20, 32, { align: "right" });

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 50, pageWidth - 40, 40, 3, 3, "F");

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("FAIRNESS INDEX", 35, 65);

    const scoreColor = result.score > 70 ? [5, 150, 105] : [220, 38, 38];
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.setFontSize(32);
    doc.text(`${result.score}%`, 35, 80);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text("OFFICIAL VERDICT", 110, 65);
    doc.setFontSize(16);
    doc.text(safe(result.verdict).toUpperCase(), 110, 80);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("LEASE DETAILS", 20, 105);

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 108, pageWidth - 20, 108);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("LESSOR:", 20, 118);
    doc.text("LESSEE:", 110, 118);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(safe(result.summary?.lessor), 45, 118);
    doc.text(safe(result.summary?.lessee), 135, 118);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("MONTHLY RENT:", 20, 128);
    doc.text("SECURITY DEPOSIT:", 110, 128);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(result.summary?.rent), 55, 128);
    doc.text(formatCurrency(result.summary?.deposit), 150, 128);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ANALYSIS FINDINGS", 20, 145);
    doc.line(20, 148, pageWidth - 20, 148);

    let y = 160;
    const cleaned = cleanText(result.analysis);
    const sections = cleaned.split(/\d+\.\s+/);

    sections.forEach((section: string, index: number) => {
      if (!section.trim()) return;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const title = index === 0 ? "Lease Agreement Audit Report" : `${index}. ${section.split(":")[0].slice(0, 50)}`;
      doc.text(title, 20, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const body = section.replace(title, "").trim();
      const lines = doc.splitTextToSize(body, pageWidth - 40);
      lines.forEach((line: string) => {
        doc.text(line, 20, y);
        y += 6;
        if (y > pageHeight - 20) { doc.addPage(); y = 20; }
      });
      y += 4;
    });

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This AI-audited report aligns with residential lease practices. For informational use only.", pageWidth / 2, pageHeight - 15, { align: "center" });
    doc.save(`FairLease_Audit_${file.name.replace(".pdf", "")}.pdf`);
    setIsDownloading(false);
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-slate-400" /></div>;

  return (
    <main className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans antialiased relative flex flex-col">
 {/* AUTH MODAL OVERLAY */}
{showAuthModal && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
    
    {/* 1. Main Responsive Container */}
    <div className="relative w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
      
      {/* 2. PINNED CLOSE BUTTON 
          We move it inside the card but keep it absolute so it stays at the top 
      */}
      <button 
        onClick={() => setShowAuthModal(false)}
        className="absolute top-4 right-4 z-[120] p-2 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-slate-200 text-slate-400 hover:text-slate-900 transition-all active:scale-90"
        aria-label="Close"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* 3. SCROLLABLE CONTENT CARD */}
      <div className="bg-white rounded-[32px] shadow-2xl overflow-y-auto custom-scrollbar border border-slate-100">
        <Auth 
          initialMode={modalMode} 
          onNavigate={(targetView: 'privacy' | 'terms') => {
            setView(targetView);
            setShowAuthModal(false);
          }} 
        />
      </div>
      
    </div>
  </div>
)}

      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setStatus('idle')}>
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Shield className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">FairLease<span className="text-indigo-600">Auditor</span></span>
          </div>
          
          <div className="flex gap-6 items-center text-sm font-semibold">
            {session ? (
  <div className="flex items-center gap-6">
    <Link href="/history" className="text-slate-500 hover:text-indigo-600 transition-colors font-medium text-sm">
      Vault
    </Link>
    {/* PROFILE DROPDOWN */}
<div className="group relative py-2"> {/* Added py-2 here to create a bridge */}
  <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold cursor-pointer hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 ring-2 ring-white">
    {session.user.email?.[0].toUpperCase()}
  </div>

  {/* Added 'pt-2' to the container and 'top-full' to align it perfectly */}
  <div className="absolute right-0 top-full w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-3 hidden group-hover:block animate-in fade-in zoom-in-95 duration-200 z-[100]">
    {/* This invisible div acts as a physical bridge so the menu doesn't disappear */}
    <div className="absolute -top-2 left-0 right-0 h-2 bg-transparent" />
    
    <div className="px-4 pb-3 mb-2 border-b border-slate-50">
      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Active Account</p>
      <p className="text-xs font-bold text-slate-700 truncate mt-1">{session.user.email}</p>
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
) : (
              <>
                <button 
  onClick={() => openAuth('login')} 
  className="text-slate-500 hover:text-indigo-600 transition-colors font-medium text-sm"
>
  Log in
</button>

<button 
  onClick={() => openAuth('signup')} 
  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-semibold text-sm active:scale-95"
>
  Sign up free
</button>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16 flex-1 w-full">
        {view === 'privacy' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => setView('home')} className="text-indigo-600 font-bold text-sm flex items-center gap-2 hover:underline">
              ← Back to Auditor
            </button>
            <h1 className="text-4xl font-black text-slate-900 leading-tight">Privacy <span className="text-indigo-600">Policy</span></h1>
            <div className="prose prose-slate max-w-none bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900">Data Isolation & Security</h3>
              <p>Your lease documents are encrypted using AES-256 standards. We operate on a <strong>Zero-Knowledge</strong> basis: your data is isolated and never used to train our AI models.</p>
              <h3 className="font-bold text-slate-900">Permanent Deletion</h3>
              <p>You maintain full control. You can delete your audit history permanently from the Vault at any time, which triggers a secure wipe from our cloud storage.</p>
            </div>
          </div>
        )}

        {view === 'terms' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => setView('home')} className="text-indigo-600 font-bold text-sm flex items-center gap-2 hover:underline">
              ← Back to Auditor
            </button>
            <h1 className="text-4xl font-black text-slate-900 leading-tight">Terms of <span className="text-indigo-600">Service</span></h1>
            <div className="prose prose-slate max-w-none bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900">AI Audit Disclaimer</h3>
              <p>FairLease Auditor provides automated analysis for negotiation support. This is <strong>not</strong> professional legal advice. Users should consult with a qualified attorney for official legal proceedings.</p>
              <h3 className="font-bold text-slate-900">Regional Compliance</h3>
              <p>Our scoring engine aligns with standard housing regulations, including the TN Regulation of Rights and Responsibilities of Landlords and Tenants Act, 2017.</p>
            </div>
          </div>
        )}

        {view === 'home' && (
          <>
            {status === 'idle' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                  <h2 className="text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                    Precision Engine for <br />
                    <span className="text-indigo-600">Rental Agreement Auditing</span>
                  </h2>
                  <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                    Identify predatory clauses and regulatory risks with our specialized document intelligence system.
                  </p>
                </div>

                <div 
                  onClick={() => handleProtectedAction(() => {})} 
                  className="group relative"
                >
                  <div {...getRootProps()} className="bg-white border border-slate-200 rounded-3xl p-20 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 cursor-pointer border-dashed">
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
                        <Upload className="w-7 h-7 text-indigo-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">
                        {file ? file.name : "Upload Lease Document"}
                      </h3>
                      <p className="text-sm text-slate-400 mt-2">Drag and drop or click to browse (PDF only)</p>
                      
                      {file && (
                        <button onClick={(e) => { e.stopPropagation(); handleUpload(); }} 
                          className="mt-10 bg-slate-900 text-white px-10 py-3.5 rounded-xl text-sm font-bold hover:bg-indigo-600 transition-all flex items-center gap-2">
                          Start Professional Audit <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {[
                    { icon: <FileCheck />, label: "Clause Extraction", desc: "Automated legal metadata parsing" },
                    { icon: <Gavel />, label: "Compliance Check", desc: "Regional regulation matching" },
                    { icon: <ShieldCheck />, label: "Risk Mitigation", desc: "Direct negotiation suggestions" }
                  ].map((item, idx) => (
                    <div key={idx} className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <div className="text-indigo-600 w-5 h-5 mb-3">{item.icon}</div>
                      <h4 className="font-bold text-slate-900 text-sm">{item.label}</h4>
                      <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <ProductStoryCards />
              </div>
            )}

            {status === 'processing' && (
              <div className="py-32 text-center space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-center">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-indigo-200" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-900 font-bold text-lg">{statusMessage}</p>
                  <p className="text-slate-400 text-sm">Our AI is processing legal structures within your document...</p>
                </div>
              </div>
            )}

            {status === 'rejected' && result && (
              <div className="max-w-2xl mx-auto py-20 animate-in fade-in zoom-in duration-500">
                <div className="bg-white border border-red-100 rounded-[2.5rem] p-12 text-center shadow-xl shadow-red-50/50 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-50 rounded-full blur-3xl opacity-50" />
                  <div className="relative z-10 space-y-6">
                    <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-100">
                      <AlertCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Audit Blocked</h2>
                      <p className="text-red-500 font-bold text-xs uppercase tracking-[0.2em]">
                        {result.detected_as || "Unrecognized Document"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-6 text-left border border-slate-100">
                      <p className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide">System Reason:</p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {result.explanation || "Document determined to be outside of audit scope."}
                      </p>
                    </div>
                    <button onClick={() => { setStatus('idle'); setFile(null); }} className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100">
                      Try Valid Lease PDF
                    </button>
                  </div>
                </div>
              </div>
            )}

            {status === 'success' && result && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-700">
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl shadow-indigo-100 relative overflow-hidden">
                    <div className="relative z-10">
                      <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300">Fairness Index</label>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-6xl font-black tracking-tighter">{result.score}%</span>
                      </div>
                      <div className="mt-6 flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full transition-all duration-1000" 
                            style={{ width: `${result.score}%` }}></div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-indigo-200 mt-4 uppercase flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                        Verdict: {result.verdict}
                      </div>
                    </div>
                    <Scale className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 rotate-12" />
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" /> Identified Constraints
                    </h4>
                    <div className="space-y-5">
                      {result.risks?.length > 0 ? result.risks.map((risk: any, i: number) => (
                        <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                          <div className="mt-1 w-1 h-1 rounded-full bg-red-400 shrink-0 group-hover:scale-150 transition-transform" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-tight">{risk.issue}</p>
                            <p className="text-[11px] text-slate-500 leading-normal mt-1">{risk.reason}</p>
                          </div>
                        </div>
                      )) : (
                        <p className="text-xs text-slate-400 italic">No significant risks identified.</p>
                      )}
                    </div>
                  </div>

                  <button onClick={downloadReport} className="w-full bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-all hover:border-slate-300">
                    <Download className="w-4 h-4 text-slate-600"/>
                    <span className="text-sm font-bold text-slate-700">Download Formal Audit PDF</span>
                  </button>
                </div>

                <div className="lg:col-span-8">
                  <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[800px]">
                    <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileSearch className="w-4 h-4" /> Comprehensive Analysis
                      </span>
                      <button onClick={() => setStatus('idle')} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-4 py-2 rounded-lg">New Audit</button>
                    </div>
                    <div className="p-12 prose prose-slate prose-sm max-w-none 
                        prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900
                        prose-p:text-slate-600 prose-p:leading-relaxed
                        prose-strong:text-slate-900 prose-strong:font-bold
                        prose-blockquote:border-l-2 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-50/50 prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:rounded-r-xl">
                      <ReactMarkdown>{result.analysis}</ReactMarkdown>
                    </div>
                    
                    <div className="mt-auto p-10 bg-slate-50 border-t border-slate-100">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${result.verdict === 'SAFE' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {result.verdict === 'SAFE' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm">Official AI Recommendation</h5>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {result.verdict === "SAFE" 
                              ? "This agreement follows standard housing guidelines with minimal tenant liability risk." 
                              : "Critical deviations from standard tenant protection acts were found. We advise negotiation."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )} 
      </div>

      <footer className="mt-auto bg-slate-900 border-t border-slate-800 text-slate-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[12px] font-semibold tracking-wide">
          <p>FairLease Auditor © 2026 | Engineering Excellence.</p>
          <a href="mailto:fairlease.auditor@gmail.com" className="text-indigo-300 hover:text-indigo-200 transition-colors">
            Contact: fairlease.auditor@gmail.com
          </a>
        </div>
      </footer>
    </main>
  );
}