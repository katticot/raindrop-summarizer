import { NextRequest, NextResponse } from 'next/server';
import { getVideoDatabase } from '@/services/database';

export async function GET(request: NextRequest) {
  try {
    // Check if Raindrop token is configured
    if (!process.env.RAINDROP_TOKEN) {
      return NextResponse.json(
        { error: 'Raindrop token not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = getVideoDatabase();
    
    let videos;
    
    // Apply search if provided
    if (search) {
      videos = await db.searchVideos(search);
    } else {
      videos = await db.getAllVideos();
    }

    // Apply basic filters (status filtering)
    if (status && status !== 'completed') {
      // For now, database only has completed videos
      videos = [];
    }

    // Apply sorting
    if (sortBy && ['date', 'title', 'status'].includes(sortBy)) {
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      videos.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortBy) {
          case 'date':
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
          case 'title':
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          default:
            return 0;
        }
        
        if (aValue < bValue) return -1 * multiplier;
        if (aValue > bValue) return 1 * multiplier;
        return 0;
      });
    }

    // Apply pagination
    const total = videos.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVideos = videos.slice(startIndex, endIndex);
    
    const paginatedResult = {
      videos: paginatedVideos,
      total,
      page,
      limit,
      hasNext: endIndex < total,
      hasPrev: page > 1
    };

    return NextResponse.json({
      success: true,
      ...paginatedResult
    });

  } catch (error) {
    console.error('Videos API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}