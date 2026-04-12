"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, Mail, Lock, ShieldCheck, 
  Check, Eye, EyeOff, ArrowRight, ShieldAlert 
} from "lucide-react";

interface AuthProps {
  initialMode?: 'login' | 'signup';
  onNavigate?: (view: 'privacy' | 'terms') => void;
}

export default function Auth({ initialMode = 'login', onNavigate }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [message, setMessage] = useState("");

  // 1. LISTEN FOR AUTH CHANGES (Critical for Google Redirect Success)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const role = session.user?.user_metadata?.role
        window.location.href = role === 'admin' ? '/admin' : '/'
      }
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync state if the prop changes
  useEffect(() => {
    setIsSignUp(initialMode === 'signup');
  }, [initialMode]);

  const strengthRequirements = useMemo(() => [
    { label: "10+ Characters", met: password.length >= 10 },
    { label: "Case Mix (Aa)", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "Numbers & Symbols", met: /\d/.test(password) && /[^A-Za-z0-9]/.test(password) },
    { label: "Match Confirmed", met: isSignUp ? (password === confirmPassword && confirmPassword !== "") : true },
  ], [password, confirmPassword, isSignUp]);

  const strengthScore = strengthRequirements.filter(req => req.met).length;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignUp) {
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
        });

        if (error) throw error;
        if (data?.user) {
          const extractedName = email.split('@')[0];
          const capitalizedName = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);

          await fetch('/api/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              userName: capitalizedName,
            }),
          });

          setMessage("Verification email sent! Check your inbox.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. GOOGLE SIGN IN (Pointing to our new callback)
  const signInWithGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        }
      }
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setMessage("Please enter your email address first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMessage(error ? error.message : "Recovery link sent to your inbox.");
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-[420px] bg-white p-8 md:p-10 rounded-[2.5rem] flex flex-col items-stretch"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100 mb-6">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-[28px] font-extrabold text-slate-900 leading-tight tracking-tight">
          {isSignUp ? "Join the Vault" : "Welcome Back"}
        </h2>
        <p className="text-slate-500 text-sm mt-2 font-medium">
          {isSignUp ? "Start your professional lease audit today." : "Access your secure lease history."}
        </p>
      </div>

      <button 
        onClick={signInWithGoogle}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98] text-[14px] disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957a8.991 8.991 0 0 0 0 8.088l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.956L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </>
        )}
      </button>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
        <span className="relative bg-white px-4 text-[10px] uppercase font-bold text-slate-300 tracking-[0.2em] mx-auto block w-fit">OR</span>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div className="relative group">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="email"
            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all outline-none text-[15px]"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="relative group">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type={showPassword ? "text" : "password"}
            className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all outline-none text-[15px]"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {!isSignUp && (
          <div className="flex justify-end px-1">
            <button type="button" onClick={handleResetPassword} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest transition-colors">
              Forgot password?
            </button>
          </div>
        )}

        <AnimatePresence>
          {isSignUp && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden pt-1">
              <input
                type="password"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all outline-none text-[15px]"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
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
                      <span className={`text-[10px] font-bold uppercase tracking-tight ${req.met ? 'text-slate-700' : 'text-slate-400'}`}>{req.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          disabled={loading || (isSignUp && strengthScore < 4)}
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-[15px] hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 flex justify-center items-center group active:scale-[0.98]"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
            <span className="flex items-center gap-2">
              {isSignUp ? "Create Vault" : "Log In"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          )}
        </button>
      </form>

      {message && (
        <div className={`mt-6 p-4 rounded-xl text-[11px] font-bold flex items-start gap-3 border leading-relaxed ${message.toLowerCase().includes('sent') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      <div className="mt-8 text-center pt-6 border-t border-slate-50">
        <button onClick={() => setIsSignUp(!isSignUp)} className="text-[13px] font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          {isSignUp ? "Already secured? " : "New to FairLease? "}
          <span className="text-indigo-600 ml-1">{isSignUp ? "Log In" : "Sign up free"}</span>
        </button>
      </div>
    </motion.div>
  );
}