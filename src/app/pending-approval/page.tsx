'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ShieldCheck, LogOut, XCircle, Loader2 } from 'lucide-react';
import * as React from 'react';
import { createClient } from '@/utils/supabase/client';
import { cancelRegistration } from '@/app/actions/admin';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

export default function PendingApprovalPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <PendingApprovalContent />
    </React.Suspense>
  );
}

function PendingApprovalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [isCancelling, setIsCancelling] = React.useState(false);
  const { confirm, ConfirmDialogNode } = useConfirmDialog();
  const type = searchParams.get('type');

  const isSociety = type === 'society';

  const handleCancel = async () => {
    const ok = await confirm({
      title: 'Cancel Your Request?',
      description: isSociety
        ? 'This will permanently delete your society registration and your account. You will need to register again from scratch.'
        : 'This will permanently delete your join request and your account. This cannot be undone.',
      confirmLabel: 'Yes, Cancel & Delete Account',
      cancelLabel: 'Keep Waiting',
      variant: 'danger',
    });
    if (!ok) return;

    setIsCancelling(true);
    const res = await cancelRegistration();
    if (res.error) {
      toast({ variant: 'destructive', title: 'Error', description: res.error });
      setIsCancelling(false);
    } else {
      await supabase.auth.signOut();
      router.push('/sign-in');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {ConfirmDialogNode}

      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-yellow-400/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md shadow-2xl bg-card/80 backdrop-blur-xl border-white/10 z-10 text-center">
        <CardHeader className="space-y-4 pt-8">
          <div className="flex justify-center">
            <div className="p-5 bg-yellow-500/10 rounded-full">
              <Clock className="w-12 h-12 text-yellow-500" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isSociety ? 'Society Submitted for Review' : 'Request Sent!'}
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            {isSociety
              ? 'Your society registration has been submitted. The platform Super Admin will review and approve it. You will receive an email notification once activated.'
              : 'Your join request has been sent to the society admin. You will be notified once they approve or reject your request.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8 space-y-4">
          <div className="flex items-start gap-3 bg-muted/50 rounded-xl p-4 text-left">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Why verification?</p>
              <p className="text-xs text-muted-foreground mt-1">
                We verify all registrations to ensure data security and maintain the integrity of each society&apos;s private data.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/sign-in');
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out Securely
            </Button>

            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              disabled={isCancelling}
              onClick={handleCancel}
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancel Request &amp; Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
