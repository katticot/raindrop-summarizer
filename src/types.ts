// types.ts - Shared types and interfaces

export interface Config {
	raindropToken: string;
	googleCloudProjectId: string;
	youtubeApiKey?: string;
	collectionId: string;
	maxVideos: number;
	outputPath: string;
	verbose: boolean;
	quiet: boolean;
	databasePath: string;
	concurrency: number;
}

export interface RaindropItem {
	_id: string;
	title: string;
	link: string;
	tags: string[];
	created: string;
	type: string;
	domain: string;
}

export interface RaindropResponse {
	items: RaindropItem[];
	count: number;
}

export interface VideoProcessingResult {
	success: boolean;
	videoUrl: string;
	title: string;
	outputFile?: string;
	error?: string;
	generatedTags?: string[];
	frontMatter?: Record<string, unknown>;
}

export interface CLIOptions {
	help?: boolean;
	version?: boolean;
	tag?: string;
	collection?: string;
	maxVideos?: number;
	dryRun?: boolean;
	verbose?: boolean;
	quiet?: boolean;
	output?: string;
	config?: string;
	updateTags?: boolean;
	force?: boolean;
	listProcessed?: boolean;
	dbPath?: string;
	concurrency?: number;
	playlist?: string;
	listPlaylist?: boolean;
	listMyPlaylists?: boolean;
}

export interface PythonEnvironment {
	pythonPath: string;
	type: "pipx" | "conda" | "system" | "custom";
	valid: boolean;
}

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

export interface ProcessingStats {
	totalBookmarks: number;
	videoBookmarks: number;
	processed: number;
	successful: number;
	failed: number;
	skipped: number;
	startTime: Date;
	endTime?: Date;
}

// Re-export ProcessedVideo from database module for convenience
export type { ProcessedVideo } from "./db/database.ts";
