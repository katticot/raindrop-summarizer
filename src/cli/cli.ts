// cli/cli.ts - Enhanced CLI interface with better UX
import { parse } from "https://deno.land/std@0.218.0/flags/mod.ts";
import { CLIOptions } from "../types.ts";
import { Logger } from "../utils/logger.ts";

const VERSION = "2.0.0";

export class CLI {
	private logger: Logger;

	constructor() {
		this.logger = Logger.getInstance();
	}

	/**
	 * Parse command line arguments with enhanced validation
	 */
	parseArguments(): CLIOptions {
		const args = parse(Deno.args, {
			boolean: [
				"help",
				"version",
				"dry-run",
				"verbose",
				"quiet",
				"update-tags",
				"force",
				"list-processed",
			],
			string: ["tag", "collection", "output", "config", "max-videos", "db-path", "concurrency"],
			alias: {
				h: "help",
				v: "version",
				t: "tag",
				c: "collection",
				o: "output",
				n: "max-videos",
				q: "quiet",
			},
			default: {
				"dry-run": false,
				verbose: false,
				quiet: false,
				"update-tags": false,
				force: false,
				"list-processed": false,
				output: "./summaries",
			},
		});

		// Convert kebab-case to camelCase for consistency
		const options: CLIOptions = {
			help: args.help,
			version: args.version,
			tag: args.tag,
			collection: args.collection,
			maxVideos: args["max-videos"] ? parseInt(args["max-videos"]) : undefined,
			dryRun: args["dry-run"],
			verbose: args.verbose,
			quiet: args.quiet,
			output: args.output,
			config: args.config,
			updateTags: args["update-tags"],
			force: args.force,
			listProcessed: args["list-processed"],
			dbPath: args["db-path"],
			concurrency: args.concurrency ? parseInt(args.concurrency) : undefined,
		};

		// Validate numeric arguments
		if (
			options.maxVideos !== undefined &&
			(isNaN(options.maxVideos) || options.maxVideos <= 0)
		) {
			this.logger.error("❌ --max-videos must be a positive number");
			Deno.exit(1);
		}

		if (
			options.concurrency !== undefined &&
			(isNaN(options.concurrency) || options.concurrency <= 0 || options.concurrency > 10)
		) {
			this.logger.error("❌ --concurrency must be between 1 and 10");
			Deno.exit(1);
		}

		// Validate conflicting flags
		if (options.verbose && options.quiet) {
			this.logger.error("❌ Cannot use --verbose and --quiet together");
			Deno.exit(1);
		}

		return options;
	}

	/**
	 * Show help message with examples
	 */
	showHelp(): void {
		const helpText = `
${this.colorize("🎬 Raindrop Video Summarizer", "cyan", true)}
${this.colorize("Automatically summarize videos from your Raindrop.io bookmarks using AI", "gray")}

${this.colorize("USAGE:", "yellow", true)}
  deno run --allow-all raindrop_video_summarizer.ts [OPTIONS]

${this.colorize("OPTIONS:", "yellow", true)}
  -h, --help              Show this help message
  -v, --version           Show version information
  -t, --tag <tag>         Only process bookmarks with specific tag
  -c, --collection <id>   Raindrop collection ID (default: 0 for all bookmarks)
  -n, --max-videos <num>  Maximum videos to process (default: 5)
  -o, --output <path>     Output directory for summaries (default: ./summaries)
      --config <file>     Load configuration from file
      --dry-run           Show what would be processed without summarizing
      --update-tags       Force update Raindrop tags from markdown files (max 10 tags)
      --force             Re-process already summarized videos
      --list-processed    Show previously processed videos
      --db-path <path>    Custom database file path (default: ./data/processed_videos.db)
      --concurrency <num> Number of videos to process concurrently (default: 3, max: 10)
      --verbose           Enable detailed logging
  -q, --quiet             Suppress non-error output

${this.colorize("EXAMPLES:", "yellow", true)}
  ${this.colorize("# Basic usage with default settings", "gray")}
  deno run --allow-all raindrop_video_summarizer.ts

  ${this.colorize("# Process only YouTube videos with specific tag", "gray")}
  deno run --allow-all raindrop_video_summarizer.ts --tag youtube --max-videos 10

  ${this.colorize("# Dry run to see what would be processed", "gray")}
  deno run --allow-all raindrop_video_summarizer.ts --dry-run --verbose

  ${this.colorize("# Process from specific collection with custom output", "gray")}
  deno run --allow-all raindrop_video_summarizer.ts -c 123456 -o ./my-summaries


  ${this.colorize("# Force update Raindrop tags from markdown files (max 10)", "gray")}
  deno run --allow-all raindrop_video_summarizer.ts --update-tags

  ${this.colorize("# Re-process already summarized videos", "gray")}
  deno run --allow-all raindrop_video_summarizer.ts --force

  ${this.colorize("# Show previously processed videos", "gray")}
  deno run --allow-all raindrop_video_summarizer.ts --list-processed

${this.colorize("SETUP:", "yellow", true)}
  ${this.colorize("1. Create .env file with required variables:", "white")}
     RAINDROP_TOKEN="your_token"
     GOOGLE_CLOUD_PROJECT_ID="your_project_id"

  ${this.colorize("2. Install Python dependencies:", "white")}
     pipx install "google-cloud-aiplatform[vertexai]"

  ${this.colorize("3. Authenticate with Google Cloud:", "white")}
     gcloud auth application-default login

${this.colorize("SUPPORTED PLATFORMS:", "yellow", true)}
  YouTube

${this.colorize("For more information, visit:", "yellow")} https://github.com/your/repo
`;

		console.log(helpText);
	}

	/**
	 * Show version information
	 */
	showVersion(): void {
		console.log(
			`${this.colorize("🎬 Raindrop Video Summarizer", "cyan", true)} v${VERSION}`,
		);
		console.log(`${this.colorize("Deno", "gray")} ${Deno.version.deno}`);
		console.log(`${this.colorize("V8", "gray")} ${Deno.version.v8}`);
		console.log(
			`${this.colorize("TypeScript", "gray")} ${Deno.version.typescript}`,
		);
	}

	/**
	 * Show welcome banner
	 */
	showBanner(): void {
		const banner = `
${this.colorize("╔══════════════════════════════════════════════════════════╗", "cyan")}
${this.colorize("║", "cyan")}  ${
			this.colorize("🎬 Raindrop Video Summarizer", "white", true)
		}                     ${this.colorize("║", "cyan")}
${this.colorize("║", "cyan")}  ${
			this.colorize("AI-powered video summaries from your bookmarks", "gray")
		}        ${this.colorize("║", "cyan")}
${this.colorize("╚══════════════════════════════════════════════════════════╝", "cyan")}
`;
		console.log(banner);
	}

	/**
	 * Prompt user for missing configuration interactively
	 */
	promptForConfiguration(): {
		raindropToken?: string;
		googleCloudProjectId?: string;
	} {
		console.log(
			this.colorize(
				"\n🔧 Setup wizard - Let's configure your environment:",
				"yellow",
				true,
			),
		);

		const config: { raindropToken?: string; googleCloudProjectId?: string } = {};

		// Prompt for Raindrop token
		console.log(this.colorize("\n1. Raindrop.io API Token", "white", true));
		console.log(
			"   Get your token from: https://app.raindrop.io/settings/integrations",
		);
		const raindropToken = prompt("   Enter your Raindrop token: ");
		if (raindropToken) {
			config.raindropToken = raindropToken;
		}

		// Prompt for Google Cloud Project ID
		console.log(this.colorize("\n2. Google Cloud Project ID", "white", true));
		console.log("   Make sure Vertex AI is enabled in your project");
		const googleCloudProjectId = prompt(
			"   Enter your Google Cloud Project ID: ",
		);
		if (googleCloudProjectId) {
			config.googleCloudProjectId = googleCloudProjectId;
		}

		return config;
	}

	/**
	 * Show configuration summary
	 */
	showConfigSummary(options: {
		collection: string;
		maxVideos: number;
		tag?: string;
		outputPath: string;
		dryRun: boolean;
	}): void {
		console.log(this.colorize("\n📋 Configuration Summary:", "yellow", true));
		console.log(
			`   Collection: ${
				this.colorize(
					options.collection === "0" ? "All Bookmarks" : `ID ${options.collection}`,
					"white",
				)
			}`,
		);
		console.log(
			`   Max Videos: ${this.colorize(options.maxVideos.toString(), "white")}`,
		);
		if (options.tag) {
			console.log(
				`   Tag Filter: ${this.colorize(`#${options.tag}`, "white")}`,
			);
		}
		console.log(`   Output: ${this.colorize(options.outputPath, "white")}`);
		if (options.dryRun) {
			console.log(
				`   Mode: ${this.colorize("DRY RUN", "yellow", true)} (no actual processing)`,
			);
		}
		console.log();
	}

	/**
	 * Show processing statistics
	 */
	showStats(stats: {
		totalBookmarks: number;
		videoBookmarks: number;
		processed: number;
		successful: number;
		failed: number;
		skipped?: number;
		duration: number;
	}): void {
		console.log(this.colorize("\n📊 Processing Statistics:", "yellow", true));
		console.log(
			`   Total Bookmarks: ${this.colorize(stats.totalBookmarks.toString(), "white")}`,
		);
		console.log(
			`   Video Bookmarks: ${this.colorize(stats.videoBookmarks.toString(), "white")}`,
		);
		console.log(
			`   Processed: ${this.colorize(stats.processed.toString(), "white")}`,
		);
		console.log(
			`   Successful: ${this.colorize(stats.successful.toString(), "green")}`,
		);
		if (stats.failed > 0) {
			console.log(
				`   Failed: ${this.colorize(stats.failed.toString(), "red")}`,
			);
		}
		if (stats.skipped && stats.skipped > 0) {
			console.log(
				`   Skipped: ${this.colorize(stats.skipped.toString(), "yellow")} (already processed)`,
			);
		}
		console.log(
			`   Duration: ${this.colorize(`${stats.duration.toFixed(1)}s`, "white")}`,
		);
		console.log();
	}

	/**
	 * Ask for user confirmation
	 */
	confirm(message: string, defaultValue: boolean = true): boolean {
		const defaultText = defaultValue ? "[Y/n]" : "[y/N]";
		const response = prompt(`${message} ${defaultText}: `);

		if (!response) {
			return defaultValue;
		}

		return response.toLowerCase().startsWith("y");
	}

	/**
	 * Colorize text for terminal output
	 */
	private colorize(text: string, color: string, bold: boolean = false): string {
		const colors: Record<string, string> = {
			reset: "\x1b[0m",
			bright: "\x1b[1m",
			red: "\x1b[31m",
			green: "\x1b[32m",
			yellow: "\x1b[33m",
			blue: "\x1b[34m",
			magenta: "\x1b[35m",
			cyan: "\x1b[36m",
			white: "\x1b[37m",
			gray: "\x1b[90m",
		};

		let colorCode = colors[color] || "";
		if (bold) {
			colorCode += colors.bright;
		}

		return `${colorCode}${text}${colors.reset}`;
	}

	/**
	 * Handle CLI options and show appropriate screens
	 */
	handleOptions(options: CLIOptions): boolean {
		if (options.help) {
			this.showHelp();
			return true;
		}

		if (options.version) {
			this.showVersion();
			return true;
		}

		// Set logger levels based on options
		if (options.quiet) {
			this.logger.setQuiet(true);
		}

		if (options.verbose) {
			this.logger.setVerbose(true);
		}

		return false;
	}
}
