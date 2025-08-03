import { NextRequest, NextResponse } from 'next/server';
import { getVideoDatabase } from '@/services/database';
import { promises as fs } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if Raindrop token is configured
    if (!process.env.RAINDROP_TOKEN) {
      return NextResponse.json(
        { error: 'Raindrop token not configured' },
        { status: 500 }
      );
    }

    const { id } = await params;
    const db = getVideoDatabase();
    const video = await db.getVideoById(id);
    
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Read full summary content
    let fullSummary = '';
    if (video.summaryPath) {
      try {
        fullSummary = await fs.readFile(video.summaryPath, 'utf-8');
      } catch (error) {
        console.error('Error reading summary file:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      video: {
        ...video,
        fullSummary
      }
    });

  } catch (error) {
    console.error('Video detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video details' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if Raindrop token is configured
    if (!process.env.RAINDROP_TOKEN) {
      return NextResponse.json(
        { error: 'Raindrop token not configured' },
        { status: 500 }
      );
    }

    const { id } = await params;
    const db = getVideoDatabase();
    const success = await db.deleteVideo(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete video or video not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully'
    });

  } catch (error) {
    console.error('Video delete API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    );
  }
}