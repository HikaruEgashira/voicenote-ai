/**
 * PCM16 音声のリサンプリングとBase64変換
 *
 * アプリのマイクストリームは 16kHz PCM16 だが、OpenAI Realtime API は
 * `audio/pcm` の入力を 24kHz 固定で要求する。チャンク単位で送信するため、
 * チャンク境界で位相が飛ばないよう状態を持つリサンプラとして実装している。
 */

/**
 * Base64文字列をPCM16（リトルエンディアン）のInt16Arrayへデコード
 */
export function base64ToPcm16(base64: string): Int16Array {
  const binary = atob(base64);
  // 奇数バイトの末尾はサンプルとして成立しないため切り捨てる
  const sampleCount = Math.floor(binary.length / 2);
  const samples = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    const value = lo | (hi << 8);
    // 16bit符号付きへ変換
    samples[i] = value >= 0x8000 ? value - 0x10000 : value;
  }

  return samples;
}

/**
 * PCM16のInt16ArrayをBase64文字列へエンコード
 */
export function pcm16ToBase64(samples: Int16Array): string {
  // 大きなチャンクで String.fromCharCode(...args) を使うとスタックが溢れるため
  // 1サンプルずつ連結する
  let binary = "";
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i] & 0xffff;
    binary += String.fromCharCode(value & 0xff, (value >> 8) & 0xff);
  }
  return btoa(binary);
}

/**
 * ストリーミング用の線形補間リサンプラ
 */
export interface Pcm16Resampler {
  /** 1チャンクをリサンプルする */
  process(input: Int16Array): Int16Array;
  /** 内部状態をリセットする（セッション再開時） */
  reset(): void;
}

/**
 * チャンク境界をまたいで連続性を保つ線形補間リサンプラを生成する
 *
 * 入出力レートが等しい場合は変換せずそのまま返す。
 */
export function createPcm16Resampler(
  inputRate: number,
  outputRate: number,
): Pcm16Resampler {
  if (inputRate <= 0 || outputRate <= 0) {
    throw new Error("Sample rates must be positive");
  }

  const ratio = inputRate / outputRate;

  // 直前チャンクの末尾サンプル。次チャンクの仮想インデックス -1 に相当する。
  let lastSample = 0;
  // 次に出力するサンプルの、現チャンク先頭を 0 とした小数インデックス（>= -1）
  let position = 0;

  return {
    process(input: Int16Array): Int16Array {
      if (inputRate === outputRate) {
        return input;
      }
      if (input.length === 0) {
        return new Int16Array(0);
      }

      const sampleAt = (index: number): number =>
        index < 0 ? lastSample : input[index];

      // 補間には index と index+1 が必要なため、position < length - 1 の間だけ出力する
      const outputCount = Math.max(
        0,
        Math.ceil((input.length - 1 - position) / ratio),
      );
      const output = new Int16Array(outputCount);

      let pos = position;
      for (let i = 0; i < outputCount; i++) {
        const base = Math.floor(pos);
        const frac = pos - base;
        const s0 = sampleAt(base);
        const s1 = sampleAt(base + 1);
        output[i] = Math.round(s0 + (s1 - s0) * frac);
        pos += ratio;
      }

      // 次チャンクの座標系へ持ち越す（末尾サンプルが仮想インデックス -1 になる）
      position = pos - input.length;
      lastSample = input[input.length - 1];

      return output;
    },

    reset(): void {
      lastSample = 0;
      position = 0;
    },
  };
}

/**
 * Base64のPCM16チャンクを別のサンプルレートへ変換する
 */
export function resamplePcm16Base64(
  base64: string,
  resampler: Pcm16Resampler,
): string {
  const resampled = resampler.process(base64ToPcm16(base64));
  return pcm16ToBase64(resampled);
}
