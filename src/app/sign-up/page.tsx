'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/utils/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { registerNewSociety, joinExistingSociety } from '@/app/actions/admin';

// ── Schemas ──────────────────────────────────────────────────
const newSocietySchema = z.object({
  societyName: z.string().min(2, 'Society name must be at least 2 characters.'),
  firstName: z.string().min(2, 'First name is required.'),
  lastName: z.string().min(2, 'Last name is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

const joinSchema = z.object({
  societyId: z.string().uuid('Please select a society.'),
  firstName: z.string().min(2, 'First name is required.'),
  lastName: z.string().min(2, 'Last name is required.'),
  flatNumber: z.string().min(1, 'Flat number is required.'),
  phone: z.string().min(10, 'Enter a valid phone number.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export default function SignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [step, setStep] = React.useState<'choose' | 'new' | 'join'>('choose');
  const [societies, setSocieties] = React.useState<{ id: string; name: string }[]>([]);
  const supabase = createClient();

  // Fetch active societies for the join flow
  React.useEffect(() => {
    const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'pranav07112007@gmail.com';
    
    supabase
      .from('societies')
      .select('id, name, admin_email')
      .eq('status', 'ACTIVE')
      .order('name')
      .then(({ data }) => { 
        if (data) {
          // Hide the platform admin's internal society from the public dropdown
          const filtered = data.filter(s => s.admin_email !== SUPER_ADMIN_EMAIL);
          setSocieties(filtered);
        }
      });
  }, [supabase]);

  // ── New Society Form ──────────────────────────────────────
  const newForm = useForm<z.infer<typeof newSocietySchema>>({
    resolver: zodResolver(newSocietySchema),
    defaultValues: { societyName: '', firstName: '', lastName: '', email: '', password: '' },
  });

  // ── Join Existing Form ────────────────────────────────────
  const joinForm = useForm<z.infer<typeof joinSchema>>({
    resolver: zodResolver(joinSchema),
    defaultValues: { societyId: '', firstName: '', lastName: '', flatNumber: '', phone: '', email: '', password: '' },
  });

  // ── Handlers ──────────────────────────────────────────────
  const handleNewSociety = (values: z.infer<typeof newSocietySchema>) => {
    startTransition(async () => {
      // All DB writes happen server-side via service role — no RLS issues
      const result = await registerNewSociety(values);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Registration Failed', description: result.error });
        return;
      }
      // Sign them in immediately (account is created and confirmed server-side)
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInErr) {
        toast({ variant: 'destructive', title: 'Account created but sign-in failed', description: signInErr.message });
        router.push('/sign-in');
        return;
      }
      router.push('/pending-approval?type=society');
    });
  };

  const handleJoinSociety = (values: z.infer<typeof joinSchema>) => {
    startTransition(async () => {
      // All DB writes happen server-side via service role — no RLS issues
      const result = await joinExistingSociety(values);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Registration Failed', description: result.error });
        return;
      }
      // Sign them in immediately
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInErr) {
        toast({ variant: 'destructive', title: 'Account created but sign-in failed', description: signInErr.message });
        router.push('/sign-in');
        return;
      }
      router.push('/pending-approval?type=member');
    });
  };

  // ── UI ────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />

      {/* STEP 1: Choose flow */}
      {step === 'choose' && (
        <Card className="w-full max-w-lg shadow-2xl bg-card/80 backdrop-blur-xl border-white/10 z-10">
          <CardHeader className="text-center space-y-2 pt-8">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-primary/10 rounded-full">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">Get Started</CardTitle>
            <CardDescription>
              Are you registering a new society or joining an existing one?
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 pb-6">
            <button
              onClick={() => setStep('new')}
              className="group flex flex-col items-center gap-3 rounded-xl border-2 border-border hover:border-primary p-6 transition-all hover:bg-primary/5 text-left"
            >
              <div className="p-3 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                <Building2 className="w-7 h-7 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-base">Register New Society</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Set up your society workspace as Admin
                </p>
              </div>
            </button>
            <button
              onClick={() => setStep('join')}
              className="group flex flex-col items-center gap-3 rounded-xl border-2 border-border hover:border-primary p-6 transition-all hover:bg-primary/5 text-left"
            >
              <div className="p-3 bg-green-500/10 rounded-full group-hover:bg-green-500/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" x2="19" y1="8" y2="14" />
                  <line x1="22" x2="16" y1="11" y2="11" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-base">Join Existing Society</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Register as a resident or owner
                </p>
              </div>
            </button>
          </CardContent>
          <CardFooter className="justify-center pb-8">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/sign-in" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </Card>
      )}

      {/* STEP 2A: New Society */}
      {step === 'new' && (
        <Card className="w-full max-w-md shadow-2xl bg-card/80 backdrop-blur-xl border-white/10 z-10 my-8">
          <CardHeader>
            <button
              onClick={() => setStep('choose')}
              className="text-xs text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1 transition-colors"
            >
              ← Back
            </button>
            <CardTitle className="text-2xl font-bold">Register New Society</CardTitle>
            <CardDescription>
              Your registration will be reviewed by the platform Super Admin before activation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...newForm}>
              <form onSubmit={newForm.handleSubmit(handleNewSociety)} className="space-y-4">
                <FormField control={newForm.control} name="societyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Society Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Green Valley Apartments" className="bg-background/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={newForm.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={newForm.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={newForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@society.com" className="bg-background/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Min. 8 characters" className="bg-background/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-11 font-semibold mt-2" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit for Approval
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* STEP 2B: Join Existing */}
      {step === 'join' && (
        <Card className="w-full max-w-md shadow-2xl bg-card/80 backdrop-blur-xl border-white/10 z-10 my-8">
          <CardHeader>
            <button
              onClick={() => setStep('choose')}
              className="text-xs text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1 transition-colors"
            >
              ← Back
            </button>
            <CardTitle className="text-2xl font-bold">Join Your Society</CardTitle>
            <CardDescription>
              Your request will be verified by the society admin before you get access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...joinForm}>
              <form onSubmit={joinForm.handleSubmit(handleJoinSociety)} className="space-y-4">
                <FormField control={joinForm.control} name="societyId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Society</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Search your society..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {societies.length === 0 && (
                          <SelectItem value="none" disabled>No active societies found</SelectItem>
                        )}
                        {societies.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={joinForm.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={joinForm.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={joinForm.control} name="flatNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flat / Unit No.</FormLabel>
                      <FormControl>
                        <Input placeholder="A-101" className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={joinForm.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="9876543210" className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={joinForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" className="bg-background/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={joinForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Min. 8 characters" className="bg-background/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-11 font-semibold mt-2" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Request to Join
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
