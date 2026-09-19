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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Megaphone, CalendarCheck, PartyPopper, Newspaper, Loader2 } from 'lucide-react';
import { createNotice, deleteNotice } from '@/app/actions/modules';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

const NOTICE_TYPES = [
  { value: 'ANNOUNCEMENT', label: 'Announcement', icon: Megaphone, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'MEETING', label: 'Meeting', icon: CalendarCheck, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  { value: 'EVENT', label: 'Event', icon: PartyPopper, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  { value: 'ADVERTISEMENT', label: 'Advertisement', icon: Newspaper, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
];

type Notice = {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
  created_by: string;
};

export default function NoticesPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const [notices, setNotices] = React.useState<Notice[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [form, setForm] = React.useState({ title: '', content: '', type: 'ANNOUNCEMENT' });

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SECRETARY';
  const { confirm, ConfirmDialogNode } = useConfirmDialog();

  const fetchNotices = React.useCallback(async () => {
    if (!profile?.society_id) return;
    setFetching(true);
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('society_id', profile.society_id)
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setFetching(false);
  }, [supabase, profile]);

  React.useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createNotice({
        society_id: profile?.society_id,
        title: form.title,
        content: form.content,
        type: form.type,
      });
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '📋 Notice Posted', description: 'All members will see this notice.' });
        setForm({ title: '', content: '', type: 'ANNOUNCEMENT' });
        setShowForm(false);
        fetchNotices();
      }
    });
  };

  const handleDelete = async (notice: Notice) => {
    const ok = await confirm({
      title: 'Delete Notice?',
      description: `Are you sure you want to delete "${notice.title}"? Members will no longer be able to see it.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    await deleteNotice(notice.id);
    toast({ title: '🗑️ Notice removed.' });
    fetchNotices();
  };

  const getTypeInfo = (type: string) => NOTICE_TYPES.find(t => t.value === type) || NOTICE_TYPES[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {ConfirmDialogNode}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notice Board</h1>
          <p className="text-muted-foreground mt-1">Important announcements, meetings, and events from your society.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            {showForm ? 'Cancel' : 'Post Notice'}
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showForm && isAdmin && (
        <Card className="bg-card/80 backdrop-blur border-primary/30 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-lg">Post a New Notice</CardTitle>
            <CardDescription>This will be visible to all members of your society.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Notice Title</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Water Supply Disruption"
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Describe the notice in detail..."
                rows={4}
                className="bg-background/50 resize-none"
              />
            </div>
            <Button onClick={handleCreate} disabled={!form.title || !form.content || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post Notice
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notices List */}
      {fetching && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {!fetching && notices.length === 0 && (
        <Card className="bg-card/80 backdrop-blur border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <Megaphone className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-base font-medium">No notices posted yet</p>
            <p className="text-sm">Check back later for announcements from your society.</p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4">
        {notices.map(notice => {
          const typeInfo = getTypeInfo(notice.type);
          const Icon = typeInfo.icon;
          return (
            <Card key={notice.id} className="bg-card/80 backdrop-blur border-border/50 hover:border-primary/30 transition-colors group">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2 rounded-lg mt-0.5 ${typeInfo.color.split(' ').slice(0, 1).join(' ')} shrink-0`}>
                      <Icon className={`h-5 w-5 ${typeInfo.color.split(' ').slice(1, 2).join(' ')}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base">{notice.title}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${typeInfo.color}`}>{typeInfo.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{notice.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">{new Date(notice.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleDelete(notice)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
