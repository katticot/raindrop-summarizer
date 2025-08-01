// video/python-integration.ts - Python script integration with auto-detection
import { PythonEnvironment, VideoProcessingResult } from "../types.ts";
import { Logger } from "../utils/logger.ts";

export class PythonIntegrationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PythonIntegrationError";
	}
}

export class PythonIntegration {
	private logger: Logger;
	private pythonEnv: PythonEnvironment | null = null;

	constructor() {
		this.logger = Logger.getInstance();
	}

	/**
	 * Auto-detect Python environment
	 */
	async detectPythonEnvironment(): Promise<PythonEnvironment> {
		this.logger.debug("Auto-detecting Python environment...");

		// Try different Python installations in order of preference
		const candidates = await this.getPythonCandidates();

		for (const candidate of candidates) {
			this.logger.debug(`Testing Python candidate: ${candidate.pythonPath} (${candidate.type})`);

			if (await this.validatePythonInstallation(candidate)) {
				this.logger.success(
					`Found valid Python environment: ${candidate.type} at ${candidate.pythonPath}`,
				);
				this.pythonEnv = candidate;
				return candidate;
			}
		}

		throw new PythonIntegrationError(
			"No valid Python environment found with required dependencies. " +
				"Please install google-cloud-aiplatform using:\n" +
				'  pipx install "google-cloud-aiplatform[vertexai]"\n' +
				'  or pip install "google-cloud-aiplatform[vertexai]"',
		);
	}

	/**
	 * Get list of Python installation candidates
	 */
	private async getPythonCandidates(): Promise<PythonEnvironment[]> {
		const candidates: PythonEnvironment[] = [];

		// 1. Try pipx installation (preferred)
		const homeDir = Deno.env.get("HOME");
		if (homeDir) {
			const pipxPath = `${homeDir}/.local/pipx/venvs/google-cloud-aiplatform/bin/python`;
			candidates.push({
				pythonPath: pipxPath,
				type: "pipx",
				valid: false,
			});
		}

		// 2. Try conda environments
		try {
			const condaInfo = await this.getCondaEnvironments();
			candidates.push(...condaInfo);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.debug(`Could not detect conda environments: ${errorMessage}`);
		}

		// 3. Try system Python
		candidates.push({
			pythonPath: "python3",
			type: "system",
			valid: false,
		});

		candidates.push({
			pythonPath: "python",
			type: "system",
			valid: false,
		});

		return candidates;
	}

	/**
	 * Get conda environments that might have the required packages
	 */
	private async getCondaEnvironments(): Promise<PythonEnvironment[]> {
		const candidates: PythonEnvironment[] = [];

		try {
			const command = new Deno.Command("conda", {
				args: ["env", "list", "--json"],
				stdout: "piped",
				stderr: "piped",
			});

			const { stdout, success } = await command.output();

			if (success) {
				const output = new TextDecoder().decode(stdout);
				const condaInfo = JSON.parse(output);

				for (const envPath of condaInfo.envs) {
					const pythonPath = `${envPath}/bin/python`;
					candidates.push({
						pythonPath,
						type: "conda",
						valid: false,
					});
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.debug(`Conda detection failed: ${errorMessage}`);
		}

		return candidates;
	}

	/**
	 * Validate Python installation and check for required dependencies
	 */
	private async validatePythonInstallation(candidate: PythonEnvironment): Promise<boolean> {
		try {
			// Test if Python executable exists and works
			const command = new Deno.Command(candidate.pythonPath, {
				args: ["-c", "import vertexai; import google.cloud.aiplatform; print('OK')"],
				stdout: "piped",
				stderr: "piped",
			});

			const { success } = await command.output();

			candidate.valid = success;
			return success;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.debug(`Python validation failed for ${candidate.pythonPath}: ${errorMessage}`);
			candidate.valid = false;
			return false;
		}
	}

	/**
	 * Summarize video using Python script
	 */
	async summarizeVideo(
		videoUrl: string,
		googleCloudProjectId: string,
		outputPath: string,
		title?: string,
		metadata?: Record<string, unknown>,
	): Promise<VideoProcessingResult> {
		if (!this.pythonEnv) {
			await this.detectPythonEnvironment();
		}

		if (!this.pythonEnv) {
			throw new PythonIntegrationError("No valid Python environment available");
		}

		this.logger.video(`Summarizing video: ${title || videoUrl}`);

		try {
			const args = ["video_summarizer.py", videoUrl];

			// Add metadata if provided
			if (metadata) {
				args.push("--metadata", JSON.stringify(metadata));
			}

			const command = new Deno.Command(this.pythonEnv.pythonPath, {
				args,
				env: {
					"GOOGLE_CLOUD_PROJECT_ID": googleCloudProjectId,
				},
				stdout: "piped",
				stderr: "piped",
			});

			const { stdout, stderr, success } = await command.output();

			if (!success) {
				const errorOutput = new TextDecoder().decode(stderr);
				this.logger.error(`Python script failed: ${errorOutput}`);

				return {
					success: false,
					videoUrl,
					title: title || videoUrl,
					error: this.parseErrorMessage(errorOutput),
				};
			}

			const outputText = new TextDecoder().decode(stdout);

			try {
				// Parse JSON response from Python script
				const pythonResult = JSON.parse(outputText);

				// Generate output filename
				const filename = this.generateOutputFilename(videoUrl, title);
				const fullPath = `${outputPath}/${filename}`;

				// Save summary to file
				await Deno.writeTextFile(fullPath, pythonResult.summary);

				this.logger.success(`Summary saved to ${filename}`);

				return {
					success: true,
					videoUrl,
					title: title || videoUrl,
					outputFile: fullPath,
					generatedTags: pythonResult.generated_tags,
					frontMatter: pythonResult.front_matter,
				};
			} catch (_parseError) {
				// Fallback: treat as plain text (backward compatibility)
				const filename = this.generateOutputFilename(videoUrl, title);
				const fullPath = `${outputPath}/${filename}`;
				await Deno.writeTextFile(fullPath, outputText);

				this.logger.success(`Summary saved to ${filename}`);
				return {
					success: true,
					videoUrl,
					title: title || videoUrl,
					outputFile: fullPath,
				};
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error(`Error processing video: ${errorMessage}`);

			return {
				success: false,
				videoUrl,
				title: title || videoUrl,
				error: errorMessage,
			};
		}
	}

	/**
	 * Parse error message to provide helpful feedback
	 */
	private parseErrorMessage(errorOutput: string): string {
		if (errorOutput.includes("GOOGLE_CLOUD_PROJECT_ID")) {
			return "Google Cloud Project ID not set or invalid";
		}

		if (errorOutput.includes("authentication")) {
			return "Google Cloud authentication failed. Run: gcloud auth application-default login";
		}

		if (errorOutput.includes("quota") || errorOutput.includes("rate limit")) {
			return "API quota exceeded or rate limit reached. Please try again later";
		}

		if (errorOutput.includes("video") && errorOutput.includes("not found")) {
			return "Video not found or not accessible";
		}

		// Return first line of error for brevity
		const firstLine = errorOutput.split("\n")[0];
		return firstLine || "Unknown error occurred";
	}

	/**
	 * Generate output filename with YouTube ID and video title
	 * Format: [youtube_id]_[sanitized_title].md
	 */
	private generateOutputFilename(videoUrl: string, title?: string): string {
		try {
			// Extract YouTube video ID
			const youtubeMatch = videoUrl.match(
				/(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/,
			);

			if (youtubeMatch) {
				const videoId = youtubeMatch[1];

				// Sanitize title for filename if available
				if (title) {
					const sanitizedTitle = title
						.replace(/[^\w\s-]/g, "") // Remove special characters except spaces and hyphens
						.replace(/\s+/g, "_") // Replace spaces with underscores
						.replace(/_+/g, "_") // Replace multiple underscores with single
						.toLowerCase()
						.substring(0, 50) // Limit to 50 characters
						.replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores

					if (sanitizedTitle) {
						return `${videoId}_${sanitizedTitle}.md`;
					}
				}

				// Fallback to just video ID
				return `${videoId}_summary.md`;
			}

			// Fallback for non-YouTube URLs (though unlikely)
			if (title) {
				const safeName = title
					.replace(/[^\w\s-]/g, "")
					.replace(/\s+/g, "_")
					.toLowerCase()
					.substring(0, 50)
					.replace(/^_+|_+$/g, "");
				return `${safeName}_summary.md`;
			}

			// Final fallback with timestamp
			return `video_${Date.now()}_summary.md`;
		} catch (_e) {
			this.logger.debug(`Could not parse URL for filename: ${videoUrl}. Using fallback.`);

			// Generate timestamp-based fallback
			const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
			return `video_${timestamp}_summary.md`;
		}
	}

	/**
	 * Get current Python environment info
	 */
	getPythonEnvironment(): PythonEnvironment | null {
		return this.pythonEnv;
	}

	/**
	 * Set custom Python path
	 */
	setCustomPythonPath(pythonPath: string): void {
		this.pythonEnv = {
			pythonPath,
			type: "custom",
			valid: false,
		};
	}

	/**
	 * Test the current Python environment
	 */
	async testPythonEnvironment(): Promise<boolean> {
		if (!this.pythonEnv) {
			try {
				await this.detectPythonEnvironment();
				return true;
			} catch {
				return false;
			}
		}

		return await this.validatePythonInstallation(this.pythonEnv);
	}
}
