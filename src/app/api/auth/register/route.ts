import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing email, password, or name' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }, // Store and check email in lowercase
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 }); // 409 Conflict
    }

    const hashedPassword = await bcrypt.hash(password, 10); // 10 is a good salt round

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        hashedPassword: hashedPassword,
        name: name,
        // You might want to set emailVerified to null or a timestamp if you have email verification
        // emailVerified: null, 
      },
      select: { // Select only non-sensitive fields to return
        id: true,
        name: true,
        email: true,
        createdAt: true,
      }
    });

    return NextResponse.json(newUser, { status: 201 }); // 201 Created
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
  }
} 