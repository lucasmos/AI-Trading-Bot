'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation'; // Corrected import
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const COUNTDOWN_SECONDS = 10;

export function InactivityTimeout() {
  const { authStatus, logout } = useAuth();
  const router = useRouter();
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (authStatus === 'authenticated') {
      inactivityTimerRef.current = setTimeout(() => {
        setShowLogoutWarning(true);
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [authStatus]);

  const handleUserActivity = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      resetInactivityTimer();
      window.addEventListener('mousemove', handleUserActivity);
      window.addEventListener('keydown', handleUserActivity);
      window.addEventListener('click', handleUserActivity);
      window.addEventListener('scroll', handleUserActivity); // Added scroll
    }

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [authStatus, handleUserActivity, resetInactivityTimer]);

  useEffect(() => {
    if (showLogoutWarning) {
      setCountdown(COUNTDOWN_SECONDS); // Reset countdown when warning appears
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(countdownTimerRef.current!);
            handleLogout();
            return 0;
          }
          return prevCountdown - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    }
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [showLogoutWarning, logout]); // Removed router from dependencies

  const handleStayLoggedIn = () => {
    setShowLogoutWarning(false);
    resetInactivityTimer();
  };

  const handleLogout = () => {
    setShowLogoutWarning(false);
    logout(); // AuthContext logout already handles redirection
  };

  if (authStatus !== 'authenticated' || !showLogoutWarning) {
    return null;
  }

  return (
    <AlertDialog open={showLogoutWarning} onOpenChange={setShowLogoutWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Timeout</AlertDialogTitle>
          <AlertDialogDescription>
            You have been inactive. You will be logged out in{' '}
            <span className="font-bold">{countdown}</span> seconds.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={handleLogout}>Logout Now</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleStayLoggedIn}>Stay Logged In</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 