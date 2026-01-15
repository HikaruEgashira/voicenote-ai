/**
 * ローカルWhisperモデル管理フック
 * Web環境でのみ動作
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WhisperModelSize } from '@/packages/lib/whisper/whisper-types';
import { getWhisperService, type WhisperEventType, type WhisperEvent } from '@/packages/lib/whisper/whisper-service';

export interface UseWhisperModelState {
  isLoading: boolean;
  isLoaded: boolean;
  loadProgress: number;
  currentModel: WhisperModelSize | null;
  error: string | null;
  webGPUSupported: boolean;
}

export function useWhisperModel() {
  const serviceRef = useRef(getWhisperService());
  const [state, setState] = useState<UseWhisperModelState>(() => {
    const service = serviceRef.current;
    return service.getState();
  });

  // モデルをロード
  const loadModel = useCallback(async (modelSize: WhisperModelSize, useWebGPU = false) => {
    const service = serviceRef.current;
    try {
      await service.loadModel(modelSize, useWebGPU);
    } catch (error) {
      console.error('[useWhisperModel] Failed to load model:', error);
    }
  }, []);

  // 文字起こしを実行
  const transcribe = useCallback(
    async (audioData: Float32Array, options: { language?: string } = {}) => {
      const service = serviceRef.current;
      return new Promise<string>((resolve, reject) => {
        const unsubscribe = service.on('transcription', (event: WhisperEvent) => {
          unsubscribe();
          if (event.data?.result?.text) {
            resolve(event.data.result.text);
          } else {
            reject(new Error('No transcription result'));
          }
        });

        // エラーハンドリング
        const unsubscribeError = service.on('error', (event: WhisperEvent) => {
          unsubscribeError();
          unsubscribe();
          reject(new Error(event.data?.error || 'Transcription error'));
        });

        // タイムアウト（60秒）
        const timeoutId = setTimeout(() => {
          unsubscribe();
          unsubscribeError();
          reject(new Error('Transcription timeout'));
        }, 60000);

        try {
          service.transcribe(audioData, { language: options.language || 'ja' });
        } catch (error) {
          clearTimeout(timeoutId);
          unsubscribe();
          unsubscribeError();
          reject(error);
        }
      });
    },
    []
  );

  // リアルタイムセッション管理
  const startRealtimeSession = useCallback(() => {
    const service = serviceRef.current;
    service.startRealtimeSession({ language: 'ja' });
  }, []);

  const addAudioChunk = useCallback((chunk: Float32Array) => {
    const service = serviceRef.current;
    service.addAudioChunk(chunk);
  }, []);

  const stopRealtimeSession = useCallback(async () => {
    const service = serviceRef.current;
    await service.stopRealtimeSession({ language: 'ja' });
  }, []);

  // モデルをアンロード
  const unloadModel = useCallback(() => {
    const service = serviceRef.current;
    service.unloadModel();
  }, []);

  // イベントリスナー登録
  useEffect(() => {
    const service = serviceRef.current;

    const eventHandlers: Partial<Record<WhisperEventType, (event: WhisperEvent) => void>> = {
      modelLoading: () => {
        setState((prev) => ({ ...prev, isLoading: true }));
      },
      modelLoaded: () => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isLoaded: true,
          loadProgress: 100,
        }));
      },
      progress: (event) => {
        setState((prev) => ({
          ...prev,
          loadProgress: event.data?.progress ?? prev.loadProgress,
        }));
      },
      error: (event) => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: event.data?.error ?? 'Unknown error',
        }));
      },
    };

    const unsubscribers = Object.entries(eventHandlers).map(([type, handler]) => {
      if (handler) {
        return service.on(type as WhisperEventType, handler);
      }
      return () => {};
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      // コンポーネントアンマウント時はサービスを保持（シングルトン）
    };
  }, []);

  return {
    state,
    loadModel,
    transcribe,
    startRealtimeSession,
    addAudioChunk,
    stopRealtimeSession,
    unloadModel,
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
