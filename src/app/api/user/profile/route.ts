import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Adjust path as needed
import { prisma } from '@/lib/db'; // Assuming prisma is exported from lib/db

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('[API /api/user/profile] PUT: getServerSession result:', session);

    if (!session || !session.user || !(session.user as any).id) {
      console.error('[API /api/user/profile] PUT: Unauthorized access attempt. Session details:', session);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id as string;

    const body = await request.json();
    const { displayName, avatarDataUrl } = body;

    if (typeof displayName !== 'string' && typeof avatarDataUrl !== 'string' && displayName !== null && avatarDataUrl !== null) {
      return NextResponse.json({ error: 'displayName or avatarDataUrl must be provided, or be null to clear' }, { status: 400 });
    }
    
    const updateData: { displayName?: string | null; avatarDataUrl?: string | null } = {};
    if (typeof displayName === 'string' || displayName === null) {
      updateData.displayName = displayName;
    }
    if (typeof avatarDataUrl === 'string' || avatarDataUrl === null) {
      if (avatarDataUrl && !avatarDataUrl.startsWith('data:image') && avatarDataUrl !== '') {
        // return NextResponse.json({ error: 'Invalid avatar data URL format' }, { status: 400 });
      }
      updateData.avatarDataUrl = avatarDataUrl;
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update provided' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { 
        id: true,
        email: true,
        name: true, // NextAuth uses 'name'
        // image: true, // Temporarily removed to resolve linter error
        displayName: true, // Your custom field
        avatarDataUrl: true, // Your custom field
        updatedAt: true
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Failed to update user profile:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('[API /api/user/profile] GET: getServerSession result:', session);

    if (!session || !session.user || !(session.user as any).id) {
      console.error('[API /api/user/profile] GET: Unauthorized access attempt. Session details:', session);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        // image: true, // Temporarily removed to resolve linter error
        displayName: true,
        avatarDataUrl: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('[API /api/user/profile] DELETE: getServerSession result:', session);

    if (!session || !session.user || !(session.user as any).id) {
      console.error('[API /api/user/profile] DELETE: Unauthorized access attempt. Session details:', session);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id as string;

    // Prisma schema should have onDelete: Cascade for related Account and Session records.
    await prisma.user.delete({
      where: { id: userId },
    });

    // It might be good to also explicitly sign the user out by clearing the session cookie.
    // However, NextAuth doesn't provide a direct server-side method to invalidate a specific session cookie easily.
    // The client will eventually find out upon next request or when AuthContext tries to use the (now invalid) session.
    // The client-side logout triggered after this API call is the more robust way.

    return NextResponse.json({ message: 'User account deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete user account:', error);
    // Check if it's a Prisma error for record not found (e.g., if user already deleted)
    if ((error as any).code === 'P2025') {
        return NextResponse.json({ error: 'User not found or already deleted' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete user account' }, { status: 500 });
  }
} 