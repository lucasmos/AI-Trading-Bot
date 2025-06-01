// src/app/auth/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
// Remove Firebase specific imports for password reset
// import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
// import { auth as firebaseAuthInstance, isFirebaseInitialized } from '@/lib/firebase/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
// Label might be needed for the modal form
import { Label } from '@/components/ui/label'; 
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Mail, KeyRound, Briefcase } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { signIn, useSession } from 'next-auth/react';

// Assuming AlertDialog components from shadcn/ui are available
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  // AlertDialogTrigger, // We'll open it programmatically
} from "@/components/ui/alert-dialog";


const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false); // For main login form
  const { data: session, status } = useSession();

  // State for Forgot Password Modal
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);


  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false, // Important: handle redirect manually or rely on useEffect
      });

      if (result?.error) {
        toast({
          title: 'Login Failed',
          description: result.error === "CredentialsSignin" ? "Invalid email or password." : result.error,
          variant: 'destructive',
        });
      } else if (result?.ok) {
        toast({ title: 'Login Successful', description: 'Welcome back!' });
        // router.push('/'); // Let useEffect handle redirect based on session status
        // Or, if you want immediate redirect without waiting for session status propagation:
        router.push('/');
      } else {
        // Handle other potential non-error, non-ok scenarios if necessary
         toast({
          title: 'Login Attempt Unsuccessful',
          description: 'An unexpected issue occurred. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error: any) { // Catch should ideally not be hit if signIn is handled correctly
      console.error('Login error (catch block):', error);
      toast({
        title: 'Login Error',
        description: 'An unexpected error occurred during login.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    signIn('google', { callbackUrl: '/' });
  };

  // Updated to open the modal
  const handleForgotPasswordLinkClick = () => {
    setForgotPasswordEmail(''); // Clear previous email
    setIsForgotPasswordModalOpen(true);
  };

  const handleForgotPasswordSubmit = async () => {
    if (!forgotPasswordEmail) {
      toast({ title: 'Email Required', description: 'Please enter your email address.', variant: 'destructive' });
      return;
    }
    // Basic email validation (more robust validation can be added)
    if (!/\S+@\S+\.\S+/.test(forgotPasswordEmail)) {
         toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
        return;
    }

    setIsForgotPasswordLoading(true);
    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });
      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Password Reset Requested',
          description: result.message || 'If an account exists with that email, a password reset link has been sent (check console for now).',
        });
        setIsForgotPasswordModalOpen(false);
      } else {
        toast({
          title: 'Request Failed',
          description: result.error || 'Could not process password reset request.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Forgot password submit error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsForgotPasswordLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to access your DerivAI Lite account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="your@email.com" {...field} disabled={isLoading} />
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
                    <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login with Email'}
              </Button>
              <div className="text-sm text-center">
                <Link 
                  href="#" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    handleForgotPasswordLinkClick(); 
                  }} 
                  className="font-medium text-primary hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
            </form>
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full text-lg py-6"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <FcGoogle className="mr-3 h-6 w-6" />
            Sign in with Google
          </Button>
          
          <Button
              variant="outline"
              className="w-full text-lg py-6 border-primary text-primary hover:bg-primary/5"
              onClick={() => router.push('/auth/deriv')}
              disabled={isLoading}
          >
              <Briefcase className="mr-3 h-6 w-6"/> Login with Deriv
          </Button>


          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Forgot Password Modal */}
      <AlertDialog open={isForgotPasswordModalOpen} onOpenChange={setIsForgotPasswordModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Your Password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your email address below. If an account exists, we&apos;ll send you a link to reset your password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-password-email">Email Address</Label>
              <Input
                id="forgot-password-email"
                type="email"
                placeholder="your@email.com"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                disabled={isForgotPasswordLoading}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isForgotPasswordLoading}>Cancel</AlertDialogCancel>
            <Button onClick={handleForgotPasswordSubmit} disabled={isForgotPasswordLoading}>
              {isForgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
