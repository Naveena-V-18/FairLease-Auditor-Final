"use client";

import React from 'react';
import { X, ShieldCheck, ScrollText } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function LegalModal({ isOpen, onClose, title, children }: LegalModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6">
      {/* Glassmorphism Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl">
              {title.includes("Privacy") ? (
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
              ) : (
                <ScrollText className="w-5 h-5 text-indigo-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">FairLease Compliance</p>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-8 overflow-y-auto custom-scrollbar bg-white">
          <div className="prose prose-slate prose-sm max-w-none 
            prose-headings:text-slate-900 prose-headings:font-bold 
            prose-p:text-slate-600 prose-p:leading-relaxed 
            prose-strong:text-indigo-600 prose-strong:font-semibold
            prose-li:text-slate-600">
            {children}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-6 border-t border-slate-50 bg-slate-50/50 flex justify-center">
          <button 
            onClick={onClose}
            className="px-8 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200"
          >
            I Understand
          </button>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}