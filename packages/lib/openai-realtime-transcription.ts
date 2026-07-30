/**
 * OpenAI GPT Live Transcribe Realtime Transcription WebSocket Client
 *
 * `gpt-live-transcribe` を使ったリアルタイム文字起こしのWebSocket接続を管理する。
 *
 * ElevenLabs との主な違い:
 * - 音声は 24kHz PCM16 固定（アプリの 16kHz ストリームは送信時にリサンプルする）
 * - 途中結果は「差分（delta）」で届くため、item_id ごとに連結して全文へ復元する
 * - 認証は ephemeral client secret を WebSocket サブプロトコルで渡す
 */

import type {
  RealtimeOptions,
  OpenAIRealtimeEvent,
  OpenAITranscriptionDeltaEvent,
  OpenAITranscriptionCompletedEvent,
  OpenAIRealtimeErrorEvent,
} from "@/packages/types/realtime-transcription";
import type {
  RealtimeClient,
  RealtimeEvent,
  RealtimeEventHandler,
} from "./realtime-client";
import {
  createPcm16Resampler,
  resamplePcm16Base64,
  type Pcm16Resampler,
} from "./pcm-resample";

const OPENAI_REALTIME_ENDPOINT = "wss://api.openai.com/v1/realtime";
export const OPENAI_LIVE_TRANSCRIBE_MODEL = "gpt-live-transcribe";
/** OpenAI Realtime API の `audio/pcm` は 24kHz 固定 */
export const OPENAI_INPUT_SAMPLE_RATE = 24000;

const SESSION_START_TIMEOUT_MS = 10000;
/** 切断前に最後の確定結果を待つ上限 */
const FINALIZE_TIMEOUT_MS = 2000;

const DELTA_EVENT = "conversation.item.input_audio_transcription.delta";
const COMPLETED_EVENT = "conversation.item.input_audio_transcription.completed";
const FAILED_EVENT = "conversation.item.input_audio_transcription.failed";

/**
 * セッション設定が受理されたことを示すイベント。
 * GA 以前の `transcription_session.updated` も受け付ける。
 */
const SESSION_ACK_EVENTS = new Set([
  "session.updated",
  "transcription_session.updated",
]);

function getErrorMessage(event: OpenAIRealtimeEvent): string {
  const error = (event as OpenAIRealtimeErrorEvent).error;
  if (error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  if (typeof event.message === "string" && event.message) {
    return event.message;
  }
  return "Realtime transcription failed";
}

function getErrorCode(event: OpenAIRealtimeEvent): string | undefined {
  const error = (event as OpenAIRealtimeErrorEvent).error;
  return error?.code ?? error?.type;
}

/**
 * セッション設定（session.update）のペイロードを組み立てる
 */
export function buildSessionUpdate(options: RealtimeOptions = {}): Record<
  string,
  unknown
> {
  const languageCode = options.languageCode;
  const silenceSecs = options.vad?.silenceThresholdSecs ?? 0.5;

  const transcription: Record<string, unknown> = {
    model: OPENAI_LIVE_TRANSCRIBE_MODEL,
  };

  // `auto` は言語ヒントを付けず自動判定に委ねる
  if (languageCode && languageCode !== "auto") {
    transcription.languages = [languageCode];
  }
  if (options.openai?.prompt) {
    transcription.prompt = options.openai.prompt;
  }
  if (options.openai?.keywords?.length) {
    transcription.keywords = options.openai.keywords;
  }
  if (options.openai?.delay) {
    transcription.delay = options.openai.delay;
  }

  return {
    type: "session.update",
    session: {
      type: "transcription",
      audio: {
        input: {
          format: { type: "audio/pcm", rate: OPENAI_INPUT_SAMPLE_RATE },
          noise_reduction: { type: "near_field" },
          transcription,
          // ElevenLabs の commit_strategy: "vad" と揃え、無音区切りで自動確定させる
          turn_detection: {
            type: "server_vad",
            silence_duration_ms: Math.round(silenceSecs * 1000),
            prefix_padding_ms: 300,
            threshold: 0.5,
          },
        },
      },
    },
  };
}

/**
 * OpenAI GPT Live Transcribe クライアント
 */
export class OpenAIRealtimeTranscriptionClient implements RealtimeClient {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<RealtimeEvent, RealtimeEventHandler> = new Map();
  private isConnecting = false;
  /** item_id ごとの差分累積テキスト */
  private partialTexts: Map<string, string> = new Map();
  private resampler: Pcm16Resampler | null = null;
  private resamplerInputRate = 0;
  /** 直近のコミット以降に音声を送ったか（未確定バッファの有無） */
  private hasPendingAudio = false;
  /** finalize() 中の確定待ちを解除するためのコールバック */
  private finalizeResolve: (() => void) | null = null;
  /** finalize() 中はエラー通知を抑止する（空バッファのcommit等） */
  private isFinalizing = false;

  /**
   * WebSocket接続を確立
   *
   * @param token - ephemeral client secret（サーバーから取得）
   * @param options - リアルタイム文字起こしのオプション
   */
  async connect(token: string, options: RealtimeOptions = {}): Promise<void> {
    if (this.isConnecting) {
      console.log("[OpenAIRealtimeClient] Connection already in progress");
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("[OpenAIRealtimeClient] Already connected");
      return;
    }

    this.isConnecting = true;
    this.partialTexts.clear();
    this.resampler?.reset();
    this.hasPendingAudio = false;
    this.isFinalizing = false;

    try {
      const url = `${OPENAI_REALTIME_ENDPOINT}?intent=transcription`;

      console.log("[OpenAIRealtimeClient] Connecting to WebSocket...");
      // ブラウザ/RN の WebSocket はヘッダを付けられないため、
      // ephemeral key をサブプロトコルで渡す（OpenAI の規定）
      const ws = new WebSocket(url, [
        "realtime",
        `openai-insecure-api-key.${token}`,
      ]);
      this.ws = ws;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("Realtime session start timeout"));
        }, SESSION_START_TIMEOUT_MS);

        const resolveSession = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve();
        };

        const rejectSession = (error: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(error);
        };

        ws.onopen = () => {
          console.log("[OpenAIRealtimeClient] WebSocket connected");
          // 接続直後にセッション設定を送る。ackは session.updated で受け取る。
          ws.send(JSON.stringify(buildSessionUpdate(options)));
        };

        ws.onerror = () => {
          const error = new Error("WebSocket connection failed");
          console.error("[OpenAIRealtimeClient] WebSocket error");
          this.isConnecting = false;
          this.emit("error", { message: error.message });
          rejectSession(error);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(
              event.data as string,
            ) as OpenAIRealtimeEvent;

            if (SESSION_ACK_EVENTS.has(message.type)) {
              this.isConnecting = false;
              this.emit("session_started", message);
              resolveSession();
              return;
            }

            this.handleMessage(message);
            if (message.type === "error") {
              rejectSession(new Error(getErrorMessage(message)));
            }
          } catch {
            const parseError = new Error(
              "サーバーから不正なメッセージを受信しました",
            );
            console.error("[OpenAIRealtimeClient] Failed to parse message");
            this.emit("error", { message: parseError.message });
            rejectSession(parseError);
          }
        };

        ws.onclose = () => {
          console.log("[OpenAIRealtimeClient] WebSocket closed");
          this.isConnecting = false;
          if (this.ws === ws) {
            this.ws = null;
          }
          if (!settled) {
            rejectSession(
              new Error("Realtime transcription connection closed"),
            );
            return;
          }
          this.emit("close", {});
        };
      });
    } catch (error) {
      this.isConnecting = false;
      const ws = this.ws;
      this.ws = null;
      ws?.close();
      throw error;
    }
  }

  /**
   * 音声チャンクを送信
   *
   * @param audioBase64 - Base64エンコードされたPCM16音声データ
   * @param sampleRate - 送信元のサンプルレート（Hz）。24kHz以外は自動でリサンプルする。
   */
  sendAudioChunk(audioBase64: string, sampleRate: number = 16000): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(
        "[OpenAIRealtimeClient] WebSocket not connected, cannot send audio chunk",
      );
      return;
    }

    let audio = audioBase64;
    if (sampleRate !== OPENAI_INPUT_SAMPLE_RATE) {
      if (!this.resampler || this.resamplerInputRate !== sampleRate) {
        this.resampler = createPcm16Resampler(
          sampleRate,
          OPENAI_INPUT_SAMPLE_RATE,
        );
        this.resamplerInputRate = sampleRate;
      }
      audio = resamplePcm16Base64(audioBase64, this.resampler);
      if (!audio) return;
    }

    this.ws.send(
      JSON.stringify({ type: "input_audio_buffer.append", audio }),
    );
    this.hasPendingAudio = true;
  }

  /**
   * 未確定の音声バッファを確定させ、確定結果が届くまで短時間待つ
   *
   * server_vad の無音待ち中に録音を止めると最後の発話が失われるため、
   * 明示的に commit してから切断する。
   */
  async finalize(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.hasPendingAudio) return;

    this.isFinalizing = true;
    this.hasPendingAudio = false;

    try {
      this.ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    } catch {
      this.isFinalizing = false;
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.finalizeResolve = null;
        resolve();
      };
      const timeout = setTimeout(finish, FINALIZE_TIMEOUT_MS);
      this.finalizeResolve = finish;
    });

    this.isFinalizing = false;
  }

  /**
   * WebSocket接続を切断
   */
  disconnect(): void {
    const ws = this.ws;
    this.ws = null;
    this.eventHandlers.clear();
    this.partialTexts.clear();
    this.resampler = null;
    this.resamplerInputRate = 0;
    this.hasPendingAudio = false;
    this.isFinalizing = false;
    this.finalizeResolve?.();
    if (ws) {
      console.log("[OpenAIRealtimeClient] Disconnecting WebSocket");
      ws.close();
    }
    this.isConnecting = false;
  }

  on(event: RealtimeEvent, handler: RealtimeEventHandler): void {
    this.eventHandlers.set(event, handler);
  }

  off(event: RealtimeEvent): void {
    this.eventHandlers.delete(event);
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * サーバーイベントを処理
   */
  private handleMessage(message: OpenAIRealtimeEvent): void {
    switch (message.type) {
      case DELTA_EVENT: {
        const data = message as OpenAITranscriptionDeltaEvent;
        if (typeof data.delta !== "string" || data.delta.length === 0) break;
        // delta は差分なので item_id ごとに連結して全文へ戻す
        const accumulated =
          (this.partialTexts.get(data.item_id) ?? "") + data.delta;
        this.partialTexts.set(data.item_id, accumulated);
        this.emit("partial", { text: accumulated, itemId: data.item_id });
        break;
      }

      case COMPLETED_EVENT: {
        const data = message as OpenAITranscriptionCompletedEvent;
        this.partialTexts.delete(data.item_id);
        const text = typeof data.transcript === "string" ? data.transcript : "";
        // finalize() の待ちは、確定テキストが空でも解除する
        this.finalizeResolve?.();
        if (!text) break;
        this.emit("committed", { text, itemId: data.item_id });
        break;
      }

      case FAILED_EVENT: {
        const itemId = message.item_id;
        if (typeof itemId === "string") {
          this.partialTexts.delete(itemId);
        }
        console.error("[OpenAIRealtimeClient] Transcription failed");
        this.emit("error", {
          code: getErrorCode(message),
          message: getErrorMessage(message),
        });
        break;
      }

      case "error": {
        if (this.isFinalizing) {
          // 空バッファのcommitなど、切断直前のエラーはユーザーに出さない
          this.finalizeResolve?.();
          break;
        }
        console.error("[OpenAIRealtimeClient] Server error");
        this.emit("error", {
          code: getErrorCode(message),
          message: getErrorMessage(message),
        });
        break;
      }

      // セッション進行に伴う通知。文字起こし結果には影響しないため無視する。
      case "session.created":
      case "transcription_session.created":
      case "conversation.item.created":
      case "conversation.item.added":
      case "input_audio_buffer.committed":
        this.hasPendingAudio = false;
        break;

      case "input_audio_buffer.cleared":
      case "input_audio_buffer.speech_started":
      case "input_audio_buffer.speech_stopped":
      case "rate_limits.updated":
        break;

      default:
        console.log("[OpenAIRealtimeClient] Unhandled event:", message.type);
    }
  }

  private emit(event: RealtimeEvent, data: unknown): void {
    const handler = this.eventHandlers.get(event);
    if (handler) {
      handler(data);
    }
  }
}
