// main.ts - Enhanced Raindrop Video Summarizer with modular architecture
import { CLI } from "./src/cli/cli.ts";
import { ConfigError, ConfigManager } from "./src/config/config.ts";
import { Logger } from "./src/utils/logger.ts";
import { RaindropAPI, RaindropAPIError } from "./src/api/raindrop.ts";
import { VideoDetector } from "./src/video/detector.ts";
import { PythonIntegration, PythonIntegrationError } from "./src/video/python-integration.ts";
import { TagUpdater } from "./src/utils/tag-updater.ts";
import { Database, DatabaseError } from "./src/db/database.ts";
import { CLIOptions, Config, ProcessingStats, RaindropItem } from "./src/types.ts";
import { YouTubePlaylistLister, YouTubePlaylistVideo } from "./src/youtube/playlist.ts";

class VideoSummarizer {
	private cli: CLI;
	private configManager: ConfigManager;
	private logger: Logger;
	private raindropAPI!: RaindropAPI;
	private videoDetector: VideoDetector;
	private pythonIntegration: PythonIntegration;
	private database: Database;

	constructor() {
		this.cli = new CLI();
		this.configManager = ConfigManager.getInstance();
		this.logger = Logger.getInstance();
		this.videoDetector = new VideoDetector();
		this.pythonIntegration = new PythonIntegration();
		this.database = new Database();
	}

	/**
	 * Main application entry point
	 */
	async run(): Promise<void> {
		try {
			// Parse CLI arguments
			const options = this.cli.parseArguments();

			// Handle help/version flags
			if (this.cli.handleOptions(options)) {
				return;
			}

			// Show welcome banner
			this.cli.showBanner();

			// Load and validate configuration
			const config = await this.loadConfiguration(options);

			// Initialize API client
			this.raindropAPI = new RaindropAPI(config.raindropToken);

			// Initialize database
			this.database = new Database(config.databasePath);
			await this.database.initDatabase();

			// Handle special operations
			if (options.updateTags) {
				await this.updateTagsFromMarkdown(config);
				return;
			}

			if (options.listProcessed) {
				this.listProcessedVideos();
				return;
			}

			if (options.listMyPlaylists) {
				await this.listMyPlaylists(config);
				return;
			}

			// Handle playlist operations
			if (options.playlist) {
				await this.handlePlaylistOperations(config, options);
				return;
			}

			// Test connections
			await this.testConnections();

			// Show configuration summary
			this.cli.showConfigSummary({
				collection: config.collectionId,
				maxVideos: config.maxVideos,
				tag: options.tag,
				outputPath: config.outputPath,
				dryRun: options.dryRun || false,
			});

			// Create output directory
			await this.ensureOutputDirectory(config.outputPath);

			// Process videos (only if not handling playlist operations)
			const stats = await this.processVideos(config, options);

			// Show final statistics
			this.showFinalResults(stats);
		} catch (error) {
			await this.handleError(error instanceof Error ? error : new Error(String(error)));
			Deno.exit(1);
		} finally {
			// Close database connection
			if (this.database) {
				this.database.close();
			}
		}
	}

	/**
	 * Load and validate configuration with interactive prompts if needed
	 */
	private async loadConfiguration(options: CLIOptions) {
		try {
			return await this.configManager.loadConfig(options);
		} catch (error) {
			if (error instanceof ConfigError) {
				this.logger.error("Configuration Error:", error);

				// Offer to run setup wizard
				if (await this.cli.confirm("\nWould you like to run the setup wizard?")) {
					const wizardConfig = await this.cli.promptForConfiguration();

					// Save to .env file
					if (wizardConfig.raindropToken || wizardConfig.googleCloudProjectId) {
						await this.saveConfigToEnv(wizardConfig);
						this.logger.success("Configuration saved to .env file");

						// Try loading config again
						return await this.configManager.loadConfig(options);
					}
				}

				// Create sample .env file
				await this.configManager.createSampleEnvFile();
				this.logger.info("Created .env.example file for reference");
			}
			throw error;
		}
	}

	/**
	 * Test API connections and Python environment
	 */
	private async testConnections(): Promise<void> {
		this.logger.loading("Testing connections...");

		// Test Raindrop API
		const raindropOk = await this.raindropAPI.testConnection();
		if (!raindropOk) {
			throw new RaindropAPIError("Failed to connect to Raindrop API");
		}

		// Test Python environment
		const pythonOk = await this.pythonIntegration.testPythonEnvironment();
		if (!pythonOk) {
			throw new PythonIntegrationError(
				"Python environment test failed. Please ensure google-cloud-aiplatform is installed.",
			);
		}

		this.logger.success("All connections successful");
	}

	/**
	 * Main video processing workflow
	 */
	private async processVideos(config: Config, options: CLIOptions): Promise<ProcessingStats> {
		const stats: ProcessingStats = {
			totalBookmarks: 0,
			videoBookmarks: 0,
			processed: 0,
			successful: 0,
			failed: 0,
			skipped: 0,
			startTime: new Date(),
		};

		// Fetch bookmarks
		this.logger.rocket("Starting video processing...");
		const bookmarks = await this.raindropAPI.fetchBookmarks(
			config.collectionId,
			options.tag,
			config.maxVideos * 3, // Fetch extra to account for non-video bookmarks
		);

		stats.totalBookmarks = bookmarks.length;

		if (bookmarks.length === 0) {
			this.logger.warn("No bookmarks found matching your criteria");
			return stats;
		}

		// Filter for video bookmarks
		const videoBookmarks = this.videoDetector.filterVideoBookmarks(bookmarks);
		stats.videoBookmarks = videoBookmarks.length;

		if (videoBookmarks.length === 0) {
			this.logger.warn("No video bookmarks found");
			return stats;
		}

		// Filter out already processed videos (unless force flag is set)
		let videosToProcess = videoBookmarks;
		if (!options.force) {
			const unprocessedVideos = [];
			for (const bookmark of videoBookmarks) {
				const isProcessed = this.database.isBookmarkProcessed(bookmark._id);
				if (!isProcessed) {
					unprocessedVideos.push(bookmark);
				} else {
					stats.skipped++;
				}
			}
			videosToProcess = unprocessedVideos;
		}

		// Limit to max videos
		videosToProcess = videosToProcess.slice(0, config.maxVideos);
		stats.processed = videosToProcess.length;

		this.logger.info(
			`Found ${stats.videoBookmarks} video bookmarks, processing ${stats.processed}${
				stats.skipped > 0 ? `, skipping ${stats.skipped} already processed` : ""
			}`,
		);

		// Show platform breakdown
		const platformBreakdown = this.videoDetector.getPlatformBreakdown(videosToProcess);
		for (const [platform, count] of Object.entries(platformBreakdown)) {
			this.logger.debug(`  ${platform}: ${count} videos`);
		}

		if (videosToProcess.length === 0) {
			this.logger.info("No new videos to process. Use --force to re-process existing videos.");
			return stats;
		}

		if (options.dryRun) {
			this.logger.info("🧪 DRY RUN MODE - Videos that would be processed:");
			videosToProcess.forEach((bookmark, index) => {
				console.log(`  ${index + 1}. ${bookmark.title}`);
				console.log(`     ${bookmark.link}`);
			});
			return stats;
		}

		// Process videos with concurrency
		await this.processVideosConcurrently(videosToProcess, config, stats);

		// Final progress update
		await this.logger.progress(videosToProcess.length, videosToProcess.length, "Complete!");

		stats.endTime = new Date();
		return stats;
	}

	/**
	 * Process videos concurrently in batches
	 */
	private async processVideosConcurrently(
		videosToProcess: RaindropItem[],
		config: Config,
		stats: ProcessingStats,
	): Promise<void> {
		const concurrency = config.concurrency || 3;
		const batches = this.chunkArray(videosToProcess, concurrency);

		this.logger.info(
			`Processing ${videosToProcess.length} videos with concurrency: ${concurrency}`,
		);

		let processed = 0;

		for (const batch of batches) {
			// Process batch concurrently
			const batchPromises = batch.map((bookmark, batchIndex) => {
				const globalIndex = processed + batchIndex;
				return this.processSingleVideo(
					bookmark,
					config,
					stats,
					globalIndex,
					videosToProcess.length,
				);
			});

			await Promise.allSettled(batchPromises);
			processed += batch.length;

			// Small delay between batches to avoid overwhelming APIs
			if (processed < videosToProcess.length) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}
	}

	/**
	 * Process a single video
	 */
	private async processSingleVideo(
		bookmark: RaindropItem,
		config: Config,
		stats: ProcessingStats,
		index: number,
		total: number,
	): Promise<void> {
		await this.logger.progress(index, total, `Processing ${bookmark.title}`);

		try {
			const result = await this.pythonIntegration.summarizeVideo(
				bookmark.link,
				config.googleCloudProjectId,
				config.outputPath,
				bookmark.title,
				bookmark as unknown as Record<string, unknown>, // Pass the entire bookmark as metadata
			);

			if (result.success) {
				stats.successful++;
				await this.logger.clearLine();
				this.logger.success(`✅ ${bookmark.title} → ${result.outputFile?.split("/").pop()}`);

				// Mark video as processed in database
				const videoId = this.database.extractVideoId(bookmark.link);
				if (videoId && result.outputFile) {
					try {
						this.database.markVideoProcessed({
							video_id: videoId,
							url: bookmark.link,
							title: bookmark.title,
							summary_file_path: result.outputFile,
							processed_at: new Date().toISOString(),
							raindrop_bookmark_id: bookmark._id,
						});
					} catch (error) {
						this.logger.warn(
							`Failed to mark video as processed in database: ${
								error instanceof Error ? error.message : String(error)
							}`,
						);
					}
				}

				// Update Raindrop bookmark with generated tags if any were generated
				if (result.generatedTags && result.generatedTags.length > 0) {
					const existingTags = bookmark.tags || [];
					const allTags = [...new Set([...existingTags, ...result.generatedTags])]; // Combine and deduplicate

					const updateSuccess = await this.raindropAPI.updateBookmarkTags(bookmark._id, allTags);
					if (updateSuccess) {
						this.logger.info(
							`   🏷️  Added ${result.generatedTags.length} generated tags: ${
								result.generatedTags.join(", ")
							}`,
						);
					} else {
						this.logger.warn(`   ⚠️  Failed to update bookmark tags`);
					}
				}
			} else {
				stats.failed++;
				await this.logger.clearLine();
				this.logger.error(`❌ Failed: ${bookmark.title} - ${result.error}`);
			}
		} catch (error) {
			stats.failed++;
			await this.logger.clearLine();
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`❌ Error processing ${bookmark.title}: ${errorMessage}`);
		}
	}

	/**
	 * Utility function to chunk array into smaller arrays
	 */
	private chunkArray<T>(array: T[], chunkSize: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += chunkSize) {
			chunks.push(array.slice(i, i + chunkSize));
		}
		return chunks;
	}

	/**
	 * Show final processing results
	 */
	private showFinalResults(stats: ProcessingStats): void {
		const duration = stats.endTime
			? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000
			: 0;

		this.cli.showStats({
			totalBookmarks: stats.totalBookmarks,
			videoBookmarks: stats.videoBookmarks,
			processed: stats.processed,
			successful: stats.successful,
			failed: stats.failed,
			skipped: stats.skipped,
			duration,
		});

		if (stats.successful > 0) {
			this.logger.finish(`🎉 Successfully processed ${stats.successful} videos!`);
			this.logger.info(`Summaries saved in: ./summaries`);
		}

		if (stats.failed > 0) {
			this.logger.warn(`⚠️  ${stats.failed} videos failed to process`);
		}
	}

	/**
	 * Handle application errors with helpful messages
	 */
	private handleError(error: Error): void {
		if (error instanceof ConfigError) {
			this.logger.error("❌ Configuration Error", error);
			this.logger.info("💡 Run with --help for setup instructions");
		} else if (error instanceof RaindropAPIError) {
			this.logger.error("❌ Raindrop API Error", error);
			if (error.statusCode === 401) {
				this.logger.info("💡 Check your RAINDROP_TOKEN in .env file");
			}
		} else if (error instanceof PythonIntegrationError) {
			this.logger.error("❌ Python Integration Error", error);
			this.logger.info('💡 Try: pipx install "google-cloud-aiplatform[vertexai]"');
		} else if (error instanceof DatabaseError) {
			this.logger.error("❌ Database Error", error);
			this.logger.info("💡 Check database permissions and disk space");
		} else {
			this.logger.error("❌ Unexpected Error", error);
		}
	}

	/**
	 * Ensure output directory exists
	 */
	private async ensureOutputDirectory(outputPath: string): Promise<void> {
		try {
			await Deno.mkdir(outputPath, { recursive: true });
		} catch (error) {
			if (!(error instanceof Deno.errors.AlreadyExists)) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				throw new Error(`Failed to create output directory: ${errorMessage}`);
			}
		}
	}

	/**
	 * Save configuration to .env file
	 */
	private async saveConfigToEnv(
		config: { raindropToken?: string; googleCloudProjectId?: string },
	): Promise<void> {
		let envContent = "";

		// Read existing .env if it exists
		try {
			envContent = await Deno.readTextFile(".env");
		} catch {
			// File doesn't exist, start fresh
		}

		// Update or add new values
		if (config.raindropToken) {
			envContent = this.updateEnvLine(envContent, "RAINDROP_TOKEN", config.raindropToken);
		}

		if (config.googleCloudProjectId) {
			envContent = this.updateEnvLine(
				envContent,
				"GOOGLE_CLOUD_PROJECT_ID",
				config.googleCloudProjectId,
			);
		}

		await Deno.writeTextFile(".env", envContent);
	}

	/**
	 * Update or add a line in env content
	 */
	private updateEnvLine(content: string, key: string, value: string): string {
		const line = `${key}="${value}"`;
		const regex = new RegExp(`^${key}=.*$`, "m");

		if (regex.test(content)) {
			return content.replace(regex, line);
		} else {
			return content + (content ? "\n" : "") + line + "\n";
		}
	}

	/**
	 * Update Raindrop tags from existing markdown files
	 */
	private async updateTagsFromMarkdown(config: Config): Promise<void> {
		try {
			this.logger.info("🏷️  Starting tag update from database...\n");

			// Create tag updater instance
			const tagUpdater = new TagUpdater(this.raindropAPI, this.database);

			// Update tags from database
			const stats = await tagUpdater.updateTagsFromDatabase(
				config.collectionId,
			);

			// Show results
			tagUpdater.showUpdateStats(stats);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to update tags from database: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * Handle YouTube playlist operations
	 */
	private async handlePlaylistOperations(config: Config, options: CLIOptions): Promise<void> {
		if (!config.youtubeApiKey) {
			this.logger.error("YouTube API key is required for playlist operations.");
			this.logger.info("Please set YOUTUBE_API_KEY in your .env file.");
			this.logger.info("Get your API key from: https://console.developers.google.com/");
			return;
		}

		if (!options.playlist) {
			this.logger.error("Playlist ID is required. Use --playlist <id>");
			return;
		}

		try {
			const lister = new YouTubePlaylistLister({ apiKey: config.youtubeApiKey });
			const playlistId = options.playlist;

			if (options.listPlaylist) {
				// Just list videos in the playlist
				await this.listPlaylistVideos(lister, playlistId);
			} else {
				// Process videos from the playlist
				await this.processPlaylistVideos(lister, playlistId, config, options);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Playlist operation failed: ${errorMessage}`);
			throw error;
		}
	}

	/**
	 * List videos in a YouTube playlist
	 */
	private async listPlaylistVideos(lister: YouTubePlaylistLister, playlistId: string): Promise<void> {
		this.logger.loading("Fetching playlist information...");

		const playlist = await lister.getCompletePlaylist(playlistId);

		console.log(`\n🎬 ${playlist.title}`);
		console.log(`📺 Channel: ${playlist.channelTitle}`);
		console.log(`📝 ${playlist.description.substring(0, 100)}${playlist.description.length > 100 ? '...' : ''}`);
		console.log(`📊 ${playlist.videos.length} videos\n`);

		playlist.videos.forEach((video, index) => {
			console.log(`${(index + 1).toString().padStart(3)}. ${video.title}`);
			console.log(`     https://youtube.com/watch?v=${video.videoId}`);
			console.log(`     Channel: ${video.channelTitle}`);
			console.log(`     Published: ${new Date(video.publishedAt).toLocaleDateString()}\n`);
		});
	}

	/**
	 * List YouTube playlists (requires OAuth for personal playlists)
	 */
	private async listMyPlaylists(config: Config): Promise<void> {
		if (!config.youtubeApiKey) {
			this.logger.error("❌ YouTube API key is required to list playlists.");
			this.logger.info("Please set YOUTUBE_API_KEY in your .env file.");
			this.logger.info("Get your API key from: https://console.developers.google.com/");
			return;
		}

		console.log("\n❌ Personal playlist listing requires OAuth 2.0 authentication");
		console.log("This feature would need additional setup with Google OAuth credentials.");
		console.log("\n🔧 Alternative options:");
		console.log("1. Use YouTube's web interface to find your playlist IDs");
		console.log("2. List public playlists from any channel using channel ID");
		console.log("3. Search for playlists by name");
		
		console.log("\n💡 Available workarounds:");
		console.log("   # Search for playlists by name");
		console.log("   # (This would require implementing search functionality)");
		
		console.log("\n   # To process videos from a known playlist:");
		console.log("   --playlist <playlist_id>");
		
		console.log("\n   # To list videos in a known playlist:");
		console.log("   --playlist <playlist_id> --list-playlist");
		
		console.log("\n📌 To find your playlist IDs:");
		console.log("   1. Go to YouTube.com");
		console.log("   2. Navigate to your playlists");
		console.log("   3. Copy the playlist ID from the URL (after 'list=')");
	}

	/**
	 * Process videos from a YouTube playlist
	 */
	private async processPlaylistVideos(
		lister: YouTubePlaylistLister,
		playlistId: string,
		config: Config,
		options: CLIOptions
	): Promise<void> {
		this.logger.loading("Fetching playlist videos...");

		const playlist = await lister.getCompletePlaylist(playlistId);
		this.logger.info(`Found playlist: ${playlist.title} with ${playlist.videos.length} videos`);

		// Convert playlist videos to RaindropItem format for processing
		const videoBookmarks: RaindropItem[] = playlist.videos.slice(0, config.maxVideos).map((video) => ({
			_id: `playlist_${video.videoId}`,
			title: video.title,
			link: `https://youtube.com/watch?v=${video.videoId}`,
			tags: [`playlist:${playlist.title}`, 'youtube'],
			created: video.publishedAt,
			type: 'link',
			domain: 'youtube.com'
		}));

		this.logger.info(`Processing ${videoBookmarks.length} videos from playlist...`);

		if (options.dryRun) {
			this.logger.info("🧪 DRY RUN MODE - Videos that would be processed:");
			videoBookmarks.forEach((bookmark, index) => {
				console.log(`  ${index + 1}. ${bookmark.title}`);
				console.log(`     ${bookmark.link}`);
			});
			return;
		}

		// Create output directory
		await this.ensureOutputDirectory(config.outputPath);

		// Process videos with stats tracking
		const stats: ProcessingStats = {
			totalBookmarks: playlist.videos.length,
			videoBookmarks: videoBookmarks.length,
			processed: videoBookmarks.length,
			successful: 0,
			failed: 0,
			skipped: 0,
			startTime: new Date(),
		};

		// Process videos concurrently
		await this.processVideosConcurrently(videoBookmarks, config, stats);

		stats.endTime = new Date();
		this.showFinalResults(stats);
	}

	/**
	 * List previously processed videos
	 */
	private listProcessedVideos(): void {
		try {
			this.logger.info("📊 Previously Processed Videos\n");

			const processedVideos = this.database.getProcessedVideos(50); // Show last 50
			const stats = this.database.getStats();

			if (processedVideos.length === 0) {
				this.logger.info("No videos have been processed yet.");
				return;
			}

			// Show statistics
			this.logger.info(`Total processed: ${stats.totalProcessed}`);
			this.logger.info(`Today: ${stats.today}`);
			this.logger.info(`This week: ${stats.thisWeek}\n`);

			// Show recent videos
			this.logger.info("Recent videos (last 50):");
			for (const video of processedVideos) {
				const processedDate = new Date(video.processed_at).toLocaleDateString();
				this.logger.info(`  📹 ${video.title}`);
				this.logger.debug(`     ID: ${video.video_id} | Processed: ${processedDate}`);
				this.logger.debug(`     File: ${video.summary_file_path}`);
				console.log(); // Add spacing
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to list processed videos: ${errorMessage}`);
			throw error;
		}
	}
}

// Run the application
if (import.meta.main) {
	const app = new VideoSummarizer();
	await app.run();
}
