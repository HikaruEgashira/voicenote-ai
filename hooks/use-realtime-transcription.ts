/**
 * リアルタイム文字起こしReactフック
 *
 * ElevenLabs Scribe Realtime V2を使用して、
 * 録音中にリアルタイムで文字起こし結果を取得します。
 */

import { useState, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { trpc } from "@/lib/trpc";
import { RealtimeTranscriptionClient } from "@/lib/realtime-transcription";
import type {
  TranscriptSegment,
  RealtimeTranscriptionState,
  RealtimeOptions,
} from "@/types/realtime-transcription";

/**
 * セグメントIDを生成
 */
function generateSegmentId(): string {
  return `segment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * リアルタイム文字起こしフック
 */
export function useRealtimeTranscription() {
  const [state, setState] = useState<RealtimeTranscriptionState>({
    isActive: false,
    segments: [],
    connectionStatus: "disconnected",
    error: undefined,
  });

  const clientRef = useRef<RealtimeTranscriptionClient | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const currentRecordingIdRef = useRef<string | null>(null);

  // tRPC mutation for generating realtime token
  const generateTokenMutation = trpc.ai.generateRealtimeToken.useMutation();

  /**
   * セッションを開始
   *
   * @param recordingId - 録音ID
   * @param options - リアルタイム文字起こしオプション
   */
  const startSession = useCallback(async (
    recordingId: string,
    options: RealtimeOptions = {}
  ): Promise<void> => {
    console.log("[useRealtimeTranscription] Starting session for recording:", recordingId);

    // 既存セッションがある場合は終了
    if (clientRef.current) {
      await stopSession();
    }

    try {
      setState((prev) => ({
        ...prev,
        isActive: true,
        segments: [],
        connectionStatus: "connecting",
        error: undefined,
      }));

      currentRecordingIdRef.current = recordingId;
      recordingStartTimeRef.current = Date.now();

      // トークン取得
      console.log("[useRealtimeTranscription] Fetching token...");
      const tokenResult = await generateTokenMutation.mutateAsync();
      const token = tokenResult.token;

      console.log("[useRealtimeTranscription] Token received, connecting WebSocket...");

      // WebSocketクライアント初期化
      const client = new RealtimeTranscriptionClient();
      clientRef.current = client;

      // イベントハンドラ設定
      client.on("session_started", () => {
        console.log("[useRealtimeTranscription] Session started");
        setState((prev) => ({
          ...prev,
          connectionStatus: "connected",
        }));
      });

      client.on("partial", (data: { text: string }) => {
        console.log("[useRealtimeTranscription] Partial transcript:", data.text.substring(0, 50));

        const timestamp = (Date.now() - recordingStartTimeRef.current) / 1000;

        setState((prev) => {
          // 最後のセグメントがpartialの場合は更新、そうでなければ新規追加
          const lastSegment = prev.segments[prev.segments.length - 1];

          if (lastSegment?.isPartial) {
            // 最後のpartialセグメントを更新
            return {
              ...prev,
              segments: [
                ...prev.segments.slice(0, -1),
                {
                  ...lastSegment,
                  text: data.text,
                  timestamp,
                },
              ],
            };
          } else {
            // 新しいpartialセグメントを追加
            return {
              ...prev,
              segments: [
                ...prev.segments,
                {
                  id: generateSegmentId(),
                  text: data.text,
                  isPartial: true,
                  timestamp,
                },
              ],
            };
          }
        });
      });

      client.on("committed", (data: { text: string }) => {
        console.log("[useRealtimeTranscription] Committed transcript:", data.text);

        const timestamp = (Date.now() - recordingStartTimeRef.current) / 1000;

        setState((prev) => {
          // 最後のpartialセグメントをcommittedに変換、またはテキストが異なる場合は新規追加
          const lastSegment = prev.segments[prev.segments.length - 1];

          if (lastSegment?.isPartial && lastSegment.text === data.text) {
            // partialをcommittedに昇格
            return {
              ...prev,
              segments: [
                ...prev.segments.slice(0, -1),
                {
                  ...lastSegment,
                  isPartial: false,
                  timestamp,
                },
              ],
            };
          } else {
            // 新しいcommittedセグメントを追加
            return {
              ...prev,
              segments: [
                ...prev.segments,
                {
                  id: generateSegmentId(),
                  text: data.text,
                  isPartial: false,
                  timestamp,
                },
              ],
            };
          }
        });
      });

      client.on("committedWithTimestamps", (data: {
        text: string;
        words: Array<{ text: string; start: number; end: number; speaker_id?: string }>;
      }) => {
        console.log("[useRealtimeTranscription] Committed with timestamps:", data.text);

        const timestamp = (Date.now() - recordingStartTimeRef.current) / 1000;

        // 話者情報を抽出
        const speakerId = data.words.find((w) => w.speaker_id)?.speaker_id;

        setState((prev) => {
          // 最後のpartialセグメントをcommittedに変換（話者情報付き）
          const lastSegment = prev.segments[prev.segments.length - 1];

          if (lastSegment?.isPartial) {
            return {
              ...prev,
              segments: [
                ...prev.segments.slice(0, -1),
                {
                  ...lastSegment,
                  text: data.text,
                  isPartial: false,
                  timestamp,
                  speaker: speakerId,
                },
              ],
            };
          } else {
            return {
              ...prev,
              segments: [
                ...prev.segments,
                {
                  id: generateSegmentId(),
                  text: data.text,
                  isPartial: false,
                  timestamp,
                  speaker: speakerId,
                },
              ],
            };
          }
        });
      });

      client.on("error", (error: { code?: string; message: string }) => {
        console.error("[useRealtimeTranscription] Error:", error);

        setState((prev) => ({
          ...prev,
          connectionStatus: "error",
          error: error.message || "接続エラーが発生しました",
        }));

        if (error.code === "QUOTA_EXCEEDED") {
          Alert.alert(
            "クォータ超過",
            "文字起こしクォータに達しました。録音は継続できますが、リアルタイム文字起こしは無効化されます。"
          );
        }
      });

      client.on("close", () => {
        console.log("[useRealtimeTranscription] Connection closed");
        setState((prev) => ({
          ...prev,
          isActive: false,
          connectionStatus: "disconnected",
        }));
      });

      // WebSocket接続
      const connectionOptions: RealtimeOptions = {
        languageCode: options.languageCode || "ja",
        enableDiarization: options.enableDiarization ?? true,
        vad: options.vad || {
          silenceThresholdSecs: 0.5,
          minSpeechDurationSecs: 0.25,
        },
      };

      await client.connect(token, connectionOptions);

      console.log("[useRealtimeTranscription] Session started successfully");
    } catch (error) {
      console.error("[useRealtimeTranscription] Failed to start session:", error);

      setState((prev) => ({
        ...prev,
        isActive: false,
        connectionStatus: "error",
        error: error instanceof Error ? error.message : "セッション開始に失敗しました",
      }));

      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }

      throw error;
    }
  }, []);

  /**
   * セッションを停止
   */
  const stopSession = useCallback(async (): Promise<void> => {
    console.log("[useRealtimeTranscription] Stopping session");

    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isActive: false,
      connectionStatus: "disconnected",
    }));

    currentRecordingIdRef.current = null;
  }, []);

  /**
   * 音声チャンクを送信
   *
   * @param audioBase64 - Base64エンコードされた音声データ
   * @param sampleRate - サンプルレート（Hz）
   */
  const sendAudioChunk = useCallback((audioBase64: string, sampleRate: number = 16000): void => {
    if (!clientRef.current || !clientRef.current.isConnected) {
      console.warn("[useRealtimeTranscription] Client not connected, cannot send audio chunk");
      return;
    }

    try {
      clientRef.current.sendAudioChunk(audioBase64, sampleRate);
    } catch (error) {
      console.error("[useRealtimeTranscription] Failed to send audio chunk:", error);
    }
  }, []);

  /**
   * セグメントを統合して最終的な文字起こしテキストを生成
   *
   * @returns 統合されたテキスト
   */
  const consolidateSegments = useCallback((): string => {
    return state.segments
      .filter((s) => !s.isPartial) // committedセグメントのみ
      .map((s) => {
        if (s.speaker) {
          return `[${s.speaker}]: ${s.text}`;
        }
        return s.text;
      })
      .join("\n\n");
  }, [state.segments]);

  return {
    state,
    startSession,
    stopSession,
    sendAudioChunk,
    consolidateSegments,
  };
}
