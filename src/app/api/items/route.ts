import { NextResponse } from 'next/server';
import { saveBrowserItem, getSavedItems } from '@/lib/db/utils';

export async function POST(request: Request) {
  try {
    const { userId, title, content, url, tags } = await request.json();
    
    if (!userId || !title || !content) {
      return NextResponse.json(
        { error: 'User ID, title, and content are required' },
        { status: 400 }
      );
    }

    const savedItem = await saveBrowserItem(userId, title, content, url, tags);
    return NextResponse.json(savedItem);
  } catch (error) {
    console.error('Error saving item:', error);
    return NextResponse.json(
      { error: 'Failed to save item' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const tag = searchParams.get('tag');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const items = await getSavedItems(userId, tag || undefined);
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
} 