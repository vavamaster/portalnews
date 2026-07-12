import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Safelist: classes de cor geradas dinamicamente (bg-${color}-500, text-${color}-700, etc.)
  // Sem isso, Tailwind v4 faz purge e as classes não existem em produção
  // @ts-ignore — safelist existe em Tailwind mas não no tipo Config do TS
  safelist: [
    // Backgrounds
    'bg-red-50', 'bg-red-100', 'bg-red-500', 'bg-red-600', 'bg-red-700',
    'bg-orange-50', 'bg-orange-100', 'bg-orange-500', 'bg-orange-600', 'bg-orange-700',
    'bg-amber-50', 'bg-amber-100', 'bg-amber-500', 'bg-amber-600', 'bg-amber-700',
    'bg-yellow-50', 'bg-yellow-100', 'bg-yellow-500', 'bg-yellow-600', 'bg-yellow-700',
    'bg-lime-50', 'bg-lime-100', 'bg-lime-500', 'bg-lime-600', 'bg-lime-700',
    'bg-green-50', 'bg-green-100', 'bg-green-500', 'bg-green-600', 'bg-green-700',
    'bg-emerald-50', 'bg-emerald-100', 'bg-emerald-500', 'bg-emerald-600', 'bg-emerald-700',
    'bg-teal-50', 'bg-teal-100', 'bg-teal-500', 'bg-teal-600', 'bg-teal-700',
    'bg-cyan-50', 'bg-cyan-100', 'bg-cyan-500', 'bg-cyan-600', 'bg-cyan-700',
    'bg-sky-50', 'bg-sky-100', 'bg-sky-500', 'bg-sky-600', 'bg-sky-700',
    'bg-blue-50', 'bg-blue-100', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700',
    'bg-indigo-50', 'bg-indigo-100', 'bg-indigo-500', 'bg-indigo-600', 'bg-indigo-700',
    'bg-violet-50', 'bg-violet-100', 'bg-violet-500', 'bg-violet-600', 'bg-violet-700',
    'bg-purple-50', 'bg-purple-100', 'bg-purple-500', 'bg-purple-600', 'bg-purple-700',
    'bg-fuchsia-50', 'bg-fuchsia-100', 'bg-fuchsia-500', 'bg-fuchsia-600', 'bg-fuchsia-700',
    'bg-pink-50', 'bg-pink-100', 'bg-pink-500', 'bg-pink-600', 'bg-pink-700',
    'bg-rose-50', 'bg-rose-100', 'bg-rose-500', 'bg-rose-600', 'bg-rose-700',
    'bg-slate-50', 'bg-slate-100', 'bg-slate-500', 'bg-slate-600', 'bg-slate-700',
    'bg-gray-50', 'bg-gray-100', 'bg-gray-500', 'bg-gray-600', 'bg-gray-700',
    'bg-zinc-50', 'bg-zinc-100', 'bg-zinc-500', 'bg-zinc-600', 'bg-zinc-700',
    'bg-neutral-50', 'bg-neutral-100', 'bg-neutral-500', 'bg-neutral-600', 'bg-neutral-700',
    'bg-stone-50', 'bg-stone-100', 'bg-stone-500', 'bg-stone-600', 'bg-stone-700',
    // Text
    'text-red-400', 'text-red-500', 'text-red-600', 'text-red-700',
    'text-orange-400', 'text-orange-500', 'text-orange-600', 'text-orange-700',
    'text-amber-400', 'text-amber-500', 'text-amber-600', 'text-amber-700',
    'text-yellow-400', 'text-yellow-500', 'text-yellow-600', 'text-yellow-700',
    'text-lime-400', 'text-lime-500', 'text-lime-600', 'text-lime-700',
    'text-green-400', 'text-green-500', 'text-green-600', 'text-green-700',
    'text-emerald-400', 'text-emerald-500', 'text-emerald-600', 'text-emerald-700',
    'text-teal-400', 'text-teal-500', 'text-teal-600', 'text-teal-700',
    'text-cyan-400', 'text-cyan-500', 'text-cyan-600', 'text-cyan-700',
    'text-sky-400', 'text-sky-500', 'text-sky-600', 'text-sky-700',
    'text-blue-400', 'text-blue-500', 'text-blue-600', 'text-blue-700',
    'text-indigo-400', 'text-indigo-500', 'text-indigo-600', 'text-indigo-700',
    'text-violet-400', 'text-violet-500', 'text-violet-600', 'text-violet-700',
    'text-purple-400', 'text-purple-500', 'text-purple-600', 'text-purple-700',
    'text-fuchsia-400', 'text-fuchsia-500', 'text-fuchsia-600', 'text-fuchsia-700',
    'text-pink-400', 'text-pink-500', 'text-pink-600', 'text-pink-700',
    'text-rose-400', 'text-rose-500', 'text-rose-600', 'text-rose-700',
    'text-slate-400', 'text-slate-500', 'text-slate-600', 'text-slate-700',
    'text-gray-400', 'text-gray-500', 'text-gray-600', 'text-gray-700',
    'text-zinc-400', 'text-zinc-500', 'text-zinc-600', 'text-zinc-700',
    'text-neutral-400', 'text-neutral-500', 'text-neutral-600', 'text-neutral-700',
    'text-stone-400', 'text-stone-500', 'text-stone-600', 'text-stone-700',
    // Borders
    'border-red-200', 'border-red-300', 'border-red-500',
    'border-orange-200', 'border-orange-300', 'border-orange-500',
    'border-amber-200', 'border-amber-300', 'border-amber-500',
    'border-yellow-200', 'border-yellow-300', 'border-yellow-500',
    'border-lime-200', 'border-lime-300', 'border-lime-500',
    'border-green-200', 'border-green-300', 'border-green-500',
    'border-emerald-200', 'border-emerald-300', 'border-emerald-500',
    'border-teal-200', 'border-teal-300', 'border-teal-500',
    'border-cyan-200', 'border-cyan-300', 'border-cyan-500',
    'border-sky-200', 'border-sky-300', 'border-sky-500',
    'border-blue-200', 'border-blue-300', 'border-blue-500',
    'border-indigo-200', 'border-indigo-300', 'border-indigo-500',
    'border-violet-200', 'border-violet-300', 'border-violet-500',
    'border-purple-200', 'border-purple-300', 'border-purple-500',
    'border-fuchsia-200', 'border-fuchsia-300', 'border-fuchsia-500',
    'border-pink-200', 'border-pink-300', 'border-pink-500',
    'border-rose-200', 'border-rose-300', 'border-rose-500',
    'border-slate-200', 'border-slate-300', 'border-slate-500',
    'border-gray-200', 'border-gray-300', 'border-gray-500',
    'border-zinc-200', 'border-zinc-300', 'border-zinc-500',
    'border-neutral-200', 'border-neutral-300', 'border-neutral-500',
    'border-stone-200', 'border-stone-300', 'border-stone-500',
    // Rings
    'ring-red-300', 'ring-amber-300', 'ring-emerald-300', 'ring-blue-300',
    'ring-purple-300', 'ring-zinc-300', 'ring-slate-300', 'ring-green-300',
    'ring-orange-300', 'ring-yellow-300', 'ring-lime-300', 'ring-teal-300',
    'ring-cyan-300', 'ring-sky-300', 'ring-indigo-300', 'ring-violet-300',
    'ring-fuchsia-300', 'ring-pink-300', 'ring-rose-300', 'ring-gray-300',
    'ring-neutral-300', 'ring-stone-300',
  ],
  theme: {
        extend: {
                colors: {
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        }
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                }
        }
  },
  plugins: [tailwindcssAnimate],
};
export default config;
