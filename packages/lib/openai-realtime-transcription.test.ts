import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OpenAIRealtimeTranscriptionClient,
  OPENAI_INPUT_SAMPLE_RATE,
  buildSessionUpdate,
} from "./openai-realtime-transcription";
import { base64ToPcm16, pcm16ToBase64 } from "./pcm-resample";

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readonly protocols: string | string[] | undefined;
  readonly sent: string[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string | URL, protocols?: string | string[]) {
    this.url = String(url);
    this.protocols = protocols;
    FakeWebSocket.instances.push(this);
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  send(message: string): void {
    this.sent.push(message);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  /** 送信済みメッセージをJSONとして読む */
  parsedSent(): Record<string, unknown>[] {
    return this.sent.map((raw) => JSON.parse(raw) as Record<string, unknown>);
  }
}

/** 接続してセッションackまで完了させる */
async function connectClient(
  client: OpenAIRealtimeTranscriptionClient,
  options: Parameters<OpenAIRealtimeTranscriptionClient["connect"]>[1] = {},
): Promise<FakeWebSocket> {
  const connecting = client.connect("ek_test", options);
  const socket = FakeWebSocket.instances[0];
  socket.open();
  socket.receive({ type: "session.updated" });
  await connecting;
  return socket;
}

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("buildSessionUpdate", () => {
  it("configures a 24kHz transcription session using gpt-live-transcribe", () => {
    const payload = buildSessionUpdate({ languageCode: "ja" }) as any;

    expect(payload.type).toBe("session.update");
    expect(payload.session.type).toBe("transcription");
    expect(payload.session.audio.input.format).toEqual({
      type: "audio/pcm",
      rate: 24000,
    });
    expect(payload.session.audio.input.transcription.model).toBe(
      "gpt-live-transcribe",
    );
    expect(payload.session.audio.input.transcription.languages).toEqual(["ja"]);
  });

  it("omits the language hint when detection is automatic", () => {
    const payload = buildSessionUpdate({ languageCode: "auto" }) as any;

    expect(
      payload.session.audio.input.transcription.languages,
    ).toBeUndefined();
  });

  it("maps the VAD silence threshold to server_vad milliseconds", () => {
    const payload = buildSessionUpdate({
      vad: { silenceThresholdSecs: 1.2 },
    }) as any;

    expect(payload.session.audio.input.turn_detection).toMatchObject({
      type: "server_vad",
      silence_duration_ms: 1200,
    });
  });

  it("passes through keyword, prompt and delay hints", () => {
    const payload = buildSessionUpdate({
      openai: {
        keywords: ["Pleno", "AC-42"],
        prompt: "会議の文字起こし",
        delay: "low",
      },
    }) as any;

    expect(payload.session.audio.input.transcription).toMatchObject({
      keywords: ["Pleno", "AC-42"],
      prompt: "会議の文字起こし",
      delay: "low",
    });
  });
});

describe("OpenAIRealtimeTranscriptionClient", () => {
  it("authenticates with the ephemeral key and waits for the session ack", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();
    let connected = false;

    const connecting = client
      .connect("ek_secret", { languageCode: "ja" })
      .then(() => {
        connected = true;
      });

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe(
      "wss://api.openai.com/v1/realtime?intent=transcription",
    );
    // ヘッダを付けられないため ephemeral key はサブプロトコルで渡す
    expect(socket.protocols).toEqual([
      "realtime",
      "openai-insecure-api-key.ek_secret",
    ]);

    socket.open();
    // session.update は接続直後に送られる
    expect(socket.parsedSent()[0].type).toBe("session.update");
    // ack が来るまで connect は解決しない
    await Promise.resolve();
    expect(connected).toBe(false);

    socket.receive({ type: "session.updated" });
    await connecting;

    expect(connected).toBe(true);
    expect(client.isConnected).toBe(true);
  });

  it("accepts the pre-GA transcription_session.updated ack", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();

    const connecting = client.connect("ek_test");
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive({ type: "transcription_session.updated" });

    await expect(connecting).resolves.toBeUndefined();
  });

  it("accumulates transcription deltas into the full partial text", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();
    const partials: string[] = [];
    client.on("partial", (data: { text: string }) => partials.push(data.text));

    const socket = await connectClient(client);
    const delta = "conversation.item.input_audio_transcription.delta";
    socket.receive({ type: delta, item_id: "item_1", delta: "こんにちは" });
    socket.receive({ type: delta, item_id: "item_1", delta: "、世界" });

    expect(partials).toEqual(["こんにちは", "こんにちは、世界"]);
  });

  it("keeps delta accumulation independent per item", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();
    const partials: string[] = [];
    client.on("partial", (data: { text: string }) => partials.push(data.text));

    const socket = await connectClient(client);
    const delta = "conversation.item.input_audio_transcription.delta";
    socket.receive({ type: delta, item_id: "item_1", delta: "first" });
    socket.receive({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "item_1",
      transcript: "first turn",
    });
    socket.receive({ type: delta, item_id: "item_2", delta: "second" });

    // 新しい item は前の item のテキストを引き継がない
    expect(partials).toEqual(["first", "second"]);
  });

  it("emits committed text on completion", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();
    const committed: string[] = [];
    client.on("committed", (data: { text: string }) =>
      committed.push(data.text),
    );

    const socket = await connectClient(client);
    socket.receive({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "item_1",
      transcript: "確定したテキスト",
    });

    expect(committed).toEqual(["確定したテキスト"]);
  });

  it("surfaces server errors with their code", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();
    const errors: { code?: string; message: string }[] = [];
    client.on("error", (error) => errors.push(error));

    const socket = await connectClient(client);
    socket.receive({
      type: "error",
      error: { code: "insufficient_quota", message: "You exceeded your quota" },
    });

    expect(errors).toEqual([
      { code: "insufficient_quota", message: "You exceeded your quota" },
    ]);
  });

  it("rejects the connection when the session cannot start", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();
    client.on("error", () => undefined);

    const connecting = client.connect("ek_bad");
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.receive({
      type: "error",
      error: { code: "invalid_api_key", message: "Invalid ephemeral key" },
    });

    await expect(connecting).rejects.toThrow("Invalid ephemeral key");
  });

  it("resamples 16kHz microphone audio to the required 24kHz", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();

    const socket = await connectClient(client);
    socket.sent.length = 0;
    client.sendAudioChunk(pcm16ToBase64(new Int16Array([0, 300, 600, 900])));

    const message = socket.parsedSent()[0];
    expect(message.type).toBe("input_audio_buffer.append");
    expect(Array.from(base64ToPcm16(message.audio as string))).toEqual([
      0, 200, 400, 600, 800,
    ]);
  });

  it("sends 24kHz audio through untouched", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();
    const audio = pcm16ToBase64(new Int16Array([1, 2, 3, 4]));

    const socket = await connectClient(client);
    socket.sent.length = 0;
    client.sendAudioChunk(audio, OPENAI_INPUT_SAMPLE_RATE);

    expect(socket.parsedSent()[0].audio).toBe(audio);
  });

  it("drops audio when the socket is not open", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();

    client.sendAudioChunk(pcm16ToBase64(new Int16Array([1, 2])));

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(client.isConnected).toBe(false);
  });

  it("stops emitting after disconnect", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new OpenAIRealtimeTranscriptionClient();
    const closes: unknown[] = [];
    client.on("close", (data) => closes.push(data));

    const socket = await connectClient(client);
    client.disconnect();
    socket.receive({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "item_1",
      transcript: "遅れて届いた確定",
    });

    // disconnect でハンドラは解除されるため close も後続イベントも届かない
    expect(closes).toEqual([]);
    expect(client.isConnected).toBe(false);
  });
});
