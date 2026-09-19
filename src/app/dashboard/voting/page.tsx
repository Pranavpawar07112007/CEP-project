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
import { PlusCircle, Vote, Loader2, Trophy, CheckCircle2, Lock } from 'lucide-react';
import { createElection, nominateCandidate, castVote, closeElection } from '@/app/actions/modules';

type Election = {
  id: string;
  title: string;
  position: string;
  status: string;
  ends_at: string | null;
  created_at: string;
};
type Candidate = {
  id: string;
  election_id: string;
  user_id: string;
  manifesto: string | null;
  profiles?: { first_name: string; last_name: string; flat_number: string };
};
type VoteRecord = { election_id: string; candidate_id: string };

export default function VotingPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();
  const [elections, setElections] = React.useState<Election[]>([]);
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [voteCounts, setVoteCounts] = React.useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = React.useState<VoteRecord[]>([]);
  const [fetching, setFetching] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [votingPending, setVotingPending] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ title: '', position: 'SECRETARY', ends_at: '' });

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SECRETARY';

  const fetchData = React.useCallback(async () => {
    if (!profile) return;
    setFetching(true);

    const [{ data: elecs }, { data: cands }, { data: votes }] = await Promise.all([
      supabase.from('elections').select('*').eq('society_id', profile.society_id).order('created_at', { ascending: false }),
      supabase.from('candidates').select('*, profiles(first_name, last_name, flat_number)').order('created_at'),
      supabase.from('votes').select('election_id, candidate_id').eq('user_id', profile.id),
    ]);

    // Get vote counts per candidate
    const elecIds = (elecs || []).map(e => e.id);
    const counts: Record<string, number> = {};
    if (elecIds.length > 0) {
      const { data: allVotes } = await supabase.from('votes').select('candidate_id').in('election_id', elecIds);
      (allVotes || []).forEach(v => { counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1; });
    }

    setElections(elecs || []);
    setCandidates(cands || []);
    setVoteCounts(counts);
    setMyVotes(votes || []);
    setFetching(false);
  }, [supabase, profile]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateElection = () => {
    startTransition(async () => {
      const result = await createElection({
        society_id: profile?.society_id!,
        title: form.title,
        position: form.position,
        ends_at: form.ends_at || null,
      });
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: '🗳️ Election Created!' });
        setForm({ title: '', position: 'SECRETARY', ends_at: '' });
        setShowForm(false);
        fetchData();
      }
    });
  };

  const handleNominate = async (electionId: string) => {
    const result = await nominateCandidate(electionId);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else {
      toast({ title: '✅ You are now a candidate!' });
      fetchData();
    }
  };

  const handleVote = async (electionId: string, candidateId: string) => {
    setVotingPending(electionId);
    const result = await castVote(electionId, candidateId);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Cannot vote', description: result.error });
    } else {
      toast({ title: '🗳️ Vote Cast!', description: 'Your vote has been recorded.' });
      fetchData();
    }
    setVotingPending(null);
  };

  const handleCloseElection = async (id: string) => {
    const result = await closeElection(id);
    if (!result.error) toast({ title: 'Election closed.' });
    fetchData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voting System</h1>
          <p className="text-muted-foreground mt-1">Cast votes for committee positions in your society.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            {showForm ? 'Cancel' : 'Create Election'}
          </Button>
        )}
      </div>

      {showForm && isAdmin && (
        <Card className="bg-card/80 backdrop-blur border-primary/30 animate-fade-in">
          <CardHeader><CardTitle>New Election</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-1 space-y-2">
                <Label>Position</Label>
                <Select value={form.position} onValueChange={v => setForm(f => ({ ...f, position: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SECRETARY">Secretary</SelectItem>
                    <SelectItem value="CHAIRMAN">Chairman</SelectItem>
                    <SelectItem value="TREASURER">Treasurer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Election Title</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Secretary Election 2025" className="bg-background/50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>End Date/Time (optional)</Label>
              <Input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className="bg-background/50" />
            </div>
            <Button onClick={handleCreateElection} disabled={!form.title || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Election
            </Button>
          </CardContent>
        </Card>
      )}

      {fetching && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
      {!fetching && elections.length === 0 && (
        <Card className="bg-card/80 backdrop-blur border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <Vote className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium">No elections yet</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {elections.map(election => {
          const electionCandidates = candidates.filter(c => c.election_id === election.id);
          const myVote = myVotes.find(v => v.election_id === election.id);
          const isNominated = electionCandidates.some(c => c.user_id === profile?.id);
          const isClosed = election.status === 'CLOSED';
          const totalVotes = electionCandidates.reduce((acc, c) => acc + (voteCounts[c.id] || 0), 0);

          return (
            <Card key={election.id} className="bg-card/80 backdrop-blur border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {isClosed ? <Lock className="h-5 w-5 text-muted-foreground" /> : <Vote className="h-5 w-5 text-primary" />}
                      {election.title}
                    </CardTitle>
                    <CardDescription>Position: {election.position} · {totalVotes} votes cast</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${isClosed ? 'text-gray-600 bg-gray-500/10 border-gray-500/20' : 'text-green-600 bg-green-500/10 border-green-500/20'}`}>
                      {isClosed ? 'CLOSED' : 'ACTIVE'}
                    </span>
                    {isAdmin && !isClosed && (
                      <Button size="sm" variant="outline" onClick={() => handleCloseElection(election.id)}>Close Election</Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isNominated && !isClosed && (
                  <Button size="sm" variant="outline" onClick={() => handleNominate(election.id)} className="mb-2">
                    Nominate Yourself
                  </Button>
                )}

                {electionCandidates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No candidates yet. Be the first to nominate!</p>
                )}

                <div className="grid gap-3">
                  {electionCandidates.map(c => {
                    const voteCount = voteCounts[c.id] || 0;
                    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                    const hasVotedForThis = myVote?.candidate_id === c.id;

                    return (
                      <div key={c.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${hasVotedForThis ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-muted/20'}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{c.profiles?.first_name} {c.profiles?.last_name}</p>
                            {hasVotedForThis && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            {isClosed && voteCount === Math.max(...electionCandidates.map(x => voteCounts[x.id] || 0)) && voteCount > 0 && (
                              <Trophy className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">Flat: {c.profiles?.flat_number}</p>
                          {(isClosed || myVote) && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 bg-muted rounded-full flex-1 overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${percentage}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{voteCount} votes ({percentage}%)</span>
                            </div>
                          )}
                        </div>
                        {!isClosed && !myVote && (
                          <Button size="sm" onClick={() => handleVote(election.id, c.id)} disabled={votingPending === election.id} className="ml-3">
                            {votingPending === election.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Vote'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
