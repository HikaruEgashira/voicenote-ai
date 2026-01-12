/**
 * Whisperモデル管理Hook
 *
 * Whisperモデルのロード、状態管理、文字起こしを提供するReact Hook
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import {
  getWhisperService,
  WhisperService,
  type WhisperEvent,
} from "@/packages/lib/whisper/whisper-service";
import type {
  WhisperModelSize,
  WhisperModelState,
  WhisperTranscriptionResult,
  WhisperTranscriptionOptions,
  WhisperModelConfig,
} from "@/packages/lib/whisper/whisper-types";

export interface UseWhisperModelOptions {
  autoLoad?: boolean;
  defaultModel?: WhisperModelSize;
  useWebGPU?: boolean;
}

export interface UseWhisperModelReturn {
  state: WhisperModelState;
  loadModel: (modelSize: WhisperModelSize, useWebGPU?: boolean) => Promise<void>;
  unloadModel: () => void;
  transcribe: (audioData: Float32Array, options?: WhisperTranscriptionOptions) => Promise<void>;
  startRealtimeSession: (options?: WhisperTranscriptionOptions) => void;
  addAudioChunk: (chunk: Float32Array) => void;
  stopRealtimeSession: (options?: WhisperTranscriptionOptions) => Promise<void>;
  lastResult: WhisperTranscriptionResult | null;
  availableModels: WhisperModelConfig[];
  isWebGPUSupported: boolean;
  isSupported: boolean;
}

export function useWhisperModel(
  options: UseWhisperModelOptions = {}
): UseWhisperModelReturn {
  const { autoLoad = false, defaultModel = "distil-small", useWebGPU = true } = options;

  // Webプラットフォームでのみサポート
  const isSupported = Platform.OS === "web";

  const serviceRef = useRef<WhisperService | null>(null);
  const [state, setState] = useState<WhisperModelState>({
    isLoading: false,
    isLoaded: false,
    loadProgress: 0,
    currentModel: null,
    error: null,
    webGPUSupported: false,
  });
  const [lastResult, setLastResult] = useState<WhisperTranscriptionResult | null>(null);
  const [availableModels, setAvailableModels] = useState<WhisperModelConfig[]>([]);
  const [isWebGPUSupported, setIsWebGPUSupported] = useState(false);

  // サービス初期化
  useEffect(() => {
    if (!isSupported) return;

    const service = getWhisperService();
    serviceRef.current = service;

    // 初期状態を取得
    setState(service.getState());
    setAvailableModels(service.getAvailableModels());
    setIsWebGPUSupported(service.isWebGPUSupported());

    // イベントハンドラを登録
    const unsubscribeLoading = service.on("modelLoading", () => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));
    });

    const unsubscribeProgress = service.on("progress", (event: WhisperEvent) => {
      setState((prev) => ({
        ...prev,
        loadProgress: event.data?.progress ?? prev.loadProgress,
      }));
    });

    const unsubscribeLoaded = service.on("modelLoaded", () => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isLoaded: true,
        loadProgress: 100,
      }));
    });

    const unsubscribeTranscription = service.on("transcription", (event: WhisperEvent) => {
      if (event.data?.result) {
        setLastResult(event.data.result);
      }
    });

    const unsubscribeError = service.on("error", (event: WhisperEvent) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: event.data?.error ?? "Unknown error",
      }));
    });

    // 自動ロード
    if (autoLoad) {
      service.loadModel(defaultModel, useWebGPU);
    }

    return () => {
      unsubscribeLoading();
      unsubscribeProgress();
      unsubscribeLoaded();
      unsubscribeTranscription();
      unsubscribeError();
    };
  }, [isSupported, autoLoad, defaultModel, useWebGPU]);

  // モデルをロード
  const loadModel = useCallback(
    async (modelSize: WhisperModelSize, webGPU?: boolean): Promise<void> => {
      if (!isSupported || !serviceRef.current) return;

      setState((prev) => ({
        ...prev,
        currentModel: modelSize,
        error: null,
      }));

      await serviceRef.current.loadModel(modelSize, webGPU ?? useWebGPU);
    },
    [isSupported, useWebGPU]
  );

  // モデルをアンロード
  const unloadModel = useCallback(() => {
    if (!isSupported || !serviceRef.current) return;
    serviceRef.current.unloadModel();
    setState((prev) => ({
      ...prev,
      isLoaded: false,
      currentModel: null,
    }));
  }, [isSupported]);

  // 文字起こし（バッチ）
  const transcribe = useCallback(
    async (
      audioData: Float32Array,
      transcriptionOptions?: WhisperTranscriptionOptions
    ): Promise<void> => {
      if (!isSupported || !serviceRef.current) return;
      await serviceRef.current.transcribe(audioData, transcriptionOptions);
    },
    [isSupported]
  );

  // リアルタイムセッション開始
  const startRealtimeSession = useCallback(
    (transcriptionOptions?: WhisperTranscriptionOptions): void => {
      if (!isSupported || !serviceRef.current) return;
      serviceRef.current.startRealtimeSession(transcriptionOptions);
    },
    [isSupported]
  );

  // 音声チャンク追加
  const addAudioChunk = useCallback(
    (chunk: Float32Array): void => {
      if (!isSupported || !serviceRef.current) return;
      serviceRef.current.addAudioChunk(chunk);
    },
    [isSupported]
  );

  // リアルタイムセッション停止
  const stopRealtimeSession = useCallback(
    async (transcriptionOptions?: WhisperTranscriptionOptions): Promise<void> => {
      if (!isSupported || !serviceRef.current) return;
      await serviceRef.current.stopRealtimeSession(transcriptionOptions);
    },
    [isSupported]
  );

  return {
    state,
    loadModel,
    unloadModel,
    transcribe,
    startRealtimeSession,
    addAudioChunk,
    stopRealtimeSession,
    lastResult,
    availableModels,
    isWebGPUSupported,
    isSupported,
  };
}

/**
 * Whisper利用可能かチェック（Web環境かつFirefoxやChromeなど）
 */
export function isWhisperAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof Worker === 'undefined') return false;
  return true;
}
