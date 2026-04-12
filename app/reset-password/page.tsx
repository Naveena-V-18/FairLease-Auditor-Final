"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lock, ShieldCheck, Check, Eye, EyeOff, 
  ArrowRight, Loader2, PartyPopper 
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'editing' | 'success'>('editing');
  const [error, setError] = useState("");
  const router = useRouter();

  const strengthRequirements = useMemo(() => [
    { label: "10+ Characters", met: password.length >= 10 },
    { label: "Case Mix (Aa)", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "Numbers & Symbols", met: /\d/.test(password) && /[^A-Za-z0-9]/.test(password) },
    { label: "Match Confirmed", met: password === confirmPassword && confirmPassword !== "" },
  ], [password, confirmPassword]);

  const strengthScore = strengthRequirements.filter(req => req.met).length;

  const handleUpdatePassword = async (e: React.FormEvent) => {
  e.preventDefault();
  if (strengthScore < 4) return;

  setLoading(true);
  setError("");

  try {
    // 1. CAPTURE EMAIL FIRST (Before the session potentially clears)
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const userEmail = currentUser?.email;

    if (!userEmail) {
      throw new Error("Authentication session expired. Please request a new reset link.");
    }

    // 2. Update the password in Supabase
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;
    
    // 3. Trigger the alert using the email we captured in Step 1
    await fetch('/api/send-security-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail }),
    });

    setStatus('success');
    
    // Professional delay
    setTimeout(() => {
      router.push('/'); 
    }, 3000);

  } catch (err: any) {
    console.error("Reset Flow Error:", err.message);
    setError(err.message);
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] bg-white p-10 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-slate-100"
      >
        <AnimatePresence mode="wait">
          {status === 'editing' ? (
            <motion.div key="form" exit={{ opacity: 0, scale: 0.95 }}>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100 mb-6">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-[28px] font-extrabold text-slate-900 leading-tight">Secure Your Vault</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">Create a high-strength password for your account.</p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all outline-none text-[15px] font-medium"
                    placeholder="New Security Key"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <input
                  type="password"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 outline-none text-[15px] font-medium"
                  placeholder="Confirm Security Key"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex gap-1.5 mb-3">
                    {[1, 2, 3, 4].map((s) => (
                      <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${s <= strengthScore ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {strengthRequirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${req.met ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                          {req.met && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                        </div>
                        <span className={`text-[11px] font-bold ${req.met ? 'text-slate-700' : 'text-slate-400'}`}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  disabled={loading || strengthScore < 4}
                  className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold text-[16px] hover:bg-indigo-700 shadow-md disabled:opacity-50 flex justify-center items-center group transition-all"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                    <span className="flex items-center gap-2">
                      Update & Access Vault <ArrowRight className="w-4 h-4 group-hover:translate-x-1" />
                    </span>
                  )}
                </button>

                {error && <p className="text-red-500 text-xs font-bold text-center mt-4">{error}</p>}
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <PartyPopper className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Vault Secured!</h2>
              <p className="text-slate-500 font-medium mb-8 uppercase text-[10px] tracking-[0.2em]">Password successfully updated</p>
              <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Entering Dashboard...
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}