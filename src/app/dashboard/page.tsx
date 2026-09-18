
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, History, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Dashboard from '@/components/dashboard';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/theme-toggle';
import SplashScreen from '@/components/splash-screen';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [user, loading, router]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !user) {
    return <SplashScreen />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-2 sm:p-4 md:p-8 lg:p-12 bg-background">
      <Card className="w-full max-w-7xl shadow-lg card-print glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <CardTitle className="font-headline text-2xl sm:text-3xl">
                Aroma Residency - Dashboard
              </CardTitle>
              <CardDescription>
                An overview of your society's finances.
              </CardDescription>
            </div>
            <div className="flex gap-2 print-hide items-center flex-wrap">
                <ThemeToggle />
                <Button asChild variant="outline">
                    <Link href="/">
                        <Home className="mr-2 h-4 w-4" />
                        Back to Tracker
                    </Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/history">
                        <History className="mr-2 h-4 w-4" />
                        View History
                    </Link>
                </Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Dashboard />
        </CardContent>
      </Card>
    </main>
  );
}
