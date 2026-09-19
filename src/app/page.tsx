'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Building2, ShieldCheck, CreditCard, ChevronRight, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Navbar */}
      <header className="relative z-10 container mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight">Society SaaS</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/sign-in">
            <Button variant="ghost" className="font-semibold">Sign In</Button>
          </Link>
          <Link href="/sign-up" className="hidden sm:inline-block">
            <Button className="font-semibold">Register Society</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10 pb-20 mt-12 md:mt-0">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Next-Gen Society Management
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-tight">
          Manage your society <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">
            without the headache.
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
          The all-in-one platform for residential complexes. Automate maintenance billing, resolve complaints, run digital elections, and bring your community together.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link href="/sign-up" className="w-full sm:w-auto">
            <Button size="lg" className="w-full h-14 px-8 text-lg font-semibold gap-2 shadow-xl shadow-primary/20">
              Get Started for Free <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/sign-in" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full h-14 px-8 text-lg font-semibold bg-background/50 backdrop-blur">
              Member Login
            </Button>
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full text-left">
          {[
            { icon: CreditCard, title: 'Smart Maintenance', desc: 'Automated billing, Razorpay integration, and instant verifiable e-receipts.' },
            { icon: ShieldCheck, title: 'Admin Controls', desc: 'Powerful ledger tracking, member role management, and detailed financial reports.' },
            { icon: Building2, title: 'Community Tools', desc: 'Complaint tracking, digital voting, notice boards, and a built-in property tracker.' },
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="p-6 rounded-2xl bg-card/60 backdrop-blur border border-border/50 hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
