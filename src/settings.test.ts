import { describe, expect, it } from "vitest";
import {
	cleanBaseFolder,
	cleanChannelIds,
	cleanInterval,
	cleanMinimumOverlapMinutes,
	cleanOverlapThreshold,
	cleanSubdomain,
	cleanTranscriptSourcePreference,
	invalidChannelInputs,
	isValidSyncSince,
	isValidTemplate,
	toChannelId,
} from "./settings";

/** Real ids from the workspace spike: base64("Channel:<numeric id>"). */
const AC_STUFF = "Q2hhbm5lbDoyMDczNjA4"; // Channel:2073608
const MFE_STUFF = "Q2hhbm5lbDoyMDczNjA5"; // Channel:2073609

describe("cleanBaseFolder", () => {
	it("trims whitespace and strips leading/trailing slashes", () => {
		expect(cleanBaseFolder("  /Notes/MacParakeet/  ")).toBe(
			"Notes/MacParakeet",
		);
	});

	it("collapses duplicate slashes", () => {
		expect(cleanBaseFolder("a//b///c")).toBe("a/b/c");
	});

	it("returns an empty base when blank (defaults to the vault root)", () => {
		expect(cleanBaseFolder("   ")).toBe("");
		expect(cleanBaseFolder("///")).toBe("");
	});
});

describe("isValidTemplate", () => {
	it("accepts a non-empty template", () => {
		expect(isValidTemplate("Meetings/{n}-{title}")).toBe(true);
	});

	it("rejects an empty or whitespace-only template", () => {
		expect(isValidTemplate("")).toBe(false);
		expect(isValidTemplate("   ")).toBe(false);
	});
});

describe("cleanInterval", () => {
	it("parses a positive integer", () => {
		expect(cleanInterval("30")).toBe(30);
		expect(cleanInterval(45)).toBe(45);
	});

	it("treats 0 as off", () => {
		expect(cleanInterval("0")).toBe(0);
	});

	it("floors fractional values", () => {
		expect(cleanInterval("12.9")).toBe(12);
	});

	it("coerces negatives and non-numbers to 0", () => {
		expect(cleanInterval("-5")).toBe(0);
		expect(cleanInterval("abc")).toBe(0);
		expect(cleanInterval("")).toBe(0);
	});
});

describe("cleanSubdomain", () => {
	it("extracts the workspace slug", () => {
		expect(cleanSubdomain("acme")).toBe("acme");
		expect(cleanSubdomain("https://acme.fellow.app/")).toBe("acme");
	});

	it("lowercases and trims", () => {
		expect(cleanSubdomain("  ACME  ")).toBe("acme");
	});

	it("strips the host without a protocol and any trailing path", () => {
		expect(cleanSubdomain("acme.fellow.app")).toBe("acme");
		expect(cleanSubdomain("http://acme.fellow.app/api/v1/me")).toBe("acme");
	});

	it("strips invalid characters", () => {
		expect(cleanSubdomain("acme inc!")).toBe("acmeinc");
	});

	it("returns an empty string for blank input", () => {
		expect(cleanSubdomain("   ")).toBe("");
	});
});

describe("cleanOverlapThreshold", () => {
	it("clamps values to 0-1", () => {
		expect(cleanOverlapThreshold("0.5")).toBe(0.5);
		expect(cleanOverlapThreshold("1.5")).toBe(1);
		expect(cleanOverlapThreshold("-0.1")).toBe(0);
	});

	it("falls back to the default for non-numbers", () => {
		expect(cleanOverlapThreshold("abc")).toBe(0.5);
	});
});

describe("cleanMinimumOverlapMinutes", () => {
	it("parses a non-negative whole number", () => {
		expect(cleanMinimumOverlapMinutes("5")).toBe(5);
		expect(cleanMinimumOverlapMinutes("5.9")).toBe(5);
		expect(cleanMinimumOverlapMinutes("-1")).toBe(0);
	});
});

describe("cleanTranscriptSourcePreference", () => {
	it("accepts all supported transcript preferences", () => {
		expect(cleanTranscriptSourcePreference("all")).toBe("all");
		expect(cleanTranscriptSourcePreference("macparakeet")).toBe("macparakeet");
		expect(cleanTranscriptSourcePreference("fellow")).toBe("fellow");
	});

	it("falls back to syncing every source for unknown values", () => {
		expect(cleanTranscriptSourcePreference("other")).toBe("all");
	});
});

describe("isValidSyncSince", () => {
	it("accepts an empty value (meaning the install date)", () => {
		expect(isValidSyncSince("")).toBe(true);
		expect(isValidSyncSince("   ")).toBe(true);
	});

	it("accepts a real YYYY-MM-DD date", () => {
		expect(isValidSyncSince("2026-06-12")).toBe(true);
	});

	it("rejects a malformed or impossible date", () => {
		expect(isValidSyncSince("2026/06/12")).toBe(false);
		expect(isValidSyncSince("12-06-2026")).toBe(false);
		expect(isValidSyncSince("2026-13-40")).toBe(false);
		expect(isValidSyncSince("garbage")).toBe(false);
	});
});

describe("toChannelId", () => {
	it("extracts the id from a pasted channel URL", () => {
		expect(
			toChannelId("https://acme.fellow.app/library/c/Q2hhbm5lbDoyMDczNjA4/"),
		).toBe(AC_STUFF);
	});

	it("tolerates a URL without the trailing slash", () => {
		expect(toChannelId("https://acme.fellow.app/library/c/Q2hhbm5lbDoyMDczNjA4")).toBe(
			AC_STUFF,
		);
	});

	it("encodes a bare numeric id the way the REST filter expects", () => {
		expect(toChannelId("2073608")).toBe(AC_STUFF);
		expect(toChannelId("  2073609  ")).toBe(MFE_STUFF);
	});

	it("passes an opaque id through unchanged", () => {
		expect(toChannelId(AC_STUFF)).toBe(AC_STUFF);
	});

	it("rejects a string that does not decode to a channel global id", () => {
		// Would have been accepted as 'looks like base64' without the decode check,
		// then failed mid-sync with a 400 instead of in settings.
		expect(toChannelId("AAAAAAAAAA")).toBeNull();
		expect(toChannelId("bm90LWEtY2hhbm5lbA==")).toBeNull(); // "not-a-channel"
		expect(toChannelId("definitely not an id")).toBeNull();
		expect(toChannelId("")).toBeNull();
	});
});

describe("cleanChannelIds", () => {
	it("returns an empty list for blank input (meaning every channel)", () => {
		expect(cleanChannelIds("")).toEqual([]);
		expect(cleanChannelIds("  \n  ")).toEqual([]);
	});

	it("parses newline- and comma-separated entries", () => {
		expect(cleanChannelIds(`${AC_STUFF}\n${MFE_STUFF}`)).toEqual([
			AC_STUFF,
			MFE_STUFF,
		]);
		expect(cleanChannelIds(`${AC_STUFF}, ${MFE_STUFF}`)).toEqual([
			AC_STUFF,
			MFE_STUFF,
		]);
	});

	it("normalizes mixed forms to the same id and dedupes", () => {
		const input = [
			"https://acme.fellow.app/library/c/Q2hhbm5lbDoyMDczNjA4/",
			"2073608",
			AC_STUFF,
		].join("\n");
		expect(cleanChannelIds(input)).toEqual([AC_STUFF]);
	});

	it("drops unparseable entries rather than passing them to the API", () => {
		expect(cleanChannelIds(`${AC_STUFF}\ngarbage`)).toEqual([AC_STUFF]);
	});
});

describe("invalidChannelInputs", () => {
	it("names the entries that could not be parsed", () => {
		expect(invalidChannelInputs(`${AC_STUFF}\ngarbage\n2073609`)).toEqual([
			"garbage",
		]);
	});

	it("is empty when every entry parses", () => {
		expect(invalidChannelInputs(`${AC_STUFF}\n2073609`)).toEqual([]);
	});
});
