// db/database.ts - SQLite database for tracking processed videos
import { Logger } from "../utils/logger.ts";

export interface ProcessedVideo {
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
	tags?: string; // JSON string of tag array
	summary_content?: string; // Summary text content
	thumbnail_url?: string;
	duration?: string;
	status?: string; // 'pending' | 'processing' | 'completed' | 'failed'
	progress?: number;
	word_count?: number;
	file_size?: number;
	processing_time?: number;
	error_message?: string;
}

// SQLite database interface to avoid 'any' type
interface SQLiteDatabase {
	exec(sql: string): void;
	prepare(sql: string): SQLiteStatement;
	close(): void;
}

interface SQLiteStatement {
	get(...params: unknown[]): Record<string, unknown> | undefined;
	all(...params: unknown[]): Record<string, unknown>[];
	run(...params: unknown[]): { changes: number };
}

export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseError";
	}
}

export class Database {
	private db!: SQLiteDatabase; // SQLite database instance (initialized in initDatabase)
	private logger: Logger;
	private dbPath: string;

	constructor(dbPath: string = "./data/processed_videos.db") {
		this.dbPath = dbPath;
		this.logger = Logger.getInstance();
	}

	/**
	 * Initialize the database and create tables if they don't exist
	 */
	async initDatabase(): Promise<void> {
		try {
			// Import SQLite module
			const { Database: SqliteDatabase } = await import(
				"https://deno.land/x/sqlite3@0.11.1/mod.ts"
			);

			// Ensure data directory exists
			await this.ensureDataDirectory();

			// Open database connection
			this.db = new SqliteDatabase(this.dbPath) as unknown as SQLiteDatabase;

			// Create table if it doesn't exist
			this.createTables();

			this.logger.debug(`Database initialized at: ${this.dbPath}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new DatabaseError(`Failed to initialize database: ${errorMessage}`);
		}
	}

	/**
	 * Create the processed_videos table
	 */
	private createTables(): void {
		const createTableSQL = `
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
		`;

		try {
			this.db.exec(createTableSQL);

			// Create index on video_id for faster lookups
			this.db.exec("CREATE INDEX IF NOT EXISTS idx_video_id ON processed_videos(video_id)");

			// Create index on raindrop_bookmark_id
			this.db.exec(
				"CREATE INDEX IF NOT EXISTS idx_raindrop_id ON processed_videos(raindrop_bookmark_id)",
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new DatabaseError(`Failed to create tables: ${errorMessage}`);
		}
	}

	/**
	 * Check if a video has already been processed
	 */
	isVideoProcessed(videoId: string): boolean {
		try {
			const stmt = this.db.prepare(
				"SELECT COUNT(*) as count FROM processed_videos WHERE video_id = ?",
			);
			const result = stmt.get(videoId);
			return !!(result && typeof result.count === "number" && result.count > 0);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Error checking if video is processed: ${errorMessage}`);
			return false; // Default to false to allow processing
		}
	}

	/**
	 * Check if a Raindrop bookmark has already been processed
	 */
	isBookmarkProcessed(raindropBookmarkId: string): boolean {
		try {
			const stmt = this.db.prepare(
				"SELECT COUNT(*) as count FROM processed_videos WHERE raindrop_bookmark_id = ?",
			);
			const result = stmt.get(raindropBookmarkId);
			return !!(result && typeof result.count === "number" && result.count > 0);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Error checking if bookmark is processed: ${errorMessage}`);
			return false;
		}
	}

	/**
	 * Mark a video as processed
	 */
	markVideoProcessed(processedVideo: Omit<ProcessedVideo, "id">): void {
		try {
			const stmt = this.db.prepare(`
				INSERT OR REPLACE INTO processed_videos 
				(video_id, url, title, summary_file_path, processed_at, raindrop_bookmark_id,
				 generated, raindrop_created, domain, tags, summary_content, thumbnail_url,
				 duration, status, progress, word_count, file_size, processing_time, error_message)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);

			stmt.run(
				processedVideo.video_id,
				processedVideo.url,
				processedVideo.title,
				processedVideo.summary_file_path,
				processedVideo.processed_at,
				processedVideo.raindrop_bookmark_id,
				processedVideo.generated,
				processedVideo.raindrop_created,
				processedVideo.domain,
				processedVideo.tags ? JSON.stringify(processedVideo.tags) : null,
				processedVideo.summary_content,
				processedVideo.thumbnail_url,
				processedVideo.duration,
				processedVideo.status || 'completed',
				processedVideo.progress || 100,
				processedVideo.word_count,
				processedVideo.file_size,
				processedVideo.processing_time,
				processedVideo.error_message,
			);

			this.logger.debug(`Marked video as processed: ${processedVideo.video_id}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new DatabaseError(`Failed to mark video as processed: ${errorMessage}`);
		}
	}

	/**
	 * Get all processed videos
	 */
	getProcessedVideos(limit?: number): ProcessedVideo[] {
		try {
			let sql = "SELECT * FROM processed_videos ORDER BY processed_at DESC";
			if (limit) {
				sql += ` LIMIT ${limit}`;
			}

			const stmt = this.db.prepare(sql);
			const results = stmt.all();

			return results.map((row: Record<string, unknown>) => {
				const tagsString = row.tags ? String(row.tags) : null;
				let parsedTags: string[] = [];
				if (tagsString) {
					try {
						parsedTags = JSON.parse(tagsString);
					} catch {
						parsedTags = [];
					}
				}

				return {
					id: typeof row.id === "number" ? row.id : undefined,
					video_id: String(row.video_id || ""),
					url: String(row.url || ""),
					title: String(row.title || ""),
					summary_file_path: String(row.summary_file_path || ""),
					processed_at: String(row.processed_at || ""),
					raindrop_bookmark_id: String(row.raindrop_bookmark_id || ""),
					generated: row.generated ? String(row.generated) : undefined,
					raindrop_created: row.raindrop_created ? String(row.raindrop_created) : undefined,
					domain: row.domain ? String(row.domain) : undefined,
					tags: parsedTags.length > 0 ? JSON.stringify(parsedTags) : undefined,
					summary_content: row.summary_content ? String(row.summary_content) : undefined,
					thumbnail_url: row.thumbnail_url ? String(row.thumbnail_url) : undefined,
					duration: row.duration ? String(row.duration) : undefined,
					status: row.status ? String(row.status) : undefined,
					progress: typeof row.progress === "number" ? row.progress : undefined,
					word_count: typeof row.word_count === "number" ? row.word_count : undefined,
					file_size: typeof row.file_size === "number" ? row.file_size : undefined,
					processing_time: typeof row.processing_time === "number" ? row.processing_time : undefined,
					error_message: row.error_message ? String(row.error_message) : undefined,
				};
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new DatabaseError(`Failed to get processed videos: ${errorMessage}`);
		}
	}

	/**
	 * Get processed video by video ID
	 */
	getProcessedVideo(videoId: string): ProcessedVideo | null {
		try {
			const stmt = this.db.prepare("SELECT * FROM processed_videos WHERE video_id = ?");
			const result = stmt.get(videoId);

			if (!result) {
				return null;
			}

			const tagsString = result.tags ? String(result.tags) : null;
			let parsedTags: string[] = [];
			if (tagsString) {
				try {
					parsedTags = JSON.parse(tagsString);
				} catch {
					parsedTags = [];
				}
			}

			return {
				id: typeof result.id === "number" ? result.id : undefined,
				video_id: String(result.video_id || ""),
				url: String(result.url || ""),
				title: String(result.title || ""),
				summary_file_path: String(result.summary_file_path || ""),
				processed_at: String(result.processed_at || ""),
				raindrop_bookmark_id: String(result.raindrop_bookmark_id || ""),
				generated: result.generated ? String(result.generated) : undefined,
				raindrop_created: result.raindrop_created ? String(result.raindrop_created) : undefined,
				domain: result.domain ? String(result.domain) : undefined,
				tags: parsedTags.length > 0 ? JSON.stringify(parsedTags) : undefined,
				summary_content: result.summary_content ? String(result.summary_content) : undefined,
				thumbnail_url: result.thumbnail_url ? String(result.thumbnail_url) : undefined,
				duration: result.duration ? String(result.duration) : undefined,
				status: result.status ? String(result.status) : undefined,
				progress: typeof result.progress === "number" ? result.progress : undefined,
				word_count: typeof result.word_count === "number" ? result.word_count : undefined,
				file_size: typeof result.file_size === "number" ? result.file_size : undefined,
				processing_time: typeof result.processing_time === "number" ? result.processing_time : undefined,
				error_message: result.error_message ? String(result.error_message) : undefined,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Error getting processed video: ${errorMessage}`);
			return null;
		}
	}

	/**
	 * Delete a processed video record (for cleanup or re-processing)
	 */
	deleteProcessedVideo(videoId: string): boolean {
		try {
			const stmt = this.db.prepare("DELETE FROM processed_videos WHERE video_id = ?");
			const result = stmt.run(videoId);
			return result.changes > 0;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Error deleting processed video: ${errorMessage}`);
			return false;
		}
	}

	/**
	 * Get statistics about processed videos
	 */
	getStats(): { totalProcessed: number; today: number; thisWeek: number } {
		try {
			const totalStmt = this.db.prepare("SELECT COUNT(*) as count FROM processed_videos");
			const total = totalStmt.get();

			const todayStmt = this.db.prepare(
				"SELECT COUNT(*) as count FROM processed_videos WHERE DATE(processed_at) = DATE('now')",
			);
			const today = todayStmt.get();

			const weekStmt = this.db.prepare(
				"SELECT COUNT(*) as count FROM processed_videos WHERE DATE(processed_at) >= DATE('now', '-7 days')",
			);
			const week = weekStmt.get();

			return {
				totalProcessed: typeof total?.count === "number" ? total.count : 0,
				today: typeof today?.count === "number" ? today.count : 0,
				thisWeek: typeof week?.count === "number" ? week.count : 0,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Error getting database stats: ${errorMessage}`);
			return { totalProcessed: 0, today: 0, thisWeek: 0 };
		}
	}

	/**
	 * Extract YouTube video ID from URL
	 */
	extractVideoId(url: string): string | null {
		try {
			const youtubeMatch = url.match(
				/(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/,
			);
			return youtubeMatch ? youtubeMatch[1] : null;
		} catch {
			return null;
		}
	}

	/**
	 * Ensure the data directory exists
	 */
	private async ensureDataDirectory(): Promise<void> {
		try {
			const dirPath = this.dbPath.split("/").slice(0, -1).join("/");
			if (dirPath) {
				await Deno.mkdir(dirPath, { recursive: true });
			}
		} catch (error) {
			if (!(error instanceof Deno.errors.AlreadyExists)) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new DatabaseError(`Failed to create data directory: ${errorMessage}`);
			}
		}
	}

	/**
	 * Close database connection
	 */
	close(): void {
		if (this.db) {
			this.db.close();
			this.logger.debug("Database connection closed");
		}
	}
}
