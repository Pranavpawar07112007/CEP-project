'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Home, 
  CreditCard, 
  MessageSquare, 
  Vote, 
  ClipboardList, 
  CalendarDays, 
  FileBarChart 
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import SplashScreen from '@/components/splash-screen';
import { ThemeToggle } from '@/components/theme-toggle';

const modules = [
  {
    title: 'Property Tracker',
    description: 'Buy, sell, or rent properties within the society.',
    icon: Home,
    href: '/dashboard/properties',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  {
    title: 'Maintenance Payment',
    description: 'View current and pending bills, generate e-receipts.',
    icon: CreditCard,
    href: '/dashboard/maintenance',
    color: 'text-green-500',
    bg: 'bg-green-500/10'
  },
  {
    title: 'Complaint Box',
    description: 'Submit and track complaints or suggestions.',
    icon: MessageSquare,
    href: '/dashboard/complaints',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10'
  },
  {
    title: 'Voting System',
    description: 'Cast votes for committee positions.',
    icon: Vote,
    href: '/dashboard/voting',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10'
  },
  {
    title: 'Notice Board',
    description: 'Important announcements and event schedules.',
    icon: ClipboardList,
    href: '/dashboard/notices',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10'
  },
  {
    title: 'Hall Allocation',
    description: 'Apply for and manage community hall bookings.',
    icon: CalendarDays,
    href: '/dashboard/halls',
    color: 'text-pink-500',
    bg: 'bg-pink-500/10'
  },
  {
    title: 'Annual Report',
    description: 'Track society expenses and view financial reports.',
    icon: FileBarChart,
    href: '/dashboard/reports',
    color: 'text-teal-500',
    bg: 'bg-teal-500/10'
  }
];

export default function DashboardPage() {
  const { user, loading, profile } = useAuth();
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Welcome back, {profile?.first_name || 'User'}!</h1>
          <p className="text-muted-foreground mt-1">Select a module to manage your society operations.</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
        {modules.map((module, index) => {
          const Icon = module.icon;
          return (
            <Link key={index} href={module.href} className="block group">
              <Card className="h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 glass-card border-border/50 hover:border-primary/50 overflow-hidden relative">
                <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${module.bg.replace('/10', '')}`} />
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${module.bg}`}>
                    <Icon className={`w-6 h-6 ${module.color}`} />
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">{module.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{module.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
