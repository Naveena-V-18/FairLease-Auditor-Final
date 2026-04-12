import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          600: '#2563eb', // Standard hex to avoid parser errors
        },
      },
      // This section overrides the typography plugin's color logic
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#334155',       // slate-700
            '--tw-prose-headings': '#0f172a',   // slate-900
            '--tw-prose-lead': '#475569',       // slate-600
            '--tw-prose-links': '#2563eb',      // blue-600
            '--tw-prose-bold': '#0f172a',       // slate-900
            '--tw-prose-counters': '#64748b',    // slate-500
            '--tw-prose-bullets': '#cbd5e1',     // slate-300
            '--tw-prose-hr': '#e2e8f0',          // slate-200
            '--tw-prose-quotes': '#0f172a',      // slate-900
            '--tw-prose-quote-borders': '#e2e8f0',
            '--tw-prose-captions': '#64748b',
            '--tw-prose-code': '#0f172a',
            '--tw-prose-pre-code': '#e2e8f0',
            '--tw-prose-pre-bg': '#1e293b',      // slate-800
            '--tw-prose-th-borders': '#e2e8f0',
            '--tw-prose-td-borders': '#f1f5f9',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;