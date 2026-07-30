/**
 * OpenAI Realtime Transcription API Client
 * GPT Live Transcribe (`gpt-live-transcribe`) 統合
 */

const OPENAI_API_BASE = "https://api.openai.com/v1";
const OPENAI_LIVE_TRANSCRIBE_MODEL = "gpt-live-transcribe";
/** OpenAI Realtime API の `audio/pcm` は 24kHz 固定 */
const OPENAI_INPUT_SAMPLE_RATE = 24000;
/** クライアントシークレットの有効期間（秒） */
const CLIENT_SECRET_TTL_SECONDS = 600;

/**
 * Get the OpenAI API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return apiKey;
}

/**
 * Generate an ephemeral client secret for realtime transcription
 *
 * APIキーを直接クライアントに渡さず、サーバー側で短命の
 * client secret を発行してWebSocket接続に使わせる。
 *
 * @returns Promise<string> - ephemeral client secret (`ek_...`)
 */
export async function generateOpenAIRealtimeToken(): Promise<string> {
  const apiKey = getApiKey();

  console.log("[OpenAI Realtime] Generating ephemeral client secret");

  const response = await fetch(`${OPENAI_API_BASE}/realtime/client_secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: CLIENT_SECRET_TTL_SECONDS,
      },
      session: {
        type: "transcription",
        audio: {
          input: {
            format: { type: "audio/pcm", rate: OPENAI_INPUT_SAMPLE_RATE },
            noise_reduction: { type: "near_field" },
            transcription: { model: OPENAI_LIVE_TRANSCRIBE_MODEL },
            turn_detection: { type: "server_vad" },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(
      `[OpenAI Realtime] Client secret generation failed: ${response.status}`,
    );
    throw new Error(
      `Failed to generate realtime token: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { value?: string };

  if (!data.value) {
    throw new Error("Client secret not found in response");
  }

  console.log("[OpenAI Realtime] Client secret generated successfully");
  return data.value;
}
