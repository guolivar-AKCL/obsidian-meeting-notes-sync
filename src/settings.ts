/**
 * Pure settings validation and normalization helpers, kept Obsidian-free so
 * they can be unit-tested. The settings UI lives in settings-tab.ts.
 */

import { DEFAULT_SETTINGS } from "./sync";
import type { TranscriptSourcePreference } from "./sync/types";

/** Normalize a base-folder string: trim, strip stray slashes, fall back to default. */
export function cleanBaseFolder(input: string): string {
	const cleaned = input
		.trim()
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/{2,}/g, "/");
	return cleaned.length > 0 ? cleaned : DEFAULT_SETTINGS.baseFolder;
}

/** A path template is valid when it is non-empty after trimming. */
export function isValidTemplate(input: string): boolean {
	return input.trim().length > 0;
}

/** Coerce an interval field to a non-negative whole number of minutes (0 = off). */
export function cleanInterval(input: string | number): number {
	const value = typeof input === "number" ? input : Number.parseInt(input, 10);
	if (!Number.isFinite(value) || value < 0) {
		return 0;
	}
	return Math.floor(value);
}

/** Normalize a Fellow subdomain: trim, drop protocol/host, fall back to empty. */
export function cleanSubdomain(input: string): string {
	let value = input.trim().toLowerCase();
	value = value.replace(/^https?:\/\//, "");
	value = value.replace(/\.fellow\.app(\/.*)?$/, "");
	return value.replace(/[^a-z0-9-]/g, "");
}

/**
 * Fellow's REST `filters.channel_id` is an opaque global id — base64 of
 * `Channel:<numeric id>` — which is also the last segment of a channel URL
 * (`/library/c/Q2hhbm5lbDoyMDczNjA4/`). There is no channel-listing endpoint,
 * so ids are entered by hand; accept every form a user plausibly has to hand.
 */
export function toChannelId(input: string): string | null {
	const value = input.trim().replace(/[,\s]+$/, "");
	if (value.length === 0) {
		return null;
	}

	// A pasted channel URL: take the single path segment after /c/.
	const candidate = /\/c\/([^/\s?#]+)/.exec(value)?.[1] ?? value;

	// A bare numeric id (what Fellow's UI and MCP tools report) → encode it.
	if (/^\d+$/.test(candidate)) {
		return base64(`Channel:${candidate}`);
	}

	// Already an opaque id. Only accept one that decodes to a channel global id,
	// so a typo fails in settings rather than as a 400 mid-sync.
	if (
		/^[A-Za-z0-9+/=_-]+$/.test(candidate) &&
		/^Channel:\d+$/.test(fromBase64(candidate))
	) {
		return candidate;
	}

	return null;
}

/** Parse the channels field (comma- or newline-separated) into unique ids. */
export function cleanChannelIds(input: string): string[] {
	const ids: string[] = [];
	for (const part of input.split(/[\n,]/)) {
		const id = toChannelId(part);
		if (id && !ids.includes(id)) {
			ids.push(id);
		}
	}
	return ids;
}

/** Entries that could not be parsed, so the settings UI can name them. */
export function invalidChannelInputs(input: string): string[] {
	return input
		.split(/[\n,]/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0 && toChannelId(part) === null);
}

function base64(value: string): string {
	return typeof Buffer !== "undefined"
		? Buffer.from(value, "utf8").toString("base64")
		: btoa(value);
}

/** Decode base64, returning "" for anything malformed. */
function fromBase64(value: string): string {
	try {
		return typeof Buffer !== "undefined"
			? Buffer.from(value, "base64").toString("utf8")
			: atob(value);
	} catch {
		return "";
	}
}

/** Coerce an overlap threshold to a number between 0 and 1. */
export function cleanOverlapThreshold(input: string | number): number {
	const value = typeof input === "number" ? input : Number.parseFloat(input);
	if (!Number.isFinite(value)) {
		return DEFAULT_SETTINGS.overlapThreshold;
	}
	return Math.max(0, Math.min(1, value));
}

/** Coerce a minimum-overlap-minutes field to a non-negative whole number. */
export function cleanMinimumOverlapMinutes(input: string | number): number {
	return cleanInterval(input);
}

/** Normalize which source transcript to keep for merged meetings. */
export function cleanTranscriptSourcePreference(
	input: string,
): TranscriptSourcePreference {
	if (input === "all" || input === "macparakeet" || input === "fellow") {
		return input;
	}
	return DEFAULT_SETTINGS.transcriptSourcePreference;
}

/** A sync-since value is valid when blank (= install date) or a YYYY-MM-DD date. */
export function isValidSyncSince(input: string): boolean {
	const value = input.trim();
	if (value.length === 0) {
		return true;
	}
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
