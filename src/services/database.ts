// services/database.ts - Database service for Next.js API routes
import Database from 'better-sqlite3';
import path from 'path';
import { Video, VideoMetadata } from './video-metadata';

interface ProcessedVideoRow {
  id?: number;
  video_id: string;
  url: string;
  title: string;
  summary_file_path: string;
  processed_at: string;
  raindrop_bookmark_id: string;
  generated?: string;
  raindrop_created?: string;
  domain?: string;
  tags?: string;
  summary_content?: string;
  thumbnail_url?: string;
  duration?: string;
  status?: string;
  progress?: number;
  word_count?: number;
  file_size?: number;
  processing_time?: number;
  error_message?: string;
}

class NodeDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), 'data', 'processed_videos.db');
    this.db = new Database(dbPath || defaultPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        summary_file_path TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        raindrop_bookmark_id TEXT NOT NULL,
        generated TEXT,
        raindrop_created TEXT,
        domain TEXT,
        tags TEXT, 
        summary_content TEXT,
        thumbnail_url TEXT,
        duration TEXT,
        status TEXT DEFAULT 'completed',
        progress INTEGER DEFAULT 100,
        word_count INTEGER,
        file_size INTEGER,
        processing_time INTEGER,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec("CREATE INDEX IF NOT EXISTS idx_video_id ON processed_videos(video_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_raindrop_id ON processed_videos(raindrop_bookmark_id)");
  }

  private convertToVideo(row: ProcessedVideoRow): Video {
    let tags: string[] = [];
    if (row.tags) {
      try {
        tags = JSON.parse(row.tags);
      } catch {
        tags = [];
      }
    }

    const thumbnail = row.thumbnail_url || this.extractThumbnailUrl(row.url, row.video_id);

    return {
      id: row.video_id,
      title: row.title,
      url: row.url,
      videoId: row.video_id,
      thumbnail,
      duration: row.duration,
      status: (row.status as any) || 'completed',
      progress: row.progress || 100,
      createdAt: row.raindrop_created || row.processed_at,
      processedAt: row.generated || row.processed_at,
      tags,
      summary: row.summary_content,
      summaryPath: row.summary_file_path,
      metadata: {
        generated: row.generated || row.processed_at,
        raindropCreated: row.raindrop_created || row.processed_at,
        domain: row.domain || '',
        wordCount: row.word_count,
        fileSize: row.file_size,
        processingTime: row.processing_time,
        error: row.error_message
      }
    };
  }

  private extractThumbnailUrl(videoUrl: string, videoId: string): string {
    if (videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be')) {
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
    return '/api/placeholder/video-thumbnail';
  }

  async getAllVideos(): Promise<Video[]> {
    const stmt = this.db.prepare('SELECT * FROM processed_videos ORDER BY processed_at DESC');
    const rows = stmt.all() as ProcessedVideoRow[];
    return rows.map(row => this.convertToVideo(row));
  }

  async getVideoById(id: string): Promise<Video | null> {
    const stmt = this.db.prepare('SELECT * FROM processed_videos WHERE video_id = ?');
    const row = stmt.get(id) as ProcessedVideoRow | undefined;
    return row ? this.convertToVideo(row) : null;
  }

  async searchVideos(query: string): Promise<Video[]> {
    if (!query?.trim()) {
      return this.getAllVideos();
    }

    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    const videos = await this.getAllVideos();

    return videos.filter(video => {
      const searchableText = [
        video.title,
        video.summary || '',
        ...video.tags
      ].join(' ').toLowerCase();

      return searchTerms.some(term => searchableText.includes(term));
    });
  }

  async deleteVideo(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM processed_videos WHERE video_id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

let nodeDatabase: NodeDatabase | null = null;

export function getVideoDatabase(): NodeDatabase {
  if (!nodeDatabase) {
    nodeDatabase = new NodeDatabase();
  }
  return nodeDatabase;
}