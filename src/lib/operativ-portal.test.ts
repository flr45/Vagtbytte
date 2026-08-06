import { describe, expect, it } from "vitest";
import { extractYouTubeId, youtubeEmbedUrl } from "./operativ-portal";

describe("operativ portal YouTube links", () => {
  it.each([
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"]
  ])("extracts %s", (input, expected) => {
    expect(extractYouTubeId(input)).toBe(expected);
  });

  it("rejects unsupported links", () => {
    expect(extractYouTubeId("https://example.com/video")).toBeNull();
  });

  it("uses the privacy-enhanced player", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });
});
