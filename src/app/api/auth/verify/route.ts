import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const { uid, email, name, googleId, picture } = await request.json();

    if (!uid) { // Email is not strictly required here if uid is present
      return NextResponse.json(
        { error: 'User ID (uid) is required' },
        { status: 400 }
      );
    }

    console.log('[Verify API] Verifying user:', { uid, email, name, googleId });

    let user = await prisma.user.findUnique({
      where: { id: uid },
      include: { settings: true },
    });

    if (user) {
      console.log('[Verify API] User found by ID (uid):', user.id);
      // Optionally update name, picture, googleId if they have changed
      const updateData: any = {};
      if (name && name !== user.name) updateData.name = name;
      if (picture && picture !== user.picture) updateData.picture = picture;
      if (googleId && googleId !== user.googleId) updateData.googleId = googleId;
      // Ensure email is also up-to-date if provided and different
      if (email && email !== user.email) updateData.email = email; 

      if (Object.keys(updateData).length > 0) {
        try {
          user = await prisma.user.update({
            where: { id: uid },
            data: updateData,
            include: { settings: true },
          });
          console.log('[Verify API] User details updated for ID:', uid);
        } catch (error) {
          console.error('[Verify API] Error updating user details for ID:', uid, error);
          // Continue with the user object we found
        }
      }
    } else if (email) {
      // User not found by uid, try by email
      console.log('[Verify API] User not found by ID (uid), trying email:', email);
      const userByEmail = await prisma.user.findUnique({
        where: { email },
        include: { settings: true },
      });

      if (userByEmail) {
        console.log('[Verify API] User found by email. Current DB ID:', userByEmail.id, 'Request UID:', uid);
        // User exists with this email, but with a different ID. 
        // This is a critical case: we should update this user record to use the Firebase UID.
        try {
          // Check if another user already exists with the target uid (should be rare, but good for safety)
          const existingUserWithUid = await prisma.user.findUnique({ where: { id: uid } });
          if (existingUserWithUid && existingUserWithUid.id !== userByEmail.id) {
            console.error('[Verify API] Critical: Attempting to change ID to an already existing different user ID. Aborting ID change.', 
              { currentEmailOwnerId: userByEmail.id, requestedUid: uid, ownerOfRequestedUid: existingUserWithUid.id });
             // Potentially delete the conflicting new account if it was partially created or return an error
            // For now, we'll just use the user record found by email, which might lead to issues downstream if UID is expected.
            user = userByEmail; 
          } else {
            user = await prisma.user.update({
              where: { email: userByEmail.email }, // or userByEmail.id
              data: {
                id: uid, // Update the ID to the Firebase UID
                name: name || userByEmail.name,
                googleId: googleId || userByEmail.googleId,
                picture: picture || userByEmail.picture,
                // email remains userByEmail.email (it's the key for the where clause)
              },
              include: { settings: true },
            });
            console.log(`[Verify API] User ID updated from ${userByEmail.id} to ${uid} for email ${email}`);
          }
        } catch (error: any) {
          if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
             console.error('[Verify API] Unique constraint violation when trying to update ID. Another user might exist with this new ID:', uid, error);
             // This case means the UID we want to assign already exists on another record. This is problematic.
             // Fallback to the user found by email for now, or signal a more critical error.
             user = userByEmail;
          } else {
            console.error('[Verify API] Error updating user ID for email:', email, error);
            // Fallback to the user found by email, or decide on error strategy
            user = userByEmail; 
          }
        }
      } else {
        // No user found by uid or email, create a new one with Firebase UID
        console.log('[Verify API] User not found by email either, creating new user with Firebase UID:', uid);
        try {
          user = await prisma.user.create({
            data: {
              id: uid,
              email: email, // Email is required for new user creation here
              name: name || (email ? email.split('@')[0] : 'User'),
              googleId,
              picture,
              settings: {
                create: {
                  theme: 'light',
                  language: 'en',
                  notifications: true,
                  settings: Prisma.JsonNull,
                },
              },
            },
            include: { settings: true },
          });
          console.log('[Verify API] New user created successfully with ID:', user.id);
        } catch (createError) {
          console.error('[Verify API] Error creating new user:', createError);
          // If creation fails, user will remain null
        }
      }
    } else {
        // No user found by uid and no email provided to search or create
        console.log('[Verify API] User not found by ID (uid) and no email provided. Cannot create user.');
        // User remains null
    }

    if (!user) {
      console.error('[Verify API] User could not be verified or created.');
      return NextResponse.json(
        { error: 'User could not be verified or created. Ensure email is provided for new users.' }, 
        { status: 500 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error in Verify API:', error);
    return NextResponse.json(
      { error: 'Failed to verify/create user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 