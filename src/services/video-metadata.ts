import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Database, ProcessedVideo } from '../db/database.ts';

export interface Video {
  id: string;
  title: string;
  url: string;
  videoId: string;
  thumbnail?: string;
  duration?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  createdAt: string;
  processedAt?: string;
  tags: string[];
  summary?: string;
  summaryPath?: string;
  metadata: VideoMetadata;
}

export interface VideoMetadata {
  generated: string;
  raindropCreated: string;
  domain: string;
  fileSize?: number;
  wordCount?: number;
  processingTime?: number;
  error?: string;
}

export interface VideoFilters {
  status?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
}

export interface SortOption {
  field: 'date' | 'title' | 'status';
  direction: 'asc' | 'desc';
}

export class VideoMetadataService {
  private database: Database;

  constructor(dbPath?: string) {
    this.database = new Database(dbPath);
  }

  async init(): Promise<void> {
    await this.database.initDatabase();
  }

  async getAllVideos(): Promise<Video[]> {
    try {
      const processedVideos = this.database.getProcessedVideos();
      return processedVideos.map(pv => this.convertToVideo(pv));
    } catch (error) {
      console.error('Error getting all videos:', error);
      return [];
    }
  }

  async getVideoById(id: string): Promise<Video | null> {
    try {
      const processedVideo = this.database.getProcessedVideo(id);
      return processedVideo ? this.convertToVideo(processedVideo) : null;
    } catch (error) {
      console.error(`Error getting video ${id}:`, error);
      return null;
    }
  }

  async searchVideos(query: string): Promise<Video[]> {
    if (!query?.trim()) {
      return this.getAllVideos();
    }

    try {
      const videos = await this.getAllVideos();
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);

      return videos.filter(video => {
        const searchableText = [
          video.title,
          video.summary || '',
          ...video.tags
        ].join(' ').toLowerCase();

        return searchTerms.some(term => searchableText.includes(term));
      });
    } catch (error) {
      console.error('Error searching videos:', error);
      return [];
    }
  }

  async filterVideos(filters: VideoFilters): Promise<Video[]> {
    try {
      let videos = await this.getAllVideos();

      if (filters.status && filters.status.length > 0) {
        videos = videos.filter(video => filters.status!.includes(video.status));
      }

      if (filters.tags && filters.tags.length > 0) {
        videos = videos.filter(video => 
          filters.tags!.some(tag => video.tags.includes(tag))
        );
      }

      if (filters.dateRange) {
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        videos = videos.filter(video => {
          const videoDate = new Date(video.createdAt);
          return videoDate >= startDate && videoDate <= endDate;
        });
      }

      return videos;
    } catch (error) {
      console.error('Error filtering videos:', error);
      return [];
    }
  }

  async sortVideos(videos: Video[], sortOption: SortOption): Promise<Video[]> {
    const { field, direction } = sortOption;
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...videos].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (field) {
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

  async deleteVideo(id: string): Promise<boolean> {
    try {
      const video = await this.getVideoById(id);
      if (!video) {
        return false;
      }

      // Delete the file if it exists
      if (video.summaryPath) {
        try {
          await fs.unlink(video.summaryPath);
        } catch {
          // File may not exist, continue with database deletion
        }
      }

      // Delete from database
      return this.database.deleteProcessedVideo(id);
    } catch (error) {
      console.error(`Error deleting video ${id}:`, error);
      return false;
    }
  }

  async getVideoTags(): Promise<string[]> {
    try {
      const videos = await this.getAllVideos();
      const allTags = videos.flatMap(video => video.tags);
      return [...new Set(allTags)].sort();
    } catch (error) {
      console.error('Error getting video tags:', error);
      return [];
    }
  }


  private convertToVideo(pv: ProcessedVideo): Video {
    let tags: string[] = [];
    if (pv.tags) {
      try {
        tags = JSON.parse(pv.tags);
      } catch {
        tags = [];
      }
    }

    const thumbnail = pv.thumbnail_url || this.extractThumbnailUrl(pv.url, pv.video_id);

    return {
      id: pv.video_id,
      title: pv.title,
      url: pv.url,
      videoId: pv.video_id,
      thumbnail,
      duration: pv.duration,
      status: (pv.status as any) || 'completed',
      progress: pv.progress || 100,
      createdAt: pv.raindrop_created || pv.processed_at,
      processedAt: pv.generated || pv.processed_at,
      tags,
      summary: pv.summary_content,
      summaryPath: pv.summary_file_path,
      metadata: {
        generated: pv.generated || pv.processed_at,
        raindropCreated: pv.raindrop_created || pv.processed_at,
        domain: pv.domain || '',
        wordCount: pv.word_count,
        fileSize: pv.file_size,
        processingTime: pv.processing_time,
        error: pv.error_message
      }
    };
  }

  private extractThumbnailUrl(videoUrl: string, videoId: string): string {
    // For YouTube videos, generate thumbnail URL
    if (videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be')) {
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
    
    // Default placeholder for other platforms
    return '/api/placeholder/video-thumbnail';
  }

  async paginateVideos(
    videos: Video[], 
    page: number = 1, 
    limit: number = 20
  ): Promise<{
    videos: Video[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const total = videos.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedVideos = videos.slice(startIndex, endIndex);
    
    return {
      videos: paginatedVideos,
      total,
      page,
      limit,
      hasNext: endIndex < total,
      hasPrev: page > 1
    };
  }
}