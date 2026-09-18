
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SplashScreen from '@/components/splash-screen';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});


export default function SignUpPage() {
    const { user, signUp, loading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = React.useTransition();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    React.useEffect(() => {
        if (!loading && user) {
            router.push('/');
        }
    }, [user, loading, router]);
    
    const onSubmit = (values: z.infer<typeof formSchema>) => {
        startTransition(async () => {
            try {
                await signUp(values.email, values.password);
                router.push('/');
            } catch (error: any) {
                let description = "An unexpected error occurred. Please try again.";
                if (error?.code === 'auth/email-already-in-use') {
                    description = "This email is already in use. Please sign in or use a different email.";
                } else {
                    console.error("Sign up failed", error);
                }
                 toast({
                    variant: "destructive",
                    title: "Sign Up Failed",
                    description: description,
                });
            }
        });
    };

    if (loading) {
        return <SplashScreen />;
    }
    
    if (user) {
        return null;
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm shadow-xl glass-card">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-headline">Create an Account</CardTitle>
                    <CardDescription>Get started with SocietyPay Tracker today.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="name@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="••••••••" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Sign Up
                            </Button>
                        </form>
                    </Form>
                </CardContent>
                 <CardFooter className="flex justify-center text-sm">
                    <p>Already have an account? <Link href="/sign-in" className="font-semibold text-primary hover:underline">Sign In</Link></p>
                </CardFooter>
            </Card>
        </main>
    );
}
