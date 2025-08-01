// config/config.ts - Configuration management with validation
import { load } from "https://deno.land/std@0.218.0/dotenv/mod.ts";
import { exists } from "https://deno.land/std@0.218.0/fs/exists.ts";
import { CLIOptions, Config } from "../types.ts";

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}

export class ConfigManager {
	private static instance: ConfigManager;
	private config: Config | null = null;

	private constructor() {}

	static getInstance(): ConfigManager {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}
		return ConfigManager.instance;
	}

	async loadConfig(options: CLIOptions = {}): Promise<Config> {
		// Load environment variables from .env file
		await this.loadEnvironmentFile();

		// Build config from environment and CLI options
		const config = this.buildConfig(options);

		// Validate configuration
		this.validateConfig(config);

		this.config = config;
		return config;
	}

	private async loadEnvironmentFile(): Promise<void> {
		const envFile = ".env";
		if (await exists(envFile)) {
			await load({ export: true });
		}
	}

	private buildConfig(options: CLIOptions): Config {
		const raindropToken = Deno.env.get("RAINDROP_TOKEN");
		const googleCloudProjectId = Deno.env.get("GOOGLE_CLOUD_PROJECT_ID");
		const collectionIdEnv = Deno.env.get("RAINDROP_COLLECTION_ID") || "0";
		const maxVideosEnv = Deno.env.get("MAX_VIDEOS");
		const concurrencyEnv = Deno.env.get("CONCURRENCY");

		// Parse max videos with validation
		let maxVideos = 5; // default
		if (options.maxVideos) {
			maxVideos = options.maxVideos;
		} else if (maxVideosEnv) {
			const parsed = parseInt(maxVideosEnv);
			if (!isNaN(parsed) && parsed > 0) {
				maxVideos = parsed;
			}
		}

		// Parse concurrency with validation
		let concurrency = 3; // default
		if (options.concurrency) {
			concurrency = options.concurrency;
		} else if (concurrencyEnv) {
			const parsed = parseInt(concurrencyEnv);
			if (!isNaN(parsed) && parsed > 0 && parsed <= 10) {
				concurrency = parsed;
			}
		}

		return {
			raindropToken: raindropToken || "",
			googleCloudProjectId: googleCloudProjectId || "",
			collectionId: options.collection || collectionIdEnv,
			maxVideos,
			outputPath: options.output || "./summaries",
			verbose: options.verbose || false,
			quiet: options.quiet || false,
			databasePath: options.dbPath || "./data/processed_videos.db",
			concurrency,
		};
	}

	private validateConfig(config: Config): void {
		const errors: string[] = [];

		if (!config.raindropToken) {
			errors.push(
				"RAINDROP_TOKEN is required. Get it from https://app.raindrop.io/settings/integrations",
			);
		}

		if (!config.googleCloudProjectId) {
			errors.push(
				"GOOGLE_CLOUD_PROJECT_ID is required. Set up a Google Cloud project with Vertex AI enabled",
			);
		}

		if (config.maxVideos <= 0) {
			errors.push("MAX_VIDEOS must be a positive number");
		}

		if (config.maxVideos > 50) {
			errors.push("MAX_VIDEOS should not exceed 50 to avoid rate limits");
		}

		if (config.concurrency <= 0 || config.concurrency > 10) {
			errors.push("CONCURRENCY must be between 1 and 10");
		}

		if (errors.length > 0) {
			throw new ConfigError(
				"Configuration validation failed:\n" +
					errors.map((err) => `  • ${err}`).join("\n") +
					"\n\nPlease check your .env file or environment variables.",
			);
		}
	}

	getConfig(): Config {
		if (!this.config) {
			throw new ConfigError("Configuration not loaded. Call loadConfig() first.");
		}
		return this.config;
	}

	async createSampleEnvFile(): Promise<void> {
		const sampleEnv = `# Raindrop Video Summarizer Configuration
# Copy this to .env and fill in your values

# Required: Get from https://app.raindrop.io/settings/integrations
RAINDROP_TOKEN="your_raindrop_api_token_here"

# Required: Your Google Cloud project ID with Vertex AI enabled
GOOGLE_CLOUD_PROJECT_ID="your_google_cloud_project_id"

# Optional: Specific collection ID (0 = all bookmarks)
RAINDROP_COLLECTION_ID="0"

# Optional: Maximum videos to process per run (default: 5)
MAX_VIDEOS="5"
`;

		await Deno.writeTextFile(".env.example", sampleEnv);
	}
}
