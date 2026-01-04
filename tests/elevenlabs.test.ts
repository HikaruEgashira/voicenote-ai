import { describe, it, expect } from "vitest";

describe("ElevenLabs API Key Validation", () => {
  it("should have ELEVENLABS_API_KEY environment variable set", () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");
  });

  it("should validate API key by fetching user info", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not set");
    }

    // Use user endpoint which should work with most API key permissions
    const response = await fetch("https://api.elevenlabs.io/v1/user", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} ${response.statusText}`);
      console.error(`Response: ${errorText}`);
      // If 401, the API key is invalid
      if (response.status === 401) {
        throw new Error("Invalid ElevenLabs API key. Please check your API key and ensure it has the required permissions.");
      }
    }
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty("subscription");
  }, 15000); // 15 second timeout
});
