'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuth } from '@/hooks/use-auth';
import SplashScreen from '@/components/splash-screen';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, society, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (loading) return;

    // Not logged in → sign-in
    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Admin who hasn't completed setup → setup page
    // Only redirect if:
    //   1. We have confirmed society data loaded (society is not null/undefined)
    //   2. onboarding_completed is explicitly false (not just falsy/null)
    //   3. Not already on setup page (prevents redirect loop)
    //   4. User is ADMIN role
    if (
      profile?.role === 'ADMIN' &&
      society !== null &&
      society !== undefined &&
      society.onboarding_completed === false &&
      pathname !== '/dashboard/setup'
    ) {
      router.push('/dashboard/setup');
      return;
    }

    // Guard for ADMIN_ONLY mode modules
    if (society?.mode === 'ADMIN_ONLY') {
      const hiddenRoutes = ['/dashboard/complaints', '/dashboard/voting', '/dashboard/notices', '/dashboard/halls'];
      if (hiddenRoutes.some(route => pathname.startsWith(route))) {
        router.push('/dashboard');
        return;
      }
    }
  }, [loading, user, profile, society, pathname, router]);

  if (loading) return <SplashScreen />;
  if (!user) return null;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="h-full px-4 py-6 md:px-8 max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
