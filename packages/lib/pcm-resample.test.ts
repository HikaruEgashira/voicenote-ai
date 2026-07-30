import { describe, expect, it } from "vitest";

import {
  base64ToPcm16,
  createPcm16Resampler,
  pcm16ToBase64,
  resamplePcm16Base64,
} from "./pcm-resample";

describe("base64 <-> PCM16", () => {
  it("round-trips signed samples including negatives", () => {
    const samples = new Int16Array([0, 1, -1, 32767, -32768, 1234, -4321]);

    expect(Array.from(base64ToPcm16(pcm16ToBase64(samples)))).toEqual(
      Array.from(samples),
    );
  });

  it("drops a trailing odd byte instead of producing a bogus sample", () => {
    // 3バイト = 1.5サンプル。末尾の半端なバイトは切り捨てられる。
    const oddLength = btoa(String.fromCharCode(0x01, 0x02, 0x03));

    expect(Array.from(base64ToPcm16(oddLength))).toEqual([0x0201]);
  });
});

describe("createPcm16Resampler", () => {
  it("passes audio through untouched when the rates match", () => {
    const resampler = createPcm16Resampler(16000, 16000);
    const input = new Int16Array([1, 2, 3]);

    expect(resampler.process(input)).toBe(input);
  });

  it("upsamples 16kHz to 24kHz by linear interpolation", () => {
    const resampler = createPcm16Resampler(16000, 24000);

    const output = resampler.process(new Int16Array([0, 300, 600, 900]));

    expect(Array.from(output)).toEqual([0, 200, 400, 600, 800]);
  });

  it("keeps the phase continuous across chunk boundaries", () => {
    const resampler = createPcm16Resampler(16000, 24000);

    resampler.process(new Int16Array([0, 300, 600, 900]));
    const second = resampler.process(new Int16Array([1200, 1500]));

    // 直前チャンク末尾(900)との間を補間するため、
    // 一定の傾きが途切れずに続く: ... 800, 1000, 1200, 1400
    expect(Array.from(second)).toEqual([1000, 1200, 1400]);
  });

  it("produces roughly 1.5x samples for a 16kHz -> 24kHz stream", () => {
    const resampler = createPcm16Resampler(16000, 24000);
    const chunk = new Int16Array(4000); // 16kHz で 250ms
    let total = 0;

    for (let i = 0; i < 4; i++) {
      total += resampler.process(chunk).length;
    }

    // 24kHz で 1000ms 相当。境界の丸めで数サンプルの誤差を許容する。
    expect(total).toBeGreaterThan(23990);
    expect(total).toBeLessThanOrEqual(24000);
  });

  it("carries state through single-sample chunks", () => {
    const resampler = createPcm16Resampler(16000, 24000);

    // 1サンプルだけでは補間相手がいないので出力は遅延する
    expect(resampler.process(new Int16Array([1000])).length).toBe(0);
    // 次チャンクで前チャンク末尾との間が補間される
    expect(Array.from(resampler.process(new Int16Array([1600])))).toEqual([
      1000, 1400,
    ]);
  });

  it("returns an empty buffer for empty input", () => {
    const resampler = createPcm16Resampler(16000, 24000);

    expect(resampler.process(new Int16Array(0)).length).toBe(0);
  });

  it("resets accumulated state", () => {
    const resampler = createPcm16Resampler(16000, 24000);
    const chunk = new Int16Array([0, 300, 600, 900]);

    const first = Array.from(resampler.process(chunk));
    resampler.reset();
    const afterReset = Array.from(resampler.process(chunk));

    expect(afterReset).toEqual(first);
  });

  it("rejects non-positive sample rates", () => {
    expect(() => createPcm16Resampler(0, 24000)).toThrow();
    expect(() => createPcm16Resampler(16000, -1)).toThrow();
  });
});

describe("resamplePcm16Base64", () => {
  it("resamples a base64 chunk end to end", () => {
    const resampler = createPcm16Resampler(16000, 24000);
    const input = pcm16ToBase64(new Int16Array([0, 300, 600, 900]));

    const output = base64ToPcm16(resamplePcm16Base64(input, resampler));

    expect(Array.from(output)).toEqual([0, 200, 400, 600, 800]);
  });
});
