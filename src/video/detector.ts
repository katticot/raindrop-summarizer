// video/detector.ts - Video URL detection and validation
import { RaindropItem } from "../types.ts";
import { Logger } from "../utils/logger.ts";

export interface VideoSite {
	name: string;
	hostnames: string[];
	pattern?: RegExp;
	extractId?: (url: string) => string | null;
}

export class VideoDetector {
	private logger: Logger;
	private supportedSites: VideoSite[];

	constructor() {
		this.logger = Logger.getInstance();
		this.supportedSites = [
			{
				name: "YouTube",
				hostnames: ["youtube.com", "youtu.be", "m.youtube.com"],
				pattern: /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/,
				extractId: (url: string) => {
					const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/);
					return match ? match[1] : null;
				}
			}
		];
	}

	/**
	 * Check if a URL is a YouTube video URL
	 */
	isVideoUrl(url: string): boolean {
		try {
			const urlObj = new URL(url);
			const hostname = this.normalizeHostname(urlObj.hostname);
			
			// Check against supported hostnames
			return this.supportedSites.some(site => 
				site.hostnames.some(supportedHostname => 
					hostname.includes(supportedHostname)
				)
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.debug(`Invalid URL encountered: ${url} - ${errorMessage}`);
			return false;
		}
	}

	/**
	 * Detect YouTube video and extract metadata
	 */
	detectVideo(url: string): { platform: string; id: string | null; isValid: boolean } | null {
		try {
			const urlObj = new URL(url);
			const hostname = this.normalizeHostname(urlObj.hostname);
			
			for (const site of this.supportedSites) {
				const matchesHostname = site.hostnames.some(supportedHostname => 
					hostname.includes(supportedHostname)
				);
				
				if (matchesHostname) {
					const id = site.extractId ? site.extractId(url) : null;
					const isValid = site.pattern ? site.pattern.test(url) : true;
					
					return {
						platform: site.name,
						id,
						isValid
					};
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.debug(`Error detecting video: ${url} - ${errorMessage}`);
		}
		
		return null;
	}

	/**
	 * Filter bookmarks to only include YouTube video URLs
	 */
	filterVideoBookmarks(bookmarks: RaindropItem[]): RaindropItem[] {
		const videoBookmarks = bookmarks.filter(bookmark => this.isVideoUrl(bookmark.link));
		
		this.logger.debug(`Filtered ${bookmarks.length} bookmarks, found ${videoBookmarks.length} video URLs`);
		
		// Log platform breakdown if verbose
		if (this.logger['verbose']) {
			const platformCounts = this.getPlatformBreakdown(videoBookmarks);
			for (const [platform, count] of Object.entries(platformCounts)) {
				this.logger.debug(`  ${platform}: ${count} videos`);
			}
		}
		
		return videoBookmarks;
	}

	/**
	 * Get breakdown of YouTube videos
	 */
	getPlatformBreakdown(videoBookmarks: RaindropItem[]): Record<string, number> {
		const breakdown: Record<string, number> = {};
		
		for (const bookmark of videoBookmarks) {
			const detection = this.detectVideo(bookmark.link);
			if (detection) {
				const platform = detection.platform;
				breakdown[platform] = (breakdown[platform] || 0) + 1;
			}
		}
		
		return breakdown;
	}

	/**
	 * Generate filename for video summary
	 */
	generateFilename(url: string, title?: string): string {
		const detection = this.detectVideo(url);
		
		if (detection && detection.id) {
			// Use platform-specific ID
			return `${detection.id}-summary.md`;
		}
		
		// Fallback to URL-based filename
		try {
			const urlObj = new URL(url);
			const hostname = this.normalizeHostname(urlObj.hostname).replace(/\./g, '_');
			const pathPart = urlObj.pathname.split('/').filter(Boolean).pop() || 'video';
			return `${hostname}_${pathPart}-summary.md`;
		} catch {
			// Final fallback
			const safeName = title 
				? title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
				: 'video';
			return `${safeName}-summary.md`;
		}
	}

	/**
	 * Validate that video URL is accessible (basic check)
	 */
	async validateVideoUrl(url: string): Promise<boolean> {
		try {
			// Basic HEAD request to check if URL is accessible
			const response = await fetch(url, { method: 'HEAD' });
			return response.ok || response.status === 405; // Some sites block HEAD requests
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.debug(`URL validation failed for ${url}: ${errorMessage}`);
			return false;
		}
	}

	/**
	 * Get list of supported platforms (YouTube only)
	 */
	getSupportedPlatforms(): string[] {
		return this.supportedSites.map(site => site.name);
	}

	/**
	 * Normalize hostname by removing www. prefix
	 */
	private normalizeHostname(hostname: string): string {
		return hostname.startsWith("www.") ? hostname.substring(4) : hostname;
	}
}