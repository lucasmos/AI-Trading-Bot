'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/auth-context';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from "@/components/ui/toaster";
import { InactivityTimeout } from '@/components/auth/InactivityTimeout';
import { AppLayout } from '@/components/layout/app-layout'; // AppLayout will be wrapped here

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <SidebarProvider defaultOpen={true}>
          <AppLayout> {/* AppLayout is now inside all client providers */}
            {children}
          </AppLayout>
          <Toaster />
          <InactivityTimeout />
        </SidebarProvider>
      </AuthProvider>
    </SessionProvider>
  );
} 