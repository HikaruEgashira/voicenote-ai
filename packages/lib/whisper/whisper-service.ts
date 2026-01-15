/**
 * Whisperローカル音声認識サービス
 *
 * WebWorkerを使用してWhisperモデルをロードし、
 * リアルタイム音声認識を提供します。
 */

import type {
  WhisperModelSize,
  WhisperModelState,
  WhisperTranscriptionOptions,
  WhisperTranscriptionResult,
  WhisperWorkerMessage,
  WhisperWorkerResponse,
  WhisperModelConfig,
} from "./whisper-types";
import { WHISPER_MODELS } from "./whisper-types";

export type WhisperEventType =
  | "modelLoading"
  | "modelLoaded"
  | "progress"
  | "transcription"
  | "error";

export interface WhisperEvent {
  type: WhisperEventType;
  data?: {
    progress?: number;
    status?: string;
    result?: WhisperTranscriptionResult;
    error?: string;
  };
}

export type WhisperEventHandler = (event: WhisperEvent) => void;

export class WhisperService {
  private worker: Worker | null = null;
  private eventHandlers: Map<WhisperEventType, Set<WhisperEventHandler>> = new Map();
  private state: WhisperModelState = {
    isLoading: false,
    isLoaded: false,
    loadProgress: 0,
    currentModel: null,
    error: null,
    webGPUSupported: false,
  };

  // 擬似リアルタイム用のバッファ
  private audioBuffer: Float32Array[] = [];
  private processInterval: number | null = null;
  private readonly PROCESS_INTERVAL_MS = 3000; // 3秒ごとに処理

  constructor() {
    this.checkWebGPUSupport();
  }

  /**
   * WebGPUサポートをチェック
   */
  private async checkWebGPUSupport(): Promise<void> {
    if (typeof navigator === "undefined") {
      this.state.webGPUSupported = false;
      return;
    }

    // WebGPU APIの存在チェック
    const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
    if (!nav.gpu) {
      this.state.webGPUSupported = false;
      return;
    }

    try {
      const adapter = await nav.gpu.requestAdapter();
      this.state.webGPUSupported = !!adapter;
    } catch {
      this.state.webGPUSupported = false;
    }
  }

  /**
   * WebWorkerを初期化
   */
  private initWorker(): void {
    if (this.worker) return;

    // インラインWorkerコードをBlobとして作成
    const workerCode = `
      let transformers = null;
      let transcriber = null;
      let currentModelId = null;

      async function loadTransformers() {
        if (transformers) return;
        transformers = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1");
        transformers.env.cacheDir = "./.cache";
        transformers.env.allowLocalModels = false;
      }

      self.onmessage = async (e) => {
        const { type, payload } = e.data;

        if (type === "LOAD_MODEL") {
          try {
            if (transcriber && currentModelId === payload.modelId) {
              self.postMessage({ type: "MODEL_LOADED" });
              return;
            }
            if (transcriber) {
              transcriber = null;
              currentModelId = null;
            }
            self.postMessage({ type: "MODEL_LOADING", payload: { status: "ライブラリを読み込み中..." } });
            await loadTransformers();
            self.postMessage({ type: "MODEL_LOADING", payload: { status: "モデルをダウンロード中..." } });
            const device = payload.useWebGPU ? "webgpu" : "wasm";
            transcriber = await transformers.pipeline("automatic-speech-recognition", payload.modelId, {
              device,
              dtype: payload.useWebGPU ? "fp16" : "q8",
              progress_callback: (p) => {
                if (p.status === "progress" && p.progress !== undefined) {
                  self.postMessage({ type: "PROGRESS", payload: { progress: p.progress, file: p.file } });
                }
              },
            });
            currentModelId = payload.modelId;
            self.postMessage({ type: "MODEL_LOADED" });
          } catch (err) {
            self.postMessage({ type: "ERROR", payload: { error: err.message || "モデルのロードに失敗しました" } });
          }
        } else if (type === "TRANSCRIBE") {
          if (!transcriber) {
            self.postMessage({ type: "ERROR", payload: { error: "モデルがロードされていません" } });
            return;
          }
          try {
            const result = await transcriber(payload.audioData, {
              language: payload.options?.language || "ja",
              task: payload.options?.task || "transcribe",
              return_timestamps: payload.options?.returnTimestamps ?? true,
            });
            const normalized = Array.isArray(result) ? result[0] : result;
            self.postMessage({ type: "RESULT", payload: { result: { text: normalized.text || "", chunks: normalized.chunks } } });
          } catch (err) {
            self.postMessage({ type: "ERROR", payload: { error: err.message || "文字起こしに失敗しました" } });
          }
        } else if (type === "UNLOAD_MODEL") {
          transcriber = null;
          currentModelId = null;
          self.postMessage({ type: "MODEL_UNLOADED" });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);

    this.worker = new Worker(workerUrl, { type: "module" });

    this.worker.onmessage = (event: MessageEvent<WhisperWorkerResponse>) => {
      this.handleWorkerMessage(event.data);
    };

    this.worker.onerror = (error) => {
      console.error("[WhisperService] Worker error:", error);
      this.emit("error", { error: error.message });
    };
  }

  /**
   * Workerからのメッセージを処理
   */
  private handleWorkerMessage(response: WhisperWorkerResponse): void {
    switch (response.type) {
      case "MODEL_LOADING":
        this.state.isLoading = true;
        this.emit("modelLoading", { status: response.payload?.status });
        break;

      case "PROGRESS":
        this.state.loadProgress = response.payload?.progress ?? 0;
        this.emit("progress", {
          progress: response.payload?.progress,
          status: response.payload?.status,
        });
        break;

      case "MODEL_LOADED":
        this.state.isLoading = false;
        this.state.isLoaded = true;
        this.state.loadProgress = 100;
        this.emit("modelLoaded", {});
        break;

      case "RESULT":
        if (response.payload?.result) {
          this.emit("transcription", { result: response.payload.result });
        }
        break;

      case "ERROR":
        this.state.isLoading = false;
        this.state.error = response.payload?.error ?? "Unknown error";
        this.emit("error", { error: response.payload?.error });
        break;

      case "MODEL_UNLOADED":
        this.state.isLoaded = false;
        this.state.currentModel = null;
        break;
    }
  }

  /**
   * イベントを発火
   */
  private emit(type: WhisperEventType, data: WhisperEvent["data"]): void {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler({ type, data }));
    }
  }

  /**
   * イベントハンドラを登録
   */
  on(type: WhisperEventType, handler: WhisperEventHandler): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);

    // クリーンアップ関数を返す
    return () => {
      this.eventHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * モデルをロード
   */
  async loadModel(
    modelSize: WhisperModelSize,
    useWebGPU: boolean = false
  ): Promise<void> {
    this.initWorker();

    const config = WHISPER_MODELS.find((m) => m.id === modelSize);
    if (!config) {
      throw new Error(`Unknown model size: ${modelSize}`);
    }

    // WebGPU非対応の場合はWASMにフォールバック
    const actualUseWebGPU = useWebGPU && this.state.webGPUSupported;

    this.state.currentModel = modelSize;
    this.state.error = null;

    const message: WhisperWorkerMessage = {
      type: "LOAD_MODEL",
      payload: {
        modelId: config.modelId,
        useWebGPU: actualUseWebGPU,
      },
    };

    this.worker?.postMessage(message);
  }

  /**
   * 音声データを文字起こし（バッチ処理）
   */
  async transcribe(
    audioData: Float32Array,
    options: WhisperTranscriptionOptions = {}
  ): Promise<void> {
    if (!this.worker || !this.state.isLoaded) {
      this.emit("error", { error: "モデルがロードされていません" });
      return;
    }

    const message: WhisperWorkerMessage = {
      type: "TRANSCRIBE",
      payload: {
        audioData,
        options: {
          language: options.language || "ja",
          task: options.task || "transcribe",
          returnTimestamps: options.returnTimestamps ?? true,
          chunkLengthS: options.chunkLengthS || 30,
          strideLengthS: options.strideLengthS || 5,
        },
      },
    };

    this.worker.postMessage(message);
  }

  /**
   * リアルタイムセッションを開始
   * 音声チャンクを蓄積し、定期的にバッチ処理で文字起こし
   */
  startRealtimeSession(options: WhisperTranscriptionOptions = {}): void {
    this.audioBuffer = [];

    // 定期的にバッファを処理
    this.processInterval = window.setInterval(() => {
      this.processAudioBuffer(options);
    }, this.PROCESS_INTERVAL_MS);
  }

  /**
   * 音声チャンクを追加
   */
  addAudioChunk(chunk: Float32Array): void {
    this.audioBuffer.push(chunk);
  }

  /**
   * バッファを処理して文字起こし
   */
  private async processAudioBuffer(
    options: WhisperTranscriptionOptions
  ): Promise<void> {
    if (this.audioBuffer.length === 0) return;

    // バッファを結合
    const totalLength = this.audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.audioBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // バッファをクリア
    this.audioBuffer = [];

    // 文字起こし
    await this.transcribe(combined, options);
  }

  /**
   * リアルタイムセッションを停止
   */
  async stopRealtimeSession(options: WhisperTranscriptionOptions = {}): Promise<void> {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    // 残りのバッファを処理
    await this.processAudioBuffer(options);
  }

  /**
   * モデルをアンロード
   */
  unloadModel(): void {
    if (this.worker) {
      const message: WhisperWorkerMessage = { type: "UNLOAD_MODEL" };
      this.worker.postMessage(message);
    }
  }

  /**
   * サービスを破棄
   */
  dispose(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.eventHandlers.clear();
  }

  /**
   * 現在の状態を取得
   */
  getState(): WhisperModelState {
    return { ...this.state };
  }

  /**
   * WebGPUサポート状況を取得
   */
  isWebGPUSupported(): boolean {
    return this.state.webGPUSupported;
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  getAvailableModels(): WhisperModelConfig[] {
    return WHISPER_MODELS;
  }
}

// シングルトンインスタンス
let whisperServiceInstance: WhisperService | null = null;

export function getWhisperService(): WhisperService {
  if (!whisperServiceInstance) {
    whisperServiceInstance = new WhisperService();
  }
  return whisperServiceInstance;
}
