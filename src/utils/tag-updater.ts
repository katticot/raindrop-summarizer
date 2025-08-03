// tag-updater.ts - Update Raindrop tags from database
import { RaindropAPI } from "../api/raindrop.ts";
import { Database, ProcessedVideo } from "../db/database.ts";
import { Logger } from "./logger.ts";
import { RaindropItem } from "../types.ts";

export interface TagUpdateResult {
	videoId: string;
	videoUrl: string;
	bookmarkId?: string;
	tagsUpdated: boolean;
	originalTags: string[];
	newTags: string[];
	error?: string;
}

export interface TagUpdateStats {
	totalVideos: number;
	validVideos: number;
	matchedBookmarks: number;
	successfulUpdates: number;
	failedUpdates: number;
	results: TagUpdateResult[];
}

export class TagUpdater {
	private logger: Logger;
	private database: Database;
	private raindropAPI: RaindropAPI;

	constructor(raindropAPI: RaindropAPI, database: Database) {
		this.logger = Logger.getInstance();
		this.database = database;
		this.raindropAPI = raindropAPI;
	}

	/**
	 * Update Raindrop tags from all videos in database
	 */
	async updateTagsFromDatabase(
		collectionId: string = "0",
	): Promise<TagUpdateStats> {
		this.logger.info(`🏷️  Updating Raindrop tags from processed videos in database`);

		const stats: TagUpdateStats = {
			totalVideos: 0,
			validVideos: 0,
			matchedBookmarks: 0,
			successfulUpdates: 0,
			failedUpdates: 0,
			results: [],
		};

		try {
			// Get all processed videos from database
			const processedVideos = this.database.getProcessedVideos();
			stats.totalVideos = processedVideos.length;

			if (processedVideos.length === 0) {
				this.logger.warn(`No processed videos found in database`);
				return stats;
			}

			this.logger.info(`Found ${processedVideos.length} processed videos to sync`);

			// Fetch all bookmarks from Raindrop to match against
			this.logger.info("Fetching bookmarks from Raindrop...");
			const bookmarks = await this.fetchAllBookmarks(collectionId);
			this.logger.info(`Fetched ${bookmarks.length} bookmarks from Raindrop`);

			// Process each video from database
			for (const video of processedVideos) {
				const result = await this.processVideoFromDatabase(video, bookmarks);
				stats.results.push(result);

				if (result.error) {
					stats.failedUpdates++;
					this.logger.error(`❌ ${video.video_id}: ${result.error}`);
				} else if (result.tagsUpdated) {
					stats.successfulUpdates++;
					stats.matchedBookmarks++;
					const tagChange = result.originalTags.length !== result.newTags.length 
						? ` (${result.originalTags.length} → ${result.newTags.length} tags)`
						: ` (${result.newTags.length} tags)`;
					this.logger.success(
						`✅ ${video.video_id}: Force updated${tagChange}`,
					);
				} else {
					this.logger.warn(`⚠️  ${video.video_id}: No matching bookmark found`);
				}
			}

			// Count valid videos
			stats.validVideos = stats.results.filter((r) => !r.error).length;
			stats.matchedBookmarks = stats.results.filter((r) => r.bookmarkId).length;
		} catch (error) {
			this.logger.error(`Failed to update tags from database: ${error}`);
		}

		return stats;
	}

	/**
	 * Process a single video from database and update its corresponding bookmark
	 */
	private async processVideoFromDatabase(
		video: ProcessedVideo,
		bookmarks: RaindropItem[],
	): Promise<TagUpdateResult> {
		const result: TagUpdateResult = {
			videoId: video.video_id,
			videoUrl: video.url,
			tagsUpdated: false,
			originalTags: [],
			newTags: [],
		};

		try {
			// Validate the video has required data
			if (!video.url || !video.tags) {
				result.error = "Missing required data (url or tags)";
				return result;
			}

			// Find matching bookmark
			const matchedBookmark = this.findMatchingBookmark(video.url, bookmarks);
			if (!matchedBookmark) {
				result.error = "No matching bookmark found in Raindrop";
				return result;
			}
			result.bookmarkId = matchedBookmark._id;

			// Get tags from the database
			let videoTags: string[] = [];
			try {
				videoTags = JSON.parse(video.tags);
			} catch {
				result.error = "Invalid tags format in database";
				return result;
			}

			result.newTags = videoTags;
			result.originalTags = matchedBookmark.tags || [];

			// Force update tags to ensure sync with generated tags and apply 10-tag limit
			// Note: We force updates to ensure all bookmarks reflect the latest tags from AI
			this.logger.debug(`Force updating tags for ${video.video_id} (${videoTags.length} tags)`);
			
			// Log the tag changes for transparency
			if (result.originalTags.length !== videoTags.length || !this.areTagsEqual(result.originalTags, videoTags)) {
				this.logger.debug(`Tag changes: ${result.originalTags.length} → ${videoTags.length} tags`);
			}

			// Update the bookmark tags
			const updateSuccess = await this.raindropAPI.updateBookmarkTags(
				matchedBookmark._id,
				videoTags,
			);

			if (updateSuccess) {
				result.tagsUpdated = true;
				this.logger.debug(`Successfully updated tags for ${matchedBookmark.title}`);
			} else {
				result.error = "Failed to update bookmark tags via API";
			}
		} catch (error) {
			result.error = `Processing error: ${error}`;
		}

		return result;
	}

	/**
	 * Find a bookmark that matches the given video URL
	 */
	private findMatchingBookmark(videoUrl: string, bookmarks: RaindropItem[]): RaindropItem | null {
		// Normalize URLs for comparison
		const normalizeUrl = (url: string): string => {
			return url.toLowerCase()
				.replace(/^https?:\/\//, "")
				.replace(/^www\./, "")
				.replace(/\/$/, "")
				.replace(/&.*$/, "") // Remove query parameters after &
				.replace(/\?.*$/, ""); // Remove query parameters after ?
		};

		const normalizedTarget = normalizeUrl(videoUrl);

		for (const bookmark of bookmarks) {
			const normalizedBookmark = normalizeUrl(bookmark.link);

			if (normalizedBookmark === normalizedTarget) {
				return bookmark;
			}

			// Also try to match by video ID for YouTube URLs
			if (this.extractVideoId(videoUrl) && this.extractVideoId(bookmark.link)) {
				if (this.extractVideoId(videoUrl) === this.extractVideoId(bookmark.link)) {
					return bookmark;
				}
			}
		}

		return null;
	}

	/**
	 * Extract video ID from various video platforms (same logic as in Python script)
	 */
	private extractVideoId(videoUrl: string): string | null {
		// YouTube patterns
		const youtubePatterns = [
			/(?:https?:\/\/)?(?:www\.)?(?:m\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
			/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^&\n?#]+)/,
			/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)/,
		];

		for (const pattern of youtubePatterns) {
			const match = videoUrl.match(pattern);
			if (match) {
				return match[1];
			}
		}

		// Vimeo pattern
		const vimeoMatch = videoUrl.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
		if (vimeoMatch) {
			return vimeoMatch[1];
		}

		return null;
	}

	/**
	 * Check if two tag arrays are equal (order-independent)
	 */
	private areTagsEqual(tags1: string[], tags2: string[]): boolean {
		if (tags1.length !== tags2.length) {
			return false;
		}

		const sorted1 = [...tags1].sort();
		const sorted2 = [...tags2].sort();

		return sorted1.every((tag, index) => tag === sorted2[index]);
	}

	/**
	 * Fetch all bookmarks from Raindrop (handles pagination)
	 */
	private async fetchAllBookmarks(collectionId: string): Promise<RaindropItem[]> {
		// The fetchBookmarks method already handles pagination internally
		return await this.raindropAPI.fetchBookmarks(collectionId);
	}

	/**
	 * Show update statistics
	 */
	showUpdateStats(stats: TagUpdateStats): void {
		this.logger.info("\n📊 Tag Update Statistics:");
		this.logger.info(`   Total Videos: ${stats.totalVideos}`);
		this.logger.info(`   Valid Videos: ${stats.validVideos}`);
		this.logger.info(`   Matched Bookmarks: ${stats.matchedBookmarks}`);
		this.logger.info(`   Successful Updates: ${stats.successfulUpdates}`);

		if (stats.failedUpdates > 0) {
			this.logger.info(`   Failed Updates: ${stats.failedUpdates}`);
		}

		if (stats.successfulUpdates > 0) {
			this.logger.success(
				`\n✅ Successfully updated ${stats.successfulUpdates} bookmarks with tags from database`,
			);
		}

		if (stats.failedUpdates > 0) {
			this.logger.warn(`\n⚠️  ${stats.failedUpdates} videos could not be processed or updated`);
		}
	}
}
