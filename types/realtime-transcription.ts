/**
 * リアルタイム文字起こし機能の型定義
 */

/**
 * ElevenLabs Realtime APIのオプション
 */
export interface RealtimeOptions {
  /** 言語コード（ISO 639-1形式） */
  languageCode?: string;
  /** 話者分離（diarization）を有効化 */
  enableDiarization?: boolean;
  /** Voice Activity Detection設定 */
  vad?: {
    /** 沈黙判定時間（秒） */
    silenceThresholdSecs?: number;
    /** 最小音声継続時間（秒） */
    minSpeechDurationSecs?: number;
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
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** エラーメッセージ */
  error?: string;
}

/**
 * リアルタイム文字起こしの設定
 */
export interface RealtimeTranscriptionSettings {
  /** リアルタイムモードを有効化 */
  enabled: boolean;
  /** 言語コード */
  language: string;
  /** 話者分離を有効化 */
  enableSpeakerDiarization: boolean;
}

/**
 * ElevenLabs Realtime APIメッセージ型
 */
export interface RealtimeMessage {
  /** メッセージタイプ */
  type: 'session_started' | 'partial_transcript' | 'committed_transcript' |
        'committed_transcript_with_timestamps' | 'error';
  /** メッセージデータ */
  [key: string]: unknown;
}

/**
 * Partial Transcriptメッセージ
 */
export interface PartialTranscriptMessage extends RealtimeMessage {
  type: 'partial_transcript';
  /** 部分的な文字起こしテキスト */
  text: string;
}

/**
 * Committed Transcriptメッセージ
 */
export interface CommittedTranscriptMessage extends RealtimeMessage {
  type: 'committed_transcript';
  /** 確定した文字起こしテキスト */
  text: string;
}

/**
 * Committed Transcript with Timestampsメッセージ
 */
export interface CommittedTranscriptWithTimestampsMessage extends RealtimeMessage {
  type: 'committed_transcript_with_timestamps';
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
  type: 'error';
  /** エラーコード */
  code: string;
  /** エラーメッセージ */
  message: string;
}
