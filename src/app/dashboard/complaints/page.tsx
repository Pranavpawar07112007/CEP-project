'use client';

import * as React from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MessageSquare, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { createComplaint, updateComplaint } from '@/app/actions/modules';

type Complaint = {
  id: string;
  subject: string;
  description: string;
  type: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  user_id: string;
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending', color: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20', icon: AlertCircle },
  RESOLVED: { label: 'Resolved', color: 'text-green-600 bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
};

export default function ComplaintsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const [complaints, setComplaints] = React.useState<Complaint[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [replyPending, setReplyPending] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ subject: '', description: '', type: 'COMPLAINT' });
  const [replies, setReplies] = React.useState<Record<string, string>>({});

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SECRETARY';

  const fetchComplaints = React.useCallback(async () => {
    if (!profile) return;
    setFetching(true);
    const query = supabase.from('complaints').select('*');
    if (!isAdmin) {
      query.eq('user_id', profile.id);
    } else {
      query.eq('society_id', profile.society_id);
    }
    const { data } = await query.order('created_at', { ascending: false });
    setComplaints(data || []);
    setFetching(false);
  }, [supabase, profile, isAdmin]);

  React.useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createComplaint({
        society_id: profile?.society_id!,
        subject: form.subject,
        description: form.description,
        type: form.type,
      });
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '✅ Submitted', description: 'Your complaint/suggestion has been recorded.' });
        setForm({ subject: '', description: '', type: 'COMPLAINT' });
        setShowForm(false);
        fetchComplaints();
      }
    });
  };

  const handleReply = async (id: string, status: string) => {
    setReplyPending(id);
    const result = await updateComplaint(id, { admin_reply: replies[id] || '', status });
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else {
      toast({ title: '✅ Reply Sent' });
      fetchComplaints();
    }
    setReplyPending(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Complaint & Suggestion Box</h1>
          <p className="text-muted-foreground mt-1">Submit and track your complaints or suggestions.</p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            {showForm ? 'Cancel' : 'New Complaint'}
          </Button>
        )}
      </div>

      {showForm && !isAdmin && (
        <Card className="bg-card/80 backdrop-blur border-primary/30 animate-fade-in">
          <CardHeader>
            <CardTitle>Submit a Complaint or Suggestion</CardTitle>
            <CardDescription>This will be reviewed by the society admin or secretary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLAINT">Complaint</SelectItem>
                    <SelectItem value="SUGGESTION">Suggestion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Water Leakage in Stairwell" className="bg-background/50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue in detail..." rows={4} className="bg-background/50 resize-none" />
            </div>
            <Button onClick={handleSubmit} disabled={!form.subject || !form.description || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit
            </Button>
          </CardContent>
        </Card>
      )}

      {fetching && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!fetching && complaints.length === 0 && (
        <Card className="bg-card/80 backdrop-blur border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">No complaints or suggestions yet</p>
            <p className="text-sm">All is well! Use the button above to submit.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {complaints.map(c => {
          const cfg = statusConfig[c.status] || statusConfig.PENDING;
          const Icon = cfg.icon;
          const typeColor = c.type === 'COMPLAINT' ? 'text-red-600 bg-red-500/10 border-red-500/20' : 'text-blue-600 bg-blue-500/10 border-blue-500/20';
          return (
            <Card key={c.id} className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/20 transition-colors">
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{c.subject}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${typeColor}`}>{c.type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString('en-IN')}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" />{cfg.label}
                  </span>
                </div>

                {c.admin_reply && (
                  <div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary">
                    <p className="text-xs font-semibold text-primary mb-1">Admin / Secretary Reply:</p>
                    <p className="text-sm">{c.admin_reply}</p>
                  </div>
                )}

                {isAdmin && c.status !== 'RESOLVED' && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs">Reply to this {c.type.toLowerCase()}</Label>
                    <Textarea
                      value={replies[c.id] || ''}
                      onChange={e => setReplies(r => ({ ...r, [c.id]: e.target.value }))}
                      placeholder="Type your reply..."
                      rows={2}
                      className="bg-background/50 resize-none text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleReply(c.id, 'IN_PROGRESS')} disabled={replyPending === c.id} variant="outline">Mark In Progress</Button>
                      <Button size="sm" onClick={() => handleReply(c.id, 'RESOLVED')} disabled={replyPending === c.id}>Mark Resolved</Button>
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
