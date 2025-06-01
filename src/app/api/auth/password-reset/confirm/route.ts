import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing token.' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    // Find the token in the database
    const passwordResetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!passwordResetToken) {
      return NextResponse.json({ error: 'Invalid or expired token. Please try resetting your password again.' }, { status: 400 });
    }

    // Check if the token has expired
    if (new Date(passwordResetToken.expires) < new Date()) {
      // Optionally delete the expired token
      await prisma.passwordResetToken.delete({ where: { id: passwordResetToken.id } });
      return NextResponse.json({ error: 'Token has expired. Please try resetting your password again.' }, { status: 400 });
    }

    // Token is valid and not expired, find the user by email from the token
    const user = await prisma.user.findUnique({
      where: { email: passwordResetToken.email },
    });

    if (!user) {
      // This case should be rare if token was generated for an existing user
      // but good to handle. It might also mean the user was deleted after token generation.
      await prisma.passwordResetToken.delete({ where: { id: passwordResetToken.id } }); // Clean up token
      return NextResponse.json({ error: 'User not found for this token. Please contact support.' }, { status: 404 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user's password
    await prisma.user.update({
      where: { id: user.id },
      data: { hashedPassword },
    });

    // Delete the token now that it has been used
    await prisma.passwordResetToken.delete({ where: { id: passwordResetToken.id } });

    return NextResponse.json({ message: 'Password has been reset successfully.' }, { status: 200 });

  } catch (error) {
    console.error('[API Password Reset Confirm] Error:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    // It's possible some Prisma errors (like unique constraint if token was somehow reused before delete)
    // or other unexpected errors occur.
    return NextResponse.json({ error: 'An internal server error occurred while resetting your password.' }, { status: 500 });
  }
} 