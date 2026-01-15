/**
 * Whisperローカル音声認識の型定義
 */

export type WhisperModelSize = "distil-small" | "tiny" | "base" | "small" | "large-v3-turbo";

export interface WhisperModelConfig {
  id: WhisperModelSize;
  modelId: string;
  label: string;
  description: string;
  size: string;
  recommended?: boolean;
}

export const WHISPER_MODELS: WhisperModelConfig[] = [
  {
    id: "distil-small",
    modelId: "distil-whisper/distil-small.en",
    label: "Distil Small",
    description: "高速・推奨（4.2倍高速）",
    size: "~40MB",
    recommended: true,
  },
  {
    id: "tiny",
    modelId: "Xenova/whisper-tiny",
    label: "Tiny",
    description: "軽量・日本語対応",
    size: "~75MB",
  },
  {
    id: "base",
    modelId: "Xenova/whisper-base",
    label: "Base",
    description: "バランス・日本語対応",
    size: "~142MB",
  },
  {
    id: "small",
    modelId: "Xenova/whisper-small",
    label: "Small",
    description: "高精度・日本語対応",
    size: "~466MB",
  },
  {
    id: "large-v3-turbo",
    modelId: "onnx-community/whisper-large-v3-turbo",
    label: "Large V3 Turbo",
    description: "最高精度（WebGPU推奨）",
    size: "~1.5GB",
  },
];

export interface WhisperTranscriptionOptions {
  language?: string;
  task?: "transcribe" | "translate";
  returnTimestamps?: boolean;
  chunkLengthS?: number;
  strideLengthS?: number;
}

export interface WhisperTranscriptionResult {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

export interface WhisperWorkerMessage {
  type: "LOAD_MODEL" | "TRANSCRIBE" | "UNLOAD_MODEL";
  payload?: {
    modelId?: string;
    useWebGPU?: boolean;
    audioData?: Float32Array;
    options?: WhisperTranscriptionOptions;
  };
}

export interface WhisperWorkerResponse {
  type: "MODEL_LOADING" | "MODEL_LOADED" | "PROGRESS" | "RESULT" | "ERROR" | "MODEL_UNLOADED";
  payload?: {
    progress?: number;
    status?: string;
    result?: WhisperTranscriptionResult;
    error?: string;
    file?: string;
    loaded?: number;
    total?: number;
  };
}

export interface WhisperModelState {
  isLoading: boolean;
  isLoaded: boolean;
  loadProgress: number;
  currentModel: WhisperModelSize | null;
  error: string | null;
  webGPUSupported: boolean;
}
