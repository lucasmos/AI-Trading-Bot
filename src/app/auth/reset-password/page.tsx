'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const resetPasswordSchema = z.object({
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Please confirm your password.' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // Path of error
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// Wrapper component to use useSearchParams
function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError('Invalid or missing password reset token. Please request a new one.');
      // Optionally redirect or show a more prominent error display
      // router.push('/auth/login'); 
    }
  }, [searchParams, router]);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token) {
      toast({ title: 'Error', description: 'Missing reset token. Cannot proceed.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });
      const result = await response.json();

      if (response.ok) {
        toast({ 
          title: 'Password Reset Successful', 
          description: result.message || 'Your password has been updated. Please log in.',
        });
        router.push('/auth/login');
      } else {
        toast({ 
          title: 'Password Reset Failed', 
          description: result.error || 'Could not reset your password. The link may be invalid or expired.',
          variant: 'destructive',
        });
        // Optionally, clear token or redirect if token is definitively invalid
        // if (response.status === 400 && result.error.toLowerCase().includes('token')) {
        //   setError('Invalid or expired token. Please request a new reset link.');
        // }
      }
    } catch (err) {
      console.error('Reset password error:', err);
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (error && !token) { // Show error if token was invalid/missing from the start
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="text-3xl">Reset Link Invalid</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-muted-foreground">
              {error}
            </p>
            <Button asChild>
                <Link href="/auth/login">Back to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!token && !error) { // Still loading token or initial state before useEffect runs
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <p>Loading...</p> {/* Or a spinner component */}
        </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl">Set New Password</CardTitle>
          <CardDescription>Enter and confirm your new password below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" />Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full text-lg py-6" disabled={isLoading || !token}>
                {isLoading ? 'Resetting Password...' : 'Set New Password'}
              </Button>
            </form>
          </Form>
           <div className="text-sm text-center">
              <Link href="/auth/login" className="font-medium text-primary hover:underline">
                Back to Login
              </Link>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main export with Suspense for useSearchParams
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading page...</div>}> {/* Or a proper loading component */}
      <ResetPasswordPageContent />
    </Suspense>
  );
} 