// utils/logger.ts - Enhanced logging with colors and levels
import { LogLevel } from "../types.ts";

// ANSI color codes
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
	gray: "\x1b[90m",
};

// Emoji icons
const icons = {
	debug: "🔍",
	info: "ℹ️",
	success: "✅",
	warn: "⚠️",
	error: "❌",
	loading: "⏳",
	rocket: "🚀",
	bookmark: "📚",
	video: "🎬",
	finish: "🏁",
};

export class Logger {
	private static instance: Logger;
	private logLevel: LogLevel = LogLevel.INFO;
	private quiet: boolean = false;
	private verbose: boolean = false;

	private constructor() {}

	static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	setLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	setQuiet(quiet: boolean): void {
		this.quiet = quiet;
	}

	setVerbose(verbose: boolean): void {
		this.verbose = verbose;
		if (verbose) {
			this.logLevel = LogLevel.DEBUG;
		}
	}

	private shouldLog(level: LogLevel): boolean {
		if (this.quiet && level < LogLevel.ERROR) {
			return false;
		}
		return level >= this.logLevel;
	}

	private formatMessage(level: LogLevel, message: string, icon?: string): string {
		const timestamp = new Date().toLocaleTimeString();
		const levelName = LogLevel[level];
		
		let color = "";
		let defaultIcon = "";
		
		switch (level) {
			case LogLevel.DEBUG:
				color = colors.gray;
				defaultIcon = icons.debug;
				break;
			case LogLevel.INFO:
				color = colors.blue;
				defaultIcon = icons.info;
				break;
			case LogLevel.WARN:
				color = colors.yellow;
				defaultIcon = icons.warn;
				break;
			case LogLevel.ERROR:
				color = colors.red;
				defaultIcon = icons.error;
				break;
		}

		const displayIcon = icon || defaultIcon;
		const coloredMessage = `${color}${message}${colors.reset}`;
		
		if (this.verbose) {
			return `${colors.gray}[${timestamp}] ${levelName}${colors.reset} ${displayIcon} ${coloredMessage}`;
		} else {
			return `${displayIcon} ${coloredMessage}`;
		}
	}

	debug(message: string, icon?: string): void {
		if (this.shouldLog(LogLevel.DEBUG)) {
			console.log(this.formatMessage(LogLevel.DEBUG, message, icon));
		}
	}

	info(message: string, icon?: string): void {
		if (this.shouldLog(LogLevel.INFO)) {
			console.log(this.formatMessage(LogLevel.INFO, message, icon));
		}
	}

	success(message: string): void {
		if (this.shouldLog(LogLevel.INFO)) {
			console.log(this.formatMessage(LogLevel.INFO, message, icons.success));
		}
	}

	warn(message: string, icon?: string): void {
		if (this.shouldLog(LogLevel.WARN)) {
			console.warn(this.formatMessage(LogLevel.WARN, message, icon));
		}
	}

	error(message: string, error?: Error, icon?: string): void {
		if (this.shouldLog(LogLevel.ERROR)) {
			console.error(this.formatMessage(LogLevel.ERROR, message, icon));
			if (error && this.verbose) {
				console.error(`${colors.gray}Stack trace:${colors.reset}`);
				console.error(error.stack);
			}
		}
	}

	// Convenience methods with specific icons
	loading(message: string): void {
		this.info(message, icons.loading);
	}

	rocket(message: string): void {
		this.info(message, icons.rocket);
	}

	bookmark(message: string): void {
		this.info(message, icons.bookmark);
	}

	video(message: string): void {
		this.info(message, icons.video);
	}

	finish(message: string): void {
		this.success(message);
	}

	// Progress bar functionality  
	async progress(current: number, total: number, message: string): Promise<void> {
		if (this.quiet) return;

		const percentage = Math.floor((current / total) * 100);
		const barLength = 20;
		const filledLength = Math.floor((current / total) * barLength);
		const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
		
		const progressMessage = `[${bar}] ${percentage}% (${current}/${total}) ${message}`;
		
		// Clear line and write progress
		await Deno.stdout.write(new TextEncoder().encode(`\r${progressMessage}`));
		
		// If complete, add newline
		if (current === total) {
			await Deno.stdout.write(new TextEncoder().encode("\n"));
		}
	}

	// Clear current line (useful for progress updates)
	async clearLine(): Promise<void> {
		if (!this.quiet) {
			await Deno.stdout.write(new TextEncoder().encode("\r\x1b[K"));
		}
	}
}