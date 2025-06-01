import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const { uid, email } = await request.json();

    if (!uid || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      );
    }

    console.log('[Create User API] Attempting to create user:', { uid, email });

    // Try to find user first to avoid duplicates
    let user = await prisma.user.findUnique({
      where: { id: uid },
    });

    if (user) {
      console.log('[Create User API] User already exists:', user.id);
      return NextResponse.json({ 
        message: 'User already exists',
        user 
      });
    }

    // Create a new user with minimum required fields
    try {
      user = await prisma.user.create({
        data: {
          id: uid,
          email: email,
          name: email.split('@')[0],
          settings: {
            create: {
              theme: 'light',
              language: 'en',
              notifications: true,
              settings: Prisma.JsonNull
            }
          }
        },
        include: {
          settings: true
        }
      });
      
      console.log('[Create User API] User created successfully:', user.id);
      
      return NextResponse.json({
        message: 'User created successfully',
        user
      });
    } catch (error) {
      console.error('[Create User API] Error creating user:', error);
      throw error;
    }
  } catch (error) {
    console.error('[Create User API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 