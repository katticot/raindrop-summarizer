// api/raindrop.ts - Raindrop.io API integration
import { RaindropItem, RaindropResponse } from "../types.ts";
import { Logger } from "../utils/logger.ts";

export class RaindropAPIError extends Error {
	constructor(message: string, public statusCode?: number) {
		super(message);
		this.name = "RaindropAPIError";
	}
}

export class RaindropAPI {
	private static readonly API_BASE_URL = "https://api.raindrop.io/rest/v1";
	private static readonly DEFAULT_PER_PAGE = 50; // Maximum allowed by Raindrop API
	private static readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests

	private logger: Logger;
	private token: string;

	constructor(token: string) {
		this.token = token;
		this.logger = Logger.getInstance();
	}

	/**
	 * Fetch all bookmarks from a collection with pagination and rate limiting
	 */
	async fetchBookmarks(
		collectionId: string,
		tag?: string,
		maxItems?: number,
	): Promise<RaindropItem[]> {
		this.logger.bookmark(
			`Fetching bookmarks from collection ${collectionId}${tag ? ` with tag #${tag}` : ""}`,
		);

		let allBookmarks: RaindropItem[] = [];
		let page = 0;
		let hasMore = true;

		while (hasMore && (!maxItems || allBookmarks.length < maxItems)) {
			try {
				const bookmarks = await this.fetchBookmarksPage(collectionId, tag, page);

				if (bookmarks.length === 0) {
					hasMore = false;
					break;
				}

				allBookmarks = allBookmarks.concat(bookmarks);
				this.logger.debug(
					`Fetched page ${
						page + 1
					}, got ${bookmarks.length} bookmarks (total: ${allBookmarks.length})`,
				);

				// Check if we got a full page (indicating more results might be available)
				hasMore = bookmarks.length === RaindropAPI.DEFAULT_PER_PAGE;
				page++;

				// Rate limiting - only apply delay if we need more data
				if (hasMore && (!maxItems || allBookmarks.length < maxItems)) {
					await this.delay(RaindropAPI.RATE_LIMIT_DELAY);
				}
			} catch (error) {
				if (error instanceof RaindropAPIError) {
					throw error;
				}
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new RaindropAPIError(`Failed to fetch bookmarks: ${errorMessage}`);
			}
		}

		// Trim to max items if specified
		if (maxItems && allBookmarks.length > maxItems) {
			allBookmarks = allBookmarks.slice(0, maxItems);
		}

		this.logger.success(`Successfully fetched ${allBookmarks.length} bookmarks`);
		return allBookmarks;
	}

	/**
	 * Fetch a single page of bookmarks
	 */
	private async fetchBookmarksPage(
		collectionId: string,
		tag?: string,
		page: number = 0,
	): Promise<RaindropItem[]> {
		const url = this.buildURL(collectionId, tag, page);

		this.logger.debug(`Requesting: ${url}`);

		const response = await fetch(url, {
			headers: {
				"Authorization": `Bearer ${this.token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

			try {
				const errorData = await response.json();
				if (errorData.message) {
					errorMessage = errorData.message;
				}
			} catch {
				// Ignore JSON parsing errors, use default message
			}

			// Provide helpful error messages for common issues
			if (response.status === 401) {
				errorMessage =
					"Invalid Raindrop token. Please check your RAINDROP_TOKEN environment variable.";
			} else if (response.status === 403) {
				errorMessage = "Access denied. Please check your Raindrop token permissions.";
			} else if (response.status === 404) {
				errorMessage =
					`Collection not found. Please check if collection ID "${collectionId}" exists and is accessible.`;
			}

			throw new RaindropAPIError(errorMessage, response.status);
		}

		const data: RaindropResponse = await response.json();
		return data.items || [];
	}

	/**
	 * Build API URL with query parameters
	 */
	private buildURL(collectionId: string, tag?: string, page: number = 0): string {
		const url = `${RaindropAPI.API_BASE_URL}/raindrops/${collectionId}`;

		const params = new URLSearchParams({
			perpage: RaindropAPI.DEFAULT_PER_PAGE.toString(),
			page: page.toString(),
		});

		// Add tag search if specified
		if (tag) {
			params.append("search", `#${tag}`);
		}

		return `${url}?${params.toString()}`;
	}

	/**
	 * Test API connection and token validity
	 */
	async testConnection(): Promise<boolean> {
		try {
			this.logger.debug("Testing Raindrop API connection...");

			const response = await fetch(`${RaindropAPI.API_BASE_URL}/user`, {
				headers: {
					"Authorization": `Bearer ${this.token}`,
					"Content-Type": "application/json",
				},
			});

			if (response.ok) {
				const userData = await response.json();
				this.logger.debug(`Connected as: ${userData.user?.fullName || "Unknown user"}`);
				return true;
			} else {
				this.logger.error(`API test failed: HTTP ${response.status}`);
				return false;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`API test failed: ${errorMessage}`);
			return false;
		}
	}

	/**
	 * Get collection information
	 */
	async getCollectionInfo(collectionId: string): Promise<{ title: string; count: number } | null> {
		try {
			const url = collectionId === "0"
				? `${RaindropAPI.API_BASE_URL}/raindrops/0`
				: `${RaindropAPI.API_BASE_URL}/collection/${collectionId}`;

			const response = await fetch(url, {
				headers: {
					"Authorization": `Bearer ${this.token}`,
					"Content-Type": "application/json",
				},
			});

			if (response.ok) {
				const data = await response.json();
				if (collectionId === "0") {
					return { title: "All Bookmarks", count: data.count || 0 };
				} else {
					return {
						title: data.item?.title || "Unknown Collection",
						count: data.item?.count || 0,
					};
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.debug(`Could not fetch collection info: ${errorMessage}`);
		}
		return null;
	}

	/**
	 * Update bookmark tags
	 */
	async updateBookmarkTags(bookmarkId: string, tags: string[]): Promise<boolean> {
		try {
			this.logger.debug(`Updating tags for bookmark ${bookmarkId}`);

			const url = `${RaindropAPI.API_BASE_URL}/raindrop/${bookmarkId}`;

			const response = await fetch(url, {
				method: "PUT",
				headers: {
					"Authorization": `Bearer ${this.token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					tags: tags,
				}),
			});

			if (response.ok) {
				this.logger.debug(`Successfully updated tags for bookmark ${bookmarkId}`);
				return true;
			} else {
				const errorText = await response.text();
				this.logger.error(`Failed to update bookmark tags: HTTP ${response.status} - ${errorText}`);
				return false;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error updating bookmark tags: ${errorMessage}`);
			return false;
		}
	}

	/**
	 * Fetch bookmarks with early termination when enough videos are found
	 */
	async fetchBookmarksWithVideoFiltering(
		collectionId: string,
		tag?: string,
		maxVideos?: number,
		videoDetector?: { isVideoBookmark: (bookmark: RaindropItem) => boolean },
	): Promise<RaindropItem[]> {
		if (!videoDetector || !maxVideos) {
			// Fallback to regular fetching if no video detector or max videos specified
			return this.fetchBookmarks(collectionId, tag, maxVideos ? maxVideos * 3 : undefined);
		}

		this.logger.bookmark(
			`Smart fetching: looking for ${maxVideos} videos from collection ${collectionId}${
				tag ? ` with tag #${tag}` : ""
			}`,
		);

		let allBookmarks: RaindropItem[] = [];
		let videoCount = 0;
		let page = 0;
		let hasMore = true;

		while (hasMore && videoCount < maxVideos) {
			try {
				const bookmarks = await this.fetchBookmarksPage(collectionId, tag, page);

				if (bookmarks.length === 0) {
					hasMore = false;
					break;
				}

				// Filter and count videos in this batch
				const videosInBatch = bookmarks.filter((bookmark) =>
					videoDetector.isVideoBookmark(bookmark)
				);
				videoCount += videosInBatch.length;

				allBookmarks = allBookmarks.concat(bookmarks);
				this.logger.debug(
					`Fetched page ${
						page + 1
					}, got ${bookmarks.length} bookmarks, ${videosInBatch.length} videos (total videos: ${videoCount})`,
				);

				// Check if we have enough videos or got a full page
				hasMore = bookmarks.length === RaindropAPI.DEFAULT_PER_PAGE;
				page++;

				// Early termination if we have enough videos
				if (videoCount >= maxVideos) {
					this.logger.debug(`Found ${videoCount} videos, stopping early`);
					hasMore = false;
				}

				// Rate limiting - only apply delay if we need more data
				if (hasMore) {
					await this.delay(RaindropAPI.RATE_LIMIT_DELAY);
				}
			} catch (error) {
				if (error instanceof RaindropAPIError) {
					throw error;
				}
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new RaindropAPIError(`Failed to fetch bookmarks: ${errorMessage}`);
			}
		}

		this.logger.success(
			`Successfully fetched ${allBookmarks.length} bookmarks with ${videoCount} videos`,
		);
		return allBookmarks;
	}

	/**
	 * Simple delay helper for rate limiting
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
