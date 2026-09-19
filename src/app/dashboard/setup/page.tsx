'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCog, Loader2, CheckCircle2 } from 'lucide-react';
import { updateSocietyMode } from '@/app/actions/admin';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [selectedMode, setSelectedMode] = React.useState<'COMMUNITY' | 'ADMIN_ONLY' | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // If not admin, push away
  React.useEffect(() => {
    if (profile && profile.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [profile, router]);

  const handleSave = () => {
    if (!selectedMode) return;
    startTransition(async () => {
      const result = await updateSocietyMode(selectedMode);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      } else {
        toast({ title: 'Setup Complete', description: 'Your society is ready!' });
        router.push('/dashboard');
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-10 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to Society SaaS</h1>
        <p className="text-lg text-muted-foreground">How would you like to run your society?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 pt-8">
        <Card 
          className={`cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${selectedMode === 'COMMUNITY' ? 'border-primary ring-2 ring-primary/20 bg-primary/10' : ''}`}
          onClick={() => setSelectedMode('COMMUNITY')}
        >
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                <Users className="h-8 w-8" />
              </div>
              {selectedMode === 'COMMUNITY' && <CheckCircle2 className="h-6 w-6 text-primary" />}
            </div>
            <CardTitle className="text-2xl mt-4">Community Mode</CardTitle>
            <CardDescription className="text-base">The complete interactive platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>✅ Residents can sign up and log in.</p>
            <p>✅ Members pay maintenance online via Razorpay.</p>
            <p>✅ Full access to Notice Board, Complaints, and Voting.</p>
            <p>✅ Hall Allocation and Property Tracker available to all.</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${selectedMode === 'ADMIN_ONLY' ? 'border-primary ring-2 ring-primary/20 bg-primary/10' : ''}`}
          onClick={() => setSelectedMode('ADMIN_ONLY')}
        >
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-lg">
                <UserCog className="h-8 w-8" />
              </div>
              {selectedMode === 'ADMIN_ONLY' && <CheckCircle2 className="h-6 w-6 text-primary" />}
            </div>
            <CardTitle className="text-2xl mt-4">Admin Only Mode</CardTitle>
            <CardDescription className="text-base">A private ledger for your eyes only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>✅ Residents <strong>cannot</strong> log in.</p>
            <p>✅ You manage offline members and manual cash payments.</p>
            <p>✅ Interactive modules (Notices, Voting, Complaints) are hidden.</p>
            <p>✅ Perfect for small societies moving away from Excel.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-8">
        <Button 
          size="lg" 
          className="w-full max-w-sm" 
          disabled={!selectedMode || isPending}
          onClick={handleSave}
        >
          {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          Continue
        </Button>
      </div>
    </div>
  );
}
