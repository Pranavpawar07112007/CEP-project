'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Building2, Clock, ShieldCheck, Trash2, Loader2 } from 'lucide-react';
import SplashScreen from '@/components/splash-screen';
import { updateSocietyStatus, deleteSocietyCompletely } from '@/app/actions/admin';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'pranav07112007@gmail.com';

type Society = {
  id: string;
  name: string;
  status: string;
  admin_email: string | null;
  created_at: string;
};

export default function SuperAdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const { confirm, ConfirmDialogNode } = useConfirmDialog();

  const [societies, setSocieties] = React.useState<Society[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [actionPending, setActionPending] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!loading && (!user || user.email !== SUPER_ADMIN_EMAIL)) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const fetchSocieties = React.useCallback(async () => {
    setFetching(true);
    const { data } = await supabase
      .from('societies')
      .select('*')
      .order('created_at', { ascending: false });
    setSocieties(data || []);
    setFetching(false);
  }, [supabase]);

  React.useEffect(() => {
    if (user?.email === SUPER_ADMIN_EMAIL) fetchSocieties();
  }, [user, fetchSocieties]);

  const handleAction = async (id: string, action: 'ACTIVE' | 'SUSPENDED') => {
    setActionPending(id);
    const result = await updateSocietyStatus(id, action);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else {
      toast({
        title: action === 'ACTIVE' ? '✅ Society Approved' : '⚠️ Society Suspended',
        description: action === 'ACTIVE'
          ? 'The society is now active. Members can access the platform.'
          : 'The society has been suspended.',
      });
      fetchSocieties();
    }
    setActionPending(null);
  };

  const handleSuspendConfirm = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Suspend "${name}"?`,
      description: 'Suspending this society will prevent all members from accessing the platform. You can re-activate it anytime.',
      confirmLabel: 'Suspend Society',
      cancelLabel: 'Keep Active',
      variant: 'warning',
    });
    if (ok) handleAction(id, 'SUSPENDED');
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Permanently Delete "${name}"?`,
      description: 'This will delete ALL society data — every member, bill, complaint, transaction, and document. This action is irreversible and cannot be undone.',
      confirmLabel: 'Yes, Delete Permanently',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    setActionPending(id);
    const result = await deleteSocietyCompletely(id);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else {
      toast({ title: '🗑️ Society Deleted', description: 'The society and all its data have been permanently removed.' });
      fetchSocieties();
    }
    setActionPending(null);
  };

  if (loading || !user || user.email !== SUPER_ADMIN_EMAIL) return <SplashScreen />;

  const pending = societies.filter(s => s.status === 'PENDING');
  const active = societies.filter(s => s.status === 'ACTIVE');
  const suspended = societies.filter(s => s.status === 'SUSPENDED');

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      {ConfirmDialogNode}
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Super Admin Portal</h1>
            <p className="text-muted-foreground">Manage all society registrations across the platform.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending Approval', value: pending.length, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
            { label: 'Active Societies', value: active.length, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'Suspended', value: suspended.length, color: 'text-red-500', bg: 'bg-red-500/10' },
          ].map(stat => (
            <Card key={stat.label} className="bg-card/80 backdrop-blur border-border/50">
              <CardContent className="pt-6">
                <div className={`text-4xl font-bold ${stat.color}`}>{stat.value}</div>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" /> Awaiting Approval
            </h2>
            {pending.map(s => (
              <SocietyCard
                key={s.id}
                society={s}
                onApprove={() => handleAction(s.id, 'ACTIVE')}
                onSuspend={() => handleSuspendConfirm(s.id, s.name)}
                onDelete={() => handleDelete(s.id, s.name)}
                actionPending={actionPending === s.id}
              />
            ))}
          </div>
        )}

        {/* All Societies */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> All Societies
          </h2>
          {fetching && <p className="text-muted-foreground text-sm">Loading...</p>}
          {!fetching && societies.length === 0 && <p className="text-muted-foreground text-sm">No societies registered yet.</p>}
          {societies.filter(s => s.status !== 'PENDING').map(s => (
            <SocietyCard
              key={s.id}
              society={s}
              onApprove={() => handleAction(s.id, 'ACTIVE')}
              onSuspend={() => handleSuspendConfirm(s.id, s.name)}
              onDelete={() => handleDelete(s.id, s.name)}
              actionPending={actionPending === s.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SocietyCard({ society, onApprove, onSuspend, onDelete, actionPending }: {
  society: Society;
  onApprove: () => void;
  onSuspend: () => void;
  onDelete: () => void;
  actionPending: boolean;
}) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    ACTIVE: 'bg-green-500/10 text-green-600 border-green-500/20',
    SUSPENDED: 'bg-red-500/10 text-red-600 border-red-500/20',
  };

  return (
    <Card className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{society.name}</p>
              <p className="text-xs text-muted-foreground">
                {society.admin_email} · {new Date(society.created_at).toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[society.status]}`}>
              {society.status}
            </span>
            {society.status !== 'ACTIVE' && (
              <Button size="sm" onClick={onApprove} disabled={actionPending} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            )}
            {society.status === 'ACTIVE' && (
              <Button size="sm" variant="outline" onClick={onSuspend} disabled={actionPending} className="gap-1.5 border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10">
                <XCircle className="h-4 w-4" /> Suspend
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 h-9 w-9 p-0"
              onClick={onDelete}
              disabled={actionPending}
              title="Delete Society Permanently"
            >
              {actionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
