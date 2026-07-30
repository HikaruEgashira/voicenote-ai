/**
 * リアルタイム文字起こし機能の型定義
 */

/**
 * リアルタイム文字起こしのプロバイダ
 * - `elevenlabs`: ElevenLabs Scribe Realtime v2
 * - `openai`: OpenAI GPT Live Transcribe (`gpt-live-transcribe`)
 */
export type RealtimeProvider = "elevenlabs" | "openai";

/**
 * GPT Live Transcribe のレイテンシ / 精度のトレードオフ設定
 */
export type OpenAITranscriptionDelay =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

/**
 * リアルタイム文字起こしのオプション
 */
export interface RealtimeOptions {
  /** 使用するリアルタイム文字起こしプロバイダ（既定: elevenlabs） */
  provider?: RealtimeProvider;
  /** 言語コード（ISO 639-1形式）。`auto` の場合は自動判定に委ねる */
  languageCode?: string;
  /** Voice Activity Detection設定 */
  vad?: {
    /** 沈黙判定時間（秒） */
    silenceThresholdSecs?: number;
    /** 最小音声継続時間（ミリ秒） */
    minSpeechDurationMs?: number;
  };
  /** 内部マイクストリーミングをスキップ（外部から音声を送信する場合） */
  skipAudioStreaming?: boolean;
  /** OpenAI (GPT Live Transcribe) 固有の設定 */
  openai?: {
    /** 認識を補助する固有名詞などのキーワード */
    keywords?: string[];
    /** 会話の文脈を伝えるプロンプト */
    prompt?: string;
    /** レイテンシと精度のトレードオフ */
    delay?: OpenAITranscriptionDelay;
  };
}

/**
 * 文字起こしセグメント
 */
export interface TranscriptSegment {
  /** 一意のID */
  id: string;
  /** テキスト内容 */
  text: string;
  /** 部分的な結果か確定結果か */
  isPartial: boolean;
  /** 録音開始からのタイムスタンプ（秒） */
  timestamp: number;
  /** 話者ID（diarizationが有効な場合） */
  speaker?: string;
  /** 信頼度スコア（0-1） */
  confidence?: number;
  /**
   * 表示用に結合された場合の構成元セグメントIDリスト（mergeSegmentsが付与）。
   * 結合表示でも各構成セグメントの翻訳を引き当てられるようにするための一時フィールド。
   * 永続化はされない。
   */
  sourceIds?: string[];
}

/**
 * リアルタイム文字起こしの状態
 */
export interface RealtimeTranscriptionState {
  /** セッションがアクティブかどうか */
  isActive: boolean;
  /** 文字起こしセグメントのリスト */
  segments: TranscriptSegment[];
  /** WebSocket接続状態 */
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  /** エラーメッセージ */
  error?: string;
}

/**
 * ElevenLabs Realtime APIメッセージ型
 */
export interface RealtimeMessage {
  /** メッセージタイプ（ElevenLabsは message_type を使用） */
  message_type?: string;
  /** 旧フィールド名（互換性のため） */
  type?: string;
  /** メッセージデータ */
  [key: string]: unknown;
}

/**
 * Partial Transcriptメッセージ
 */
export interface PartialTranscriptMessage extends RealtimeMessage {
  type: "partial_transcript";
  /** 部分的な文字起こしテキスト */
  text: string;
}

/**
 * Committed Transcriptメッセージ
 */
export interface CommittedTranscriptMessage extends RealtimeMessage {
  type: "committed_transcript";
  /** 確定した文字起こしテキスト */
  text: string;
}

/**
 * Committed Transcript with Timestampsメッセージ
 */
export interface CommittedTranscriptWithTimestampsMessage extends RealtimeMessage {
  type: "committed_transcript_with_timestamps";
  /** 確定した文字起こしテキスト */
  text: string;
  /** 単語レベルの情報 */
  words: Array<{
    text: string;
    start: number;
    end: number;
    speaker_id?: string;
  }>;
}

/**
 * エラーメッセージ
 */
export interface ErrorMessage extends RealtimeMessage {
  message_type: string;
  /** エラーメッセージ */
  error: string;
}

/**
 * OpenAI Realtime API のサーバーイベント
 *
 * transcription セッションでは `conversation.item.input_audio_transcription.*`
 * が文字起こし結果を運ぶ。delta は差分テキストであり、クライアント側で
 * item_id ごとに連結して途中結果を組み立てる。
 */
export interface OpenAIRealtimeEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * 文字起こしの差分（途中結果）
 */
export interface OpenAITranscriptionDeltaEvent extends OpenAIRealtimeEvent {
  type: "conversation.item.input_audio_transcription.delta";
  item_id: string;
  /** 前回からの差分テキスト */
  delta: string;
}

/**
 * 文字起こしの確定結果
 */
export interface OpenAITranscriptionCompletedEvent extends OpenAIRealtimeEvent {
  type: "conversation.item.input_audio_transcription.completed";
  item_id: string;
  /** 確定した全文 */
  transcript: string;
  /** 検出された言語（対応モデルのみ） */
  languages?: Array<{ code: string }>;
}

/**
 * OpenAI Realtime API のエラーイベント
 */
export interface OpenAIRealtimeErrorEvent extends OpenAIRealtimeEvent {
  type: "error";
  error: {
    type?: string;
    code?: string;
    message?: string;
  };
}

/**
 * 翻訳ステータス
 */
export type TranslationStatus = "pending" | "completed" | "error";

/**
 * 翻訳対応言語
 */
export type TargetLanguage = "ja" | "en";

/**
 * 翻訳設定
 */
export interface TranslationSettings {
  enabled: boolean;
  targetLanguage: TargetLanguage;
}

/**
 * 翻訳リクエスト
 */
export interface TranslateRequest {
  texts: Array<{ id: string; text: string }>;
  targetLanguage: string;
}

/**
 * 翻訳レスポンス
 */
export interface TranslateResponse {
  translations: Array<{ id: string; translatedText: string }>;
}
