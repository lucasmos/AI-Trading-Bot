import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
// Import the new mailer function
import { sendPasswordResetEmail } from '@/lib/mailer';

const HBS_PASSWORD_RESET_TOKEN_EXPIRES_IN_MS = 3600000; // 1 hour

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const lowercasedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: lowercasedEmail },
    });

    // It's important not to reveal if an email exists or not for security reasons.
    // So, we proceed as if we're sending an email, even if the user isn't found or isn't eligible.
    // Only if the user exists AND they use password auth, we generate and store a token.

    if (user && user.hashedPassword) { // Check if user exists and uses password auth
      // Generate a secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + HBS_PASSWORD_RESET_TOKEN_EXPIRES_IN_MS);

      // Delete any existing tokens for this email to prevent multiple valid tokens
      await prisma.passwordResetToken.deleteMany({
        where: { email: lowercasedEmail },
      });

      // Store the new token (raw, as decided)
      await prisma.passwordResetToken.create({
        data: {
          email: lowercasedEmail,
          token: token,
          expires: expires,
        },
      });

      // Construct the reset link
      const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;
      
      // Send the password reset email
      try {
        await sendPasswordResetEmail(lowercasedEmail, resetLink);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Even if email fails, don't reveal it to the client to prevent email enumeration.
        // Log the error server-side. The generic success message will still be sent.
        // You might want more sophisticated error handling/retry mechanisms for email sending in production.
      }
    }

    // Always return a generic success message to avoid email enumeration
    return NextResponse.json({ message: 'If your email is in our system, you will receive a password reset link shortly.' }, { status: 200 });

  } catch (error) {
    console.error('[API Password Reset Request] Error:', error);
    // Generic error for the client, specific error logged server-side
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
} 