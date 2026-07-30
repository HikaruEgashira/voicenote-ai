/**
 * リアルタイム文字起こしクライアントの共通契約
 *
 * ElevenLabs Scribe Realtime v2 と OpenAI GPT Live Transcribe は
 * プロトコルが全く異なるが、フック側から見た使い方は同じになるよう
 * ここでインターフェースを揃えている。
 */

import type {
  RealtimeOptions,
  RealtimeProvider,
} from "@/packages/types/realtime-transcription";

/**
 * WebSocket接続イベント
 */
export type RealtimeEvent =
  | "session_started"
  | "partial"
  | "committed"
  | "committedWithTimestamps"
  | "error"
  | "close";

/**
 * イベントハンドラの型定義
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RealtimeEventHandler = (data: any) => void;

/**
 * プロバイダ非依存のリアルタイム文字起こしクライアント
 */
export interface RealtimeClient {
  /** 接続を確立し、セッション開始のackを待つ */
  connect(token: string, options?: RealtimeOptions): Promise<void>;
  /**
   * 音声チャンクを送信
   *
   * @param audioBase64 - Base64エンコードされたPCM16音声データ
   * @param sampleRate - 送信元のサンプルレート（Hz）。
   *   プロバイダが別のレートを要求する場合は実装側で変換する。
   */
  sendAudioChunk(audioBase64: string, sampleRate?: number): void;
  /** 接続を切断 */
  disconnect(): void;
  /** イベントハンドラを登録 */
  on(event: RealtimeEvent, handler: RealtimeEventHandler): void;
  /** イベントハンドラを削除 */
  off(event: RealtimeEvent): void;
  /** 接続状態 */
  readonly isConnected: boolean;
}

/**
 * プロバイダに対応するトークン発行エンドポイントのパス
 */
export const REALTIME_TOKEN_PATHS: Record<RealtimeProvider, string> = {
  // Even G2 グラス向けに公開済みのパス。互換性のため維持している。
  elevenlabs: "/api/even-g2/realtime-token",
  openai: "/api/openai/realtime-token",
};
