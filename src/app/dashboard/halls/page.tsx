'use client';

import * as React from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, CalendarDays, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { createHallAllocation, updateHallAllocation } from '@/app/actions/modules';

type Allocation = {
  id: string;
  event_name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  attendees: number;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  user_id: string;
};

export default function HallsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const [allocations, setAllocations] = React.useState<Allocation[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [actionPending, setActionPending] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ event_name: '', description: '', start_time: '', end_time: '', attendees: '' });
  const [rejectionReasons, setRejectionReasons] = React.useState<Record<string, string>>({});

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SECRETARY';

  const fetchAllocations = React.useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    const query = supabase.from('hall_allocations').select('*');
    if (!isAdmin) {
      query.eq('user_id', profile.id);
    } else {
      query.eq('society_id', profile.society_id);
    }
    const { data } = await query.order('start_time', { ascending: true });
    setAllocations(data || []);
    setFetching(false);
  }, [supabase, profile, isAdmin]);

  React.useEffect(() => { fetchAllocations(); }, [fetchAllocations]);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createHallAllocation({
        society_id: profile?.society_id!,
        event_name: form.event_name,
        description: form.description,
        start_time: form.start_time,
        end_time: form.end_time,
        attendees: parseInt(form.attendees) || 0,
      });
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '✅ Request Submitted', description: 'Secretary will review your request.' });
        setForm({ event_name: '', description: '', start_time: '', end_time: '', attendees: '' });
        setShowForm(false);
        fetchAllocations();
      }
    });
  };

  const handleApprove = async (id: string) => {
    setActionPending(id);
    const result = await updateHallAllocation(id, { status: 'APPROVED' });
    if (!result.error) toast({ title: '✅ Hall Booking Approved' });
    fetchAllocations();
    setActionPending(null);
  };

  const handleReject = async (id: string) => {
    setActionPending(id);
    const result = await updateHallAllocation(id, { status: 'REJECTED', rejection_reason: rejectionReasons[id] || '' });
    if (!result.error) toast({ title: '❌ Booking Rejected' });
    fetchAllocations();
    setActionPending(null);
  };

  const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    PENDING: { color: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20', icon: Clock },
    APPROVED: { color: 'text-green-600 bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
    REJECTED: { color: 'text-red-600 bg-red-500/10 border-red-500/20', icon: XCircle },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hall Allocation</h1>
          <p className="text-muted-foreground mt-1">Apply for community hall booking for your events.</p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            {showForm ? 'Cancel' : 'Apply for Hall'}
          </Button>
        )}
      </div>

      {showForm && !isAdmin && (
        <Card className="bg-card/80 backdrop-blur border-primary/30 animate-fade-in">
          <CardHeader>
            <CardTitle>Community Hall Booking Request</CardTitle>
            <CardDescription>The secretary will verify availability and approve or reject your request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event Name</Label>
                <Input value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} placeholder="e.g. Birthday Celebration" className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Expected Attendees</Label>
                <Input type="number" value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} placeholder="25" className="bg-background/50" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date & Time</Label>
                <Input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>End Date & Time</Label>
                <Input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="bg-background/50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Event Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the event..." rows={3} className="bg-background/50 resize-none" />
            </div>
            <Button onClick={handleSubmit} disabled={!form.event_name || !form.start_time || !form.end_time || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Request
            </Button>
          </CardContent>
        </Card>
      )}

      {fetching && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!fetching && allocations.length === 0 && (
        <Card className="bg-card/80 backdrop-blur border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <CalendarDays className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">No bookings yet</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {allocations.map(a => {
          const cfg = statusConfig[a.status];
          const Icon = cfg.icon;
          return (
            <Card key={a.id} className="bg-card/80 backdrop-blur border-border/50">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{a.event_name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>🕐 {new Date(a.start_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      <span>→</span>
                      <span>{new Date(a.end_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      <span>· {a.attendees} attendees</span>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" /> {a.status}
                  </span>
                </div>

                {a.rejection_reason && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-sm text-red-600">
                    <span className="font-semibold">Rejection Reason: </span>{a.rejection_reason}
                  </div>
                )}

                {isAdmin && a.status === 'PENDING' && (
                  <div className="pt-2 border-t space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rejection reason (optional)</Label>
                      <Input
                        value={rejectionReasons[a.id] || ''}
                        onChange={e => setRejectionReasons(r => ({ ...r, [a.id]: e.target.value }))}
                        placeholder="e.g. Hall already booked for maintenance"
                        className="bg-background/50 h-8 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(a.id)} disabled={actionPending === a.id}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(a.id)} disabled={actionPending === a.id}>
                        <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
