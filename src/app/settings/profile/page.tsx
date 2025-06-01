'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UserProfileSettings, UserInfo } from '@/types'; 
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image'; // For image preview
import { Separator } from '@/components/ui/separator';

const UserProfilePage = () => {
  const { toast } = useToast();
  const { userInfo, authStatus, login, logout } = useAuth();
  const [profileSettings, setProfileSettings] = useState<UserProfileSettings>({ displayName: '', avatarDataUrl: undefined });
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      setIsProfileLoading(true);
      if (authStatus === 'authenticated' && userInfo) {
        console.log('[ProfilePage] Auth status is authenticated, userInfo exists. Proceeding to fetch profile.');
        console.log('[ProfilePage] authStatus from useAuth:', authStatus);
        console.log('[ProfilePage] userInfo from useAuth:', userInfo);
        // You might need to import useSession from next-auth/react at the top of the file for this to work:
        // const { data: clientSession, status: clientSessionStatus } = useSession(); // If you want to compare directly
        // console.log('[ProfilePage] Direct useSession data on client:', clientSession);
        // console.log('[ProfilePage] Direct useSession status on client:', clientSessionStatus);

        try {
          // API call will now be authenticated by NextAuth session cookie
          const response = await fetch('/api/user/profile');
          if (response.ok) {
            const data = await response.json();
            setProfileSettings({ 
              displayName: data.displayName || userInfo.name || '',
              avatarDataUrl: data.avatarDataUrl || (userInfo.photoURL === null ? undefined : userInfo.photoURL) 
            });
            if (data.avatarDataUrl) setAvatarPreview(data.avatarDataUrl);
            else if (userInfo.photoURL) setAvatarPreview(userInfo.photoURL || null);

          } else {
            console.warn('Failed to fetch profile from API, using context/local as fallback');
            const storedProfile = localStorage.getItem(`userProfile_${userInfo.id}`);
            if (storedProfile) {
              const parsed = JSON.parse(storedProfile) as UserProfileSettings;
              setProfileSettings(parsed);
              if (parsed.avatarDataUrl) setAvatarPreview(parsed.avatarDataUrl);
            } else {
              setProfileSettings({ 
                displayName: userInfo.name || '', 
                avatarDataUrl: userInfo.photoURL === null ? undefined : userInfo.photoURL 
              });
              if (userInfo.photoURL) setAvatarPreview(userInfo.photoURL || null);
            }
          }
        } catch (error) {
          console.error('Error loading profile:', error);
          setProfileSettings({ 
            displayName: userInfo.name || '', 
            avatarDataUrl: userInfo.photoURL === null ? undefined : userInfo.photoURL 
          });
          if (userInfo.photoURL) setAvatarPreview(userInfo.photoURL || null);
        }
      } else if (authStatus === 'unauthenticated') {
        toast({ title: 'Not Authenticated', description: 'Please login to view your profile.', variant: 'destructive' });
        // router.push('/auth/login'); // Consider redirecting
      }
      setIsProfileLoading(false);
    };

    if (authStatus !== 'pending') {
    loadProfile();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, userInfo]); // Removed toast

  useEffect(() => {
    if (userInfo) {
      setProfileSettings(prev => ({ ...prev, displayName: userInfo.name || '' }));
      setAvatarPreview(userInfo.photoURL || userInfo.avatarUrl || null);
    }
  }, [userInfo]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Max 2MB
        toast({ title: 'File too large', description: 'Please select an image smaller than 2MB.', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setProfileSettings(prev => ({ ...prev, avatarDataUrl: dataUrl }));
        setAvatarPreview(dataUrl);
      };
      reader.onerror = () => {
        toast({ title: 'Error reading file', description: 'Could not read the selected image.', variant: 'destructive' });
      }
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!userInfo) {
      toast({ title: 'Error', description: 'User not found.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      // API call will now be authenticated by NextAuth session cookie
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileSettings),
      });

      if (response.ok) {
        const updatedUserFromApi = await response.json();
        toast({ title: 'Profile Updated', description: 'Your profile has been saved.' });
        
        // Update AuthContext with the latest user info from the API response
        const updatedUserInfo: UserInfo = {
          ...userInfo,
          name: updatedUserFromApi.displayName || profileSettings.displayName, // Use API response, fallback to local state
          photoURL: updatedUserFromApi.avatarDataUrl || profileSettings.avatarDataUrl, // Use API response, fallback to local state
          // Ensure other UserInfo fields are preserved or updated as needed
        };
        login(updatedUserInfo, userInfo.authMethod, { redirect: false });

        // Optionally, update local storage if still used as a progressive cache
        localStorage.setItem(`userProfile_${userInfo.id}`, JSON.stringify(profileSettings));

        // To ensure NextAuth session reflects changes immediately if not automatic:
        // Option 1: Trigger a session update (e.g., by router.refresh() or custom event for useSession().update() if available)
        // Option 2: Rely on next DB read by NextAuth to have updated info for new sessions/tokens
        // For now, AuthContext is updated. NextAuth session update will be handled by subsequent API reads or new session.

      } else {
        const errorData = await response.json();
        toast({ title: 'Save Failed', description: errorData.error || 'Could not save profile.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!userInfo || !userInfo.email) {
      toast({ title: 'Error', description: 'User email not found.', variant: 'destructive' });
      return;
    }

    if (userInfo.provider === 'google') {
      toast({ 
        title: 'Password Management', 
        description: 'You signed in with Google. Please manage your password through your Google account.',
        variant: 'default'
      });
      return;
    }

    // Assuming any other method with an email (especially 'credentials') uses our NextAuth password reset
    try {
      setIsSaving(true); // Reuse isSaving for loading state for this button as well
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userInfo.email }),
      });

      if (response.ok) {
        toast({ title: 'Password Reset Email Sent', description: 'Check your inbox for instructions to reset your password.'});
      } else {
        const errorData = await response.json();
        toast({ title: 'Password Reset Failed', description: errorData.error || 'Could not initiate password reset.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Password Reset Error', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data associated with this application.')) return;

    if (!userInfo) {
      toast({ title: 'Error', description: 'Could not identify user for deletion.', variant: 'destructive' });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/user/profile', { method: 'DELETE' });
      if (response.ok) {
        toast({ title: 'Account Deletion Successful', description: 'Your account has been deleted. You will be logged out.'});
        await logout(); // Explicitly call logout
      } else {
        const errorData = await response.json();
        toast({ title: 'Deletion Failed', description: errorData.error || 'Could not delete account.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred during deletion.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Consolidated loading state logic
  if (authStatus === 'pending' || (authStatus === 'authenticated' && (!userInfo || isProfileLoading))) {
    return <p className="p-4 md:p-6">Loading profile settings...</p>;
  }

  if (authStatus === 'unauthenticated' || !userInfo) { // Safeguard with !userInfo
    return <p className="p-4 md:p-6">Please log in to manage your profile.</p>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">User Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your display name and avatar. Changes are saved to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input 
              id="displayName"
              name="displayName" 
              value={profileSettings.displayName || ''} 
              onChange={handleInputChange} 
              placeholder="Your Name"
              disabled={isSaving || isProfileLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatarUpload">Avatar (Optional)</Label>
            <Input 
              id="avatarUpload" 
              name="avatarUpload" 
              type="file"
              accept="image/png, image/jpeg, image/gif, image/webp"
              onChange={handleAvatarChange} 
              disabled={isSaving || isProfileLoading}
            />
            {avatarPreview && (
              <div className="mt-2 relative w-24 h-24 rounded-full overflow-hidden border">
                <Image src={avatarPreview} alt="Avatar Preview" layout="fill" objectFit="cover" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Max file size: 2MB. Recommended: Square image.</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveProfile} disabled={isSaving || isProfileLoading || !userInfo}>
            {isSaving ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Management (via NextAuth)</CardTitle>
          <CardDescription>These actions are handled by your authentication provider (NextAuth).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">Password Reset</h3>
            <p className="text-sm text-muted-foreground mb-2">
              If you used email/password to sign up, you can request a password reset link.
            </p>
            <Button 
              onClick={handlePasswordReset} 
              variant="outline"
              className="w-full md:w-auto"
              disabled={isSaving || userInfo?.provider === 'google'} // Disable if saving or Google user
            >
              Reset Password
            </Button>
            {userInfo?.provider === 'google' && (
                <p className="text-xs text-muted-foreground">
                    You signed in with Google. Manage your password through your Google account.
                </p>
            )}
          </div>
          <div>
            <h3 className="font-medium mb-1">Delete Account</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Permanently delete your authentication account. This action cannot be undone.
            </p>
            <Button 
              onClick={handleDeleteAccount} 
              variant="destructive"
              className="w-full md:w-auto"
              disabled={isSaving}
            >
              Delete My Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserProfilePage; 