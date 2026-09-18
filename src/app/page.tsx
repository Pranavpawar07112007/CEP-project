
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import PaymentTracker from '@/components/payment-tracker';
import { History, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/theme-toggle';
import SplashScreen from '@/components/splash-screen';

export default function Home() {
    const { user, signOut, loading } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
        if (!loading && !user) {
            router.push('/sign-in');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <SplashScreen />;
    }

  return (
    <>
    <main className="flex min-h-screen flex-col items-center justify-start p-2 sm:p-4 md:p-8 lg:p-12 bg-background">
      <div className="w-full max-w-5xl mb-4 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2">
        <ThemeToggle />
        <Button asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Button asChild>
          <Link href="/history">
            <History className="mr-2 h-4 w-4" />
            View History
          </Link>
        </Button>
        <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
        </Button>
      </div>
      <PaymentTracker />
    </main>
    </>
  );
}
