/**
 * リアルタイム文字起こしクライアントのファクトリ
 *
 * 設定で選ばれたプロバイダに応じて実装を切り替える。
 */

import type { RealtimeProvider } from "@/packages/types/realtime-transcription";
import type { RealtimeClient } from "./realtime-client";
import { RealtimeTranscriptionClient } from "./realtime-transcription";
import { OpenAIRealtimeTranscriptionClient } from "./openai-realtime-transcription";

export function createRealtimeTranscriptionClient(
  provider: RealtimeProvider = "elevenlabs",
): RealtimeClient {
  switch (provider) {
    case "openai":
      return new OpenAIRealtimeTranscriptionClient();
    case "elevenlabs":
    default:
      return new RealtimeTranscriptionClient();
  }
}
