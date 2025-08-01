// tag-updater.ts - Update Raindrop tags from markdown files
import { RaindropAPI } from "../api/raindrop.ts";
import { YamlParser } from "./yaml-parser.ts";
import { Logger } from "./logger.ts";
import { RaindropItem } from "../types.ts";

export interface TagUpdateResult {
	filePath: string;
	videoUrl: string;
	bookmarkId?: string;
	tagsUpdated: boolean;
	originalTags: string[];
	newTags: string[];
	error?: string;
}

export interface TagUpdateStats {
	totalFiles: number;
	validFiles: number;
	matchedBookmarks: number;
	successfulUpdates: number;
	failedUpdates: number;
	results: TagUpdateResult[];
}

export class TagUpdater {
	private logger: Logger;
	private yamlParser: YamlParser;
	private raindropAPI: RaindropAPI;

	constructor(raindropAPI: RaindropAPI) {
		this.logger = Logger.getInstance();
		this.yamlParser = new YamlParser();
		this.raindropAPI = raindropAPI;
	}

	/**
	 * Update Raindrop tags from all markdown files in a directory
	 */
	async updateTagsFromDirectory(
		summariesPath: string,
		collectionId: string = "0",
	): Promise<TagUpdateStats> {
		this.logger.info(`🏷️  Updating Raindrop tags from markdown files in ${summariesPath}`);

		const stats: TagUpdateStats = {
			totalFiles: 0,
			validFiles: 0,
			matchedBookmarks: 0,
			successfulUpdates: 0,
			failedUpdates: 0,
			results: [],
		};

		try {
			// Get all markdown files
			const markdownFiles = await this.yamlParser.getMarkdownFiles(summariesPath);
			stats.totalFiles = markdownFiles.length;

			if (markdownFiles.length === 0) {
				this.logger.warn(`No markdown files found in ${summariesPath}`);
				return stats;
			}

			this.logger.info(`Found ${markdownFiles.length} markdown files to process`);

			// Fetch all bookmarks from Raindrop to match against
			this.logger.info("Fetching bookmarks from Raindrop...");
			const bookmarks = await this.fetchAllBookmarks(collectionId);
			this.logger.info(`Fetched ${bookmarks.length} bookmarks from Raindrop`);

			// Process each markdown file
			for (const filePath of markdownFiles) {
				const result = await this.processMarkdownFile(filePath, bookmarks);
				stats.results.push(result);

				if (result.error) {
					stats.failedUpdates++;
					this.logger.error(`❌ ${filePath.split("/").pop()}: ${result.error}`);
				} else if (result.tagsUpdated) {
					stats.successfulUpdates++;
					stats.matchedBookmarks++;
					this.logger.success(
						`✅ ${filePath.split("/").pop()}: Updated ${result.newTags.length} tags`,
					);
				} else {
					this.logger.warn(`⚠️  ${filePath.split("/").pop()}: No matching bookmark found`);
				}
			}

			// Count valid files
			stats.validFiles = stats.results.filter((r) => !r.error).length;
			stats.matchedBookmarks = stats.results.filter((r) => r.bookmarkId).length;
		} catch (error) {
			this.logger.error(`Failed to update tags from directory: ${error}`);
		}

		return stats;
	}

	/**
	 * Process a single markdown file and update its corresponding bookmark
	 */
	private async processMarkdownFile(
		filePath: string,
		bookmarks: RaindropItem[],
	): Promise<TagUpdateResult> {
		const result: TagUpdateResult = {
			filePath,
			videoUrl: "",
			tagsUpdated: false,
			originalTags: [],
			newTags: [],
		};

		try {
			// Parse the markdown file
			const parsed = await this.yamlParser.parseMarkdownFile(filePath);
			if (!parsed) {
				result.error = "Failed to parse markdown file";
				return result;
			}

			// Validate the file has required data
			if (!this.yamlParser.isValidForTagUpdate(parsed)) {
				result.error = "Missing required front matter (url or tags)";
				return result;
			}

			// Extract video URL
			const videoUrl = this.yamlParser.extractVideoUrl(parsed);
			if (!videoUrl) {
				result.error = "Could not extract video URL";
				return result;
			}
			result.videoUrl = videoUrl;

			// Find matching bookmark
			const matchedBookmark = this.findMatchingBookmark(videoUrl, bookmarks);
			if (!matchedBookmark) {
				result.error = "No matching bookmark found in Raindrop";
				return result;
			}
			result.bookmarkId = matchedBookmark._id;

			// Get tags from the markdown file
			const markdownTags = this.yamlParser.getTagsForSync(parsed);
			result.newTags = markdownTags;
			result.originalTags = matchedBookmark.tags || [];

			// Check if tags need updating
			if (this.areTagsEqual(result.originalTags, markdownTags)) {
				this.logger.debug(`Tags are already up to date for ${filePath}`);
				result.tagsUpdated = false;
				return result;
			}

			// Update the bookmark tags
			const updateSuccess = await this.raindropAPI.updateBookmarkTags(
				matchedBookmark._id,
				markdownTags,
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
		this.logger.info(`   Total Files: ${stats.totalFiles}`);
		this.logger.info(`   Valid Files: ${stats.validFiles}`);
		this.logger.info(`   Matched Bookmarks: ${stats.matchedBookmarks}`);
		this.logger.info(`   Successful Updates: ${stats.successfulUpdates}`);

		if (stats.failedUpdates > 0) {
			this.logger.info(`   Failed Updates: ${stats.failedUpdates}`);
		}

		if (stats.successfulUpdates > 0) {
			this.logger.success(
				`\n✅ Successfully updated ${stats.successfulUpdates} bookmarks with tags from markdown files`,
			);
		}

		if (stats.failedUpdates > 0) {
			this.logger.warn(`\n⚠️  ${stats.failedUpdates} files could not be processed or updated`);
		}
	}
}
