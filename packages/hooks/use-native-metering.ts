/**
 * ネイティブプラットフォーム（Android/iOS）用の音声レベルメータリングフック
 *
 * expo-audioのメータリングがAndroidで動作しない問題を回避するため、
 * @mykin-ai/expo-audio-stream を使用して音声レベルを取得します。
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";

// ネイティブプラットフォームでのみ expo-audio-stream をインポート
let ExpoPlayAudioStream: any = null;
if (Platform.OS !== "web") {
  try {
    ExpoPlayAudioStream =
      require("@mykin-ai/expo-audio-stream").ExpoPlayAudioStream;
  } catch (e) {
    console.warn("[useNativeMetering] expo-audio-stream not available");
  }
}

interface AudioDataEvent {
  data?: string | Float32Array;
  soundLevel?: number;
}

/**
 * ネイティブプラットフォーム用メータリングフック
 *
 * @param isRecording - 録音中かどうか
 * @returns メータリング値（dB、-60〜0）
 */
export function useNativeMetering(isRecording: boolean): number {
  const [metering, setMetering] = useState<number>(-160);
  const audioSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const isStreamingRef = useRef(false);

  // Base64からPCMデータをデコードしてRMSを計算する関数
  const calculateRmsFromBase64 = useCallback((base64Data: string): number => {
    try {
      // Base64をバイナリに変換
      const binaryString = atob(base64Data);
      const len = binaryString.length;

      // 16-bit PCMとしてRMSを計算
      let sumSquares = 0;
      let sampleCount = 0;

      for (let i = 0; i < len - 1; i += 2) {
        // Little-endian 16-bit signed integer
        const low = binaryString.charCodeAt(i);
        const high = binaryString.charCodeAt(i + 1);
        let sample = (high << 8) | low;
        // 符号付き整数に変換
        if (sample >= 32768) sample -= 65536;
        // 正規化 (-1 to 1)
        const normalizedSample = sample / 32768;
        sumSquares += normalizedSample * normalizedSample;
        sampleCount++;
      }

      if (sampleCount === 0) return 0;

      // RMS計算
      const rms = Math.sqrt(sumSquares / sampleCount);
      return rms;
    } catch {
      return 0;
    }
  }, []);

  const startStreaming = useCallback(async () => {
    if (!ExpoPlayAudioStream || isStreamingRef.current) {
      return;
    }

    try {
      console.log("[useNativeMetering] Starting audio stream for metering...");
      isStreamingRef.current = true;

      // 音声イベントのサブスクリプション
      audioSubscriptionRef.current = ExpoPlayAudioStream.subscribeToAudioEvents(
        (event: AudioDataEvent) => {
          // PCMデータからRMSを計算してdBに変換
          if (event.data && typeof event.data === "string") {
            const rms = calculateRmsFromBase64(event.data);
            // RMS (0〜1) を dB に変換（-60〜0）
            const db = rms > 0 ? 20 * Math.log10(rms) : -60;
            const clampedDb = Math.max(-60, Math.min(0, db));
            setMetering(clampedDb);
          } else if (event.soundLevel !== undefined) {
            // soundLevel が直接提供されている場合はそれを使用
            const db =
              event.soundLevel > 0
                ? 20 * Math.log10(event.soundLevel)
                : -60;
            const clampedDb = Math.max(-60, Math.min(0, db));
            setMetering(clampedDb);
          }
        }
      );

      // 録音を開始（メータリング用、16kHz、モノラル）
      await ExpoPlayAudioStream.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: "pcm_16bit",
        interval: 100, // 100ms間隔で音声データを取得
      });

      console.log("[useNativeMetering] Audio stream started");
    } catch (error) {
      console.error("[useNativeMetering] Failed to start audio stream:", error);
      isStreamingRef.current = false;
    }
  }, [calculateRmsFromBase64]);

  const stopStreaming = useCallback(async () => {
    if (!ExpoPlayAudioStream || !isStreamingRef.current) {
      return;
    }

    try {
      console.log("[useNativeMetering] Stopping audio stream...");

      if (audioSubscriptionRef.current) {
        audioSubscriptionRef.current.remove();
        audioSubscriptionRef.current = null;
      }

      await ExpoPlayAudioStream.stopRecording();
      isStreamingRef.current = false;
      setMetering(-160);

      console.log("[useNativeMetering] Audio stream stopped");
    } catch (error) {
      console.error("[useNativeMetering] Failed to stop audio stream:", error);
      isStreamingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Web では使用しない
    if (Platform.OS === "web") {
      return;
    }

    if (isRecording) {
      startStreaming();
    } else {
      stopStreaming();
    }

    return () => {
      stopStreaming();
    };
  }, [isRecording, startStreaming, stopStreaming]);

  return metering;
}
