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
  FileBarChart,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import SplashScreen from '@/components/splash-screen';
import { ThemeToggle } from '@/components/theme-toggle';
import { createClient } from '@/utils/supabase/client';
import { updateSocietyBalance } from '@/app/actions/admin';
import { useToast } from '@/hooks/use-toast';

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
    description: 'View bills, track payments, and share e-receipts.',
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
  const { user, loading, profile, society } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SECRETARY';

  const [financials, setFinancials] = React.useState<{
    baseBalance: number;
    totalCollected: number;
    totalExpenses: number;
    netBalance: number;
  } | null>(null);
  const [editingBalance, setEditingBalance] = React.useState(false);
  const [newBalance, setNewBalance] = React.useState('');
  const [savingBalance, setSavingBalance] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [user, loading, router]);

  React.useEffect(() => {
    if (!profile?.society_id || !isAdmin) return;

    const fetchFinancials = async () => {
      const [{ data: bills }, { data: expenses }, { data: societyData }] = await Promise.all([
        supabase.from('maintenance_bills').select('amount, status').eq('society_id', profile.society_id),
        supabase.from('expenses').select('amount').eq('society_id', profile.society_id),
        supabase.from('societies').select('society_balance').eq('id', profile.society_id).single(),
      ]);

      const baseBalance = societyData?.society_balance || 0;
      const totalCollected = (bills || []).filter(b => b.status === 'PAID').reduce((s, b) => s + Number(b.amount), 0);
      const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
      const netBalance = baseBalance + totalCollected - totalExpenses;

      setFinancials({ baseBalance, totalCollected, totalExpenses, netBalance });
    };

    fetchFinancials();
  }, [profile, society, isAdmin, supabase]);

  const handleSaveBalance = async () => {
    setSavingBalance(true);
    const amount = parseFloat(newBalance);
    if (isNaN(amount) || amount < 0) {
      toast({ variant: 'destructive', title: 'Enter a valid amount.' });
      setSavingBalance(false);
      return;
    }
    const result = await updateSocietyBalance(amount);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else {
      toast({ title: '✅ Balance Updated' });
      setEditingBalance(false);
      // Refresh financials
      if (financials) {
        setFinancials({
          ...financials,
          baseBalance: amount,
          netBalance: amount + financials.totalCollected - financials.totalExpenses,
        });
      }
    }
    setSavingBalance(false);
  };

  if (loading || !user) {
    return <SplashScreen />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Welcome back, {profile?.first_name || 'User'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {society?.name || 'Society Management Dashboard'}
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* Society Balance Card — Admin Only */}
      {isAdmin && financials && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Net Balance */}
          <Card className={`sm:col-span-1 bg-card/80 backdrop-blur border-primary/20`}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Society Net Balance</p>
                  <p className={`text-3xl font-bold ${financials.netBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ₹{Math.abs(financials.netBalance).toLocaleString('en-IN')}
                    {financials.netBalance < 0 && <span className="text-sm ml-1 text-red-400">(deficit)</span>}
                  </p>
                </div>
                <div className={`p-2 rounded-full ${financials.netBalance >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  <IndianRupee className={`h-5 w-5 ${financials.netBalance >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </div>
              </div>
              {/* Opening Balance edit */}
              <div className="mt-3 pt-3 border-t border-border/50">
                {editingBalance ? (
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        value={newBalance}
                        onChange={e => setNewBalance(e.target.value)}
                        className="pl-7 h-8 text-sm"
                        autoFocus
                        placeholder={String(financials.baseBalance)}
                      />
                    </div>
                    <Button size="sm" className="h-8 w-8 p-0 bg-green-500 hover:bg-green-600" onClick={handleSaveBalance} disabled={savingBalance}>
                      {savingBalance ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingBalance(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => { setNewBalance(String(financials.baseBalance)); setEditingBalance(true); }}
                  >
                    <Pencil className="h-3 w-3" />
                    Opening: ₹{financials.baseBalance.toLocaleString('en-IN')}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Collected */}
          <Card className="bg-card/80 backdrop-blur border-green-500/20">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Maintenance Collected</p>
                  <p className="text-2xl font-bold text-green-500">+₹{financials.totalCollected.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-2 bg-green-500/10 rounded-full">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Total paid maintenance collected</p>
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card className="bg-card/80 backdrop-blur border-red-500/20">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-500">-₹{financials.totalExpenses.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-2 bg-red-500/10 rounded-full">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">All logged expenses deducted</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
        {modules
          .filter(module => {
            if (society?.mode === 'ADMIN_ONLY') {
              const hiddenInAdminOnly = ['/dashboard/complaints', '/dashboard/voting', '/dashboard/notices', '/dashboard/halls'];
              return !hiddenInAdminOnly.includes(module.href);
            }
            return true;
          })
          .map((module, index) => {
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
