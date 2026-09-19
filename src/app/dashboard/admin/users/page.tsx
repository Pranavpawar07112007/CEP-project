'use client';

import * as React from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, UserCheck, Clock, Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createOfflineMember } from '@/app/actions/admin';

type JoinRequest = {
  id: string;
  first_name: string;
  last_name: string;
  flat_number: string;
  phone: string;
  status: string;
  created_at: string;
  user_id: string;
};

export default function AdminUsersPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const [requests, setRequests] = React.useState<JoinRequest[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [actionPending, setActionPending] = React.useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState({ firstName: '', lastName: '', flatNumber: '', phone: '', email: '' });

  const fetchRequests = React.useCallback(async () => {
    if (!profile?.society_id) return;
    setFetching(true);
    const { data } = await supabase
      .from('join_requests')
      .select('*')
      .eq('society_id', profile.society_id)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setFetching(false);
  }, [supabase, profile]);

  React.useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (req: JoinRequest, action: 'APPROVED' | 'REJECTED') => {
    setActionPending(req.id);
    // Update join request status
    const { error: reqErr } = await supabase
      .from('join_requests')
      .update({ status: action })
      .eq('id', req.id);

    if (reqErr) {
      toast({ variant: 'destructive', title: 'Error', description: reqErr.message });
      setActionPending(null);
      return;
    }

    // Update profile status
    const newStatus = action === 'APPROVED' ? 'ACTIVE' : 'REJECTED';
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', req.user_id);

    if (profErr) {
      toast({ variant: 'destructive', title: 'Error updating profile', description: profErr.message });
    } else {
      toast({
        title: action === 'APPROVED' ? '✅ Member Approved' : '❌ Request Rejected',
        description: action === 'APPROVED'
          ? `${req.first_name} can now access the society portal.`
          : `${req.first_name}'s request has been rejected.`,
      });
      fetchRequests();
    }
    setActionPending(null);
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const processed = requests.filter(r => r.status !== 'PENDING');

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    const res = await createOfflineMember(addForm);
    setIsAdding(false);
    if (res.error) {
      toast({ variant: 'destructive', title: 'Error', description: res.error });
    } else {
      toast({ title: 'Success', description: 'Member added successfully.' });
      setIsAddOpen(false);
      setAddForm({ firstName: '', lastName: '', flatNumber: '', phone: '', email: '' });
      fetchRequests();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Member Approvals</h1>
          <p className="text-muted-foreground mt-1">Review and approve member join requests for your society.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Offline Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Member Manually</DialogTitle>
              <DialogDescription>Add a member directly to your ledger. They will not receive a welcome email.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>First Name</Label><Input required value={addForm.firstName} onChange={e => setAddForm(f => ({...f, firstName: e.target.value}))} /></div>
                <div className="space-y-2"><Label>Last Name</Label><Input required value={addForm.lastName} onChange={e => setAddForm(f => ({...f, lastName: e.target.value}))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Flat Number</Label><Input required value={addForm.flatNumber} onChange={e => setAddForm(f => ({...f, flatNumber: e.target.value}))} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={addForm.phone} onChange={e => setAddForm(f => ({...f, phone: e.target.value}))} /></div>
              </div>
              <div className="space-y-2">
                <Label>Placeholder Email (Required for billing system)</Label>
                <Input required type="email" placeholder="e.g. flat101@mysociety.com" value={addForm.email} onChange={e => setAddForm(f => ({...f, email: e.target.value}))} />
              </div>
              <Button type="submit" className="w-full" disabled={isAdding}>
                {isAdding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Member
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
          <Clock className="h-5 w-5" /> Pending Requests ({pending.length})
        </h2>
        {fetching && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!fetching && pending.length === 0 && (
          <Card className="bg-card/80 backdrop-blur border-dashed">
            <CardContent className="flex flex-col items-center py-10 text-muted-foreground">
              <UserCheck className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No pending requests. All caught up!</p>
            </CardContent>
          </Card>
        )}
        {pending.map(req => (
          <RequestCard key={req.id} req={req} onApprove={() => handleAction(req, 'APPROVED')} onReject={() => handleAction(req, 'REJECTED')} actionPending={actionPending === req.id} />
        ))}
      </div>

      {/* Processed */}
      {processed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Previously Processed</h2>
          {processed.map(req => (
            <RequestCard key={req.id} req={req} readOnly />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ req, onApprove, onReject, actionPending, readOnly }: {
  req: JoinRequest;
  onApprove?: () => void;
  onReject?: () => void;
  actionPending?: boolean;
  readOnly?: boolean;
}) {
  const statusStyles: Record<string, string> = {
    PENDING: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20',
    APPROVED: 'text-green-600 bg-green-500/10 border-green-500/20',
    REJECTED: 'text-red-600 bg-red-500/10 border-red-500/20',
  };

  return (
    <Card className="bg-card/80 backdrop-blur border-border/50">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold">{req.first_name} {req.last_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Flat: {req.flat_number} · Phone: {req.phone}</p>
            <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleString('en-IN')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyles[req.status]}`}>
              {req.status}
            </span>
            {!readOnly && req.status === 'PENDING' && (
              <>
                <Button size="sm" onClick={onApprove} disabled={actionPending} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={onReject} disabled={actionPending} className="gap-1.5">
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
