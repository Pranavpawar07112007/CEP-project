
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import PaymentHistory from '@/components/payment-history';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/theme-toggle';
import SplashScreen from '@/components/splash-screen';

export default function HistoryPage() {
  const { user, loading } = useAuth();
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
    <main className="flex min-h-screen flex-col items-center justify-start p-2 sm:p-4 md:p-8 lg:p-12 bg-background">
      <Card className="w-full max-w-7xl shadow-lg glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className='flex-1'>
              <CardTitle className="font-headline text-2xl sm:text-3xl">
                Aroma Residency - Payment History
              </CardTitle>
              <CardDescription>
                View all past maintenance payment records.
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
                <ThemeToggle />
                <Button asChild variant="outline">
                    <Link href="/">
                        <Home className="mr-2 h-4 w-4" />
                        Back to Tracker
                    </Link>
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PaymentHistory />
        </CardContent>
      </Card>
    </main>
  );
}
