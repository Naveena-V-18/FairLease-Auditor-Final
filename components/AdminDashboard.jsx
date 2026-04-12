"use client";

import { Users, FileText, ShieldAlert, BarChart3, Trash2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  // Mock data for the demo - later we will fetch this from Supabase
  const stats = [
    { label: "Total Users", value: "12", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Leases Audited", value: "48", icon: FileText, iconColor: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Security Flags", value: "2", icon: ShieldAlert, iconColor: "text-amber-600", bg: "bg-amber-50" },
  ];

  const recentActivity = [
    { id: 1, user: "tenant_alpha@gmail.com", action: "Audit Completed", date: "2 mins ago", score: 85 },
    { id: 2, user: "chennai_renter@yahoo.com", action: "New Signup", date: "1 hour ago", score: null },
    { id: 3, user: "admin@fairlease.auditor", action: "System Check", date: "3 hours ago", score: null },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto"
    >
      <header className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Console</h1>
        <p className="text-slate-500 font-medium">Monitoring fairlease.auditor@gmail.com</p>
      </header>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
            <div className={`w-14 h-14 ${stat.bg} rounded-2xl flex items-center justify-center`}>
              <stat.icon className={`w-7 h-7 ${stat.color || 'text-slate-600'}`} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ACTIVITY TABLE */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-900">Recent System Activity</h3>
          <button className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-full transition-all">
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentActivity.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-5 text-sm font-semibold text-slate-700">{item.user}</td>
                  <td className="px-8 py-5">
                    <span className="text-xs font-bold px-3 py-1 bg-slate-100 rounded-full text-slate-600">
                      {item.action}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-400 font-medium">{item.date}</td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ExternalLink size={18} /></button>
                      <button className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}