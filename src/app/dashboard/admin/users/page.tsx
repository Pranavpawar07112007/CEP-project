'use client';

import * as React from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle2, XCircle, UserCheck, Clock, Plus, Loader2, 
  Shield, Users, ChevronDown
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createOfflineMember, updateMemberRole } from '@/app/actions/admin';

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

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  flat_number: string | null;
  phone: string | null;
  role: string;
  status: string;
};

type Tab = 'requests' | 'members';

const ROLE_OPTIONS = [
  { value: 'RESIDENT', label: 'Resident', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  { value: 'OWNER', label: 'Owner', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
  { value: 'SECRETARY', label: 'Secretary', color: 'text-orange-600 bg-orange-500/10 border-orange-500/20' },
  { value: 'ADMIN', label: 'Admin', color: 'text-primary bg-primary/10 border-primary/20' },
];

export default function AdminUsersPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  
  const [activeTab, setActiveTab] = React.useState<Tab>('requests');
  const [requests, setRequests] = React.useState<JoinRequest[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [actionPending, setActionPending] = React.useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);
  const [addForm, setAddForm] = React.useState({ firstName: '', lastName: '', flatNumber: '', phone: '', email: '' });

  const isAdmin = profile?.role === 'ADMIN';
  const isAdminOrSecretary = profile?.role === 'ADMIN' || profile?.role === 'SECRETARY';

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

  const fetchMembers = React.useCallback(async () => {
    if (!profile?.society_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, flat_number, phone, role, status')
      .eq('society_id', profile.society_id)
      .eq('status', 'ACTIVE')
      .order('flat_number');
    setMembers(data || []);
  }, [supabase, profile]);

  React.useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  React.useEffect(() => {
    if (activeTab === 'members') {
      fetchMembers();
    }
  }, [activeTab, fetchMembers]);

  const handleAction = async (req: JoinRequest, action: 'APPROVED' | 'REJECTED') => {
    setActionPending(req.id);
    const { error: reqErr } = await supabase
      .from('join_requests')
      .update({ status: action })
      .eq('id', req.id);

    if (reqErr) {
      toast({ variant: 'destructive', title: 'Error', description: reqErr.message });
      setActionPending(null);
      return;
    }

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

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (memberId === profile?.id) {
      toast({ variant: 'destructive', title: 'Cannot change your own role.' });
      return;
    }
    setActionPending(memberId);
    const result = await updateMemberRole(memberId, newRole as any);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else {
      toast({ title: '✅ Role Updated', description: `Member's role has been changed to ${newRole}.` });
      fetchMembers();
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
      if (activeTab === 'members') fetchMembers();
    }
  };

  const getRoleStyle = (role: string) => ROLE_OPTIONS.find(r => r.value === role)?.color || 'text-muted-foreground';

  const tabs = [
    { id: 'requests' as Tab, label: 'Join Requests', badge: pending.length },
    { id: 'members' as Tab, label: 'All Members' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Member Management</h1>
          <p className="text-muted-foreground mt-1">Approve requests, manage roles, and add members.</p>
        </div>
        
        {isAdminOrSecretary && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Member Manually</DialogTitle>
                <DialogDescription>Add a member directly to your ledger without email invitation.</DialogDescription>
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
                  <Label>Placeholder Email (for billing system)</Label>
                  <Input required type="email" placeholder="e.g. flat101@mysociety.com" value={addForm.email} onChange={e => setAddForm(f => ({...f, email: e.target.value}))} />
                </div>
                <Button type="submit" className="w-full" disabled={isAdding}>
                  {isAdding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Member
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.id === 'requests' ? <Clock className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Join Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-5">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2 uppercase tracking-wider">
              <Clock className="h-4 w-4" /> Pending Requests ({pending.length})
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
              <RequestCard
                key={req.id}
                req={req}
                onApprove={() => handleAction(req, 'APPROVED')}
                onReject={() => handleAction(req, 'REJECTED')}
                actionPending={actionPending === req.id}
              />
            ))}
          </div>

          {processed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Previously Processed</h2>
              {processed.map(req => (
                <RequestCard key={req.id} req={req} readOnly />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: All Members */}
      {activeTab === 'members' && (
        <div className="space-y-3">
          {members.length === 0 && (
            <Card className="bg-card/80 backdrop-blur border-dashed">
              <CardContent className="flex flex-col items-center py-10 text-muted-foreground">
                <Users className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No active members yet.</p>
              </CardContent>
            </Card>
          )}
          {members.map(member => (
            <Card key={member.id} className="bg-card/80 backdrop-blur border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{member.first_name} {member.last_name}</p>
                        {member.id === profile?.id && (
                          <Badge variant="outline" className="text-[10px] py-0">You</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Flat: {member.flat_number || 'N/A'}
                        {member.phone && ` · ${member.phone}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getRoleStyle(member.role)}`}>
                      {member.role}
                    </span>
                    {/* Only ADMIN can change roles, and not their own */}
                    {isAdmin && member.id !== profile?.id && (
                      <div className="relative">
                        <select
                          value={member.role}
                          onChange={e => handleRoleChange(member.id, e.target.value)}
                          disabled={actionPending === member.id}
                          className="appearance-none pl-3 pr-7 py-1.5 text-xs rounded-md border border-input bg-background cursor-pointer hover:border-primary transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {ROLE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                        {actionPending === member.id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-sm">{req.first_name} {req.last_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Flat: {req.flat_number} · Phone: {req.phone}
            </p>
            <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleString('en-IN')}</p>
          </div>
          <div className="flex items-center gap-2">
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
