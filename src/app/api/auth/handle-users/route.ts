import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// Define the selective include for UserSettings
const userSettingsBaseSelect = {
  id: true,
  userId: true,
  theme: true,
  language: true,
  notifications: true,
  settings: true, // This is the generic JSON field
  createdAt: true,
  updatedAt: true,
  // Explicitly EXCLUDE new Deriv-specific fields like derivDemoAccountId, etc.
};

// New type based on selective include
type UserWithBaseSettings = Prisma.UserGetPayload<{
  include: {
    settings: {
      select: typeof userSettingsBaseSelect
    }
  }
}>;

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      console.error('[Handle Users API] Request body is empty.');
      return NextResponse.json({ error: 'Request body is empty' }, { status: 400 });
    }

    let requestData;
    try {
      requestData = JSON.parse(rawBody);
    } catch (parseError: any) {
      console.error('[Handle Users API] Failed to parse request body JSON:', parseError.message);
      console.error('[Handle Users API] Raw body received:', rawBody); // Log the problematic body
      return NextResponse.json({ error: 'Invalid JSON format in request body', details: parseError.message }, { status: 400 });
    }

    let {
      userId, 
      email, 
      name, 
      googleId, 
      picture,
      authMethod
    } = requestData;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID (userId) is required' },
        { status: 400 }
      );
    }
    userId = String(userId); // Ensure userId is a string for all subsequent operations

    console.log('[Handle Users API] Processing user:', { userId, email, authMethod, name });

    let user: UserWithBaseSettings | null = await prisma.user.findUnique({
      where: { id: userId }, 
      include: { settings: { select: userSettingsBaseSelect } }
    });

    if (!user && email) {
      console.log('[Handle Users API] User not found by primary ID, checking by email:', email);
      const userByEmail = await prisma.user.findUnique({
        where: { email },
        include: { settings: { select: userSettingsBaseSelect } }
      }) as UserWithBaseSettings | null;

      if (userByEmail) {
        console.log(`[Handle Users API] User found by email with ID ${userByEmail.id}. Incoming userId is ${userId} (authMethod: ${authMethod}).`);
        
        if (userByEmail.id !== userId) {
            console.log(`[Handle Users API] Attempting to consolidate user. Current DB ID: ${userByEmail.id}, New incoming ID: ${userId} for email: ${email}`);
            try {
                const conflictingUserWithTargetId = await prisma.user.findUnique({ where: { id: userId } });
                if (conflictingUserWithTargetId) {
                    console.error(`[Handle Users API] CONFLICT: Cannot change ID of user ${userByEmail.id} (email: ${email}) to ${userId} because another user already has ID ${userId}.`);
                    user = userByEmail;
                } else {
                    const updateDataForIdChange: any = {
                        id: userId, 
                        name: name || userByEmail.name,
                        googleId: authMethod === 'google' ? googleId : (authMethod === 'deriv' ? null : userByEmail.googleId),
                        picture: authMethod === 'google' ? picture : (authMethod === 'deriv' ? (userByEmail.picture || null) : userByEmail.picture),
                    };
                    if (authMethod || (userByEmail as any).authMethod) {
                        updateDataForIdChange.authMethod = authMethod || (userByEmail as any).authMethod;
                    }

                    user = await prisma.user.update({
                        where: { id: userByEmail.id }, 
                        data: updateDataForIdChange as Prisma.UserUpdateInput,
                        include: { settings: { select: userSettingsBaseSelect } }
                    }) as UserWithBaseSettings;
                    console.log(`[Handle Users API] User ID for email ${email} updated from ${userByEmail.id} to ${user.id}. Auth method: ${(user as any).authMethod}`);
                }
            } catch (updateError: any) {
                 if (updateError instanceof Prisma.PrismaClientKnownRequestError && updateError.code === 'P2002' && updateError.meta?.target && Array.isArray(updateError.meta.target) && updateError.meta.target.includes('id')) {
                    console.error(`[Handle Users API] Unique constraint violation (P2002) when trying to update ID for email ${email} to ${userId}.`, updateError);
                    user = userByEmail; 
                 } else {
                    console.error('[Handle Users API] Error updating user ID during email-based reconciliation:', updateError);
                    user = userByEmail; 
                 }
            }
        } else {
            user = userByEmail;
            if (user) {
                const updateData: any = {};
                if (name && name !== user.name) updateData.name = name;
                if (authMethod && authMethod !== (user as any).authMethod) updateData.authMethod = authMethod;
                if (authMethod === 'google') {
                    if (googleId && googleId !== user.googleId) updateData.googleId = googleId;
                    if (picture && picture !== user.picture) updateData.picture = picture;
                } else if (authMethod === 'deriv') {
                    if (user.googleId !== null) updateData.googleId = null; 
                }
                if (Object.keys(updateData).length > 0) {
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: updateData as Prisma.UserUpdateInput,
                        include: { settings: { select: userSettingsBaseSelect } }
                    }) as UserWithBaseSettings;
                    console.log(`[Handle Users API] User details updated for user ${user.id}. Auth method: ${(user as any).authMethod}`);
                }
            }
        }
      }
    }

    if (!user) {
      console.log('[Handle Users API] User not found, creating new user:', userId, 'AuthMethod:', authMethod);
      try {
        const createData: any = {
            id: userId, 
            email: email, 
            name: name || (email ? email.split('@')[0] : `User ${userId.substring(0,5)}`),
            googleId: authMethod === 'google' ? googleId : null,
            picture: authMethod === 'google' ? picture : null,
            settings: {
              create: {
                theme: 'light',
                language: 'en',
                notifications: true,
                settings: Prisma.JsonNull 
              }
            }
          };
        if (authMethod) createData.authMethod = authMethod;

        user = await prisma.user.create({
          data: createData as Prisma.UserCreateInput,
          include: { settings: { select: userSettingsBaseSelect } }
        }) as UserWithBaseSettings;
        console.log(`[Handle Users API] New user created. ID: ${user.id}, AuthMethod: ${(user as any).authMethod}`);
      } catch (createError: any) {
        if (createError instanceof Prisma.PrismaClientKnownRequestError && createError.code === 'P2002') { 
            const target = createError.meta?.target as string[] | undefined;
            console.error(`[Handle Users API] Create user P2002 error on fields: ${target?.join(', ')}.`, createError);
            if (email) user = await prisma.user.findUnique({ where: { email }, include: { settings: { select: userSettingsBaseSelect } }}) as UserWithBaseSettings | null;
            if (!user) user = await prisma.user.findUnique({ where: { id: userId }, include: { settings: { select: userSettingsBaseSelect } }}) as UserWithBaseSettings | null;
            if (!user) throw createError; 
            console.log('[Handle Users API] Found user after P2002, likely race condition.', user.id);
        } else {
            console.error('[Handle Users API] Error creating user:', createError);
            throw createError;
        }
      }
    } else { 
      console.log(`[Handle Users API] User ${user.id} exists. Checking for updates (AuthMethod from request: ${authMethod}).`);
      const updateData: any = {};
      if (name && name !== user.name) updateData.name = name;
      if (authMethod && authMethod !== (user as any).authMethod) updateData.authMethod = authMethod;
      if (email && email !== user.email) updateData.email = email; 

      if (authMethod === 'google') {
        if (googleId && googleId !== user.googleId) updateData.googleId = googleId;
        if (picture && picture !== user.picture) updateData.picture = picture;
      } else if (authMethod === 'deriv' || (authMethod === null && (user as any).authMethod === 'deriv')) {
        if (user.googleId !== null) updateData.googleId = null;
      }
      
      if (Object.keys(updateData).length > 0) {
        try {
          user = await prisma.user.update({
            where: { id: user.id },
            data: updateData as Prisma.UserUpdateInput,
            include: { settings: { select: userSettingsBaseSelect } }
          }) as UserWithBaseSettings;
          console.log(`[Handle Users API] User ${user.id} info updated. New authMethod: ${(user as any).authMethod}`);
        } catch (error) {
          console.error(`[Handle Users API] Error updating user ${user.id}:`, error); 
        }
      }
    }

    if (!user) {
        console.error('[Handle Users API] User is null before final response construction.');
        return NextResponse.json(
            { success: false, error: 'User processing resulted in a null user object.' },
            { status: 500 }
        );
    }

    const responseUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        authMethod: (user as any).authMethod !== undefined ? String((user as any).authMethod) : null,
        picture: user.picture,
    };

    return NextResponse.json({
      success: true,
      message: 'User processed successfully',
      user: responseUser
    });
  } catch (error) {
    console.error('[Handle Users API] Root error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process user', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 