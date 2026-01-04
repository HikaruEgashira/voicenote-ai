# ElevenLabs API 調査結果

## 認証方法
- **API Key認証**: `xi-api-key` ヘッダーにAPIキーを設定
- OAuthは標準ではサポートされていない（API Keyベースの認証のみ）
- Single use tokensも利用可能（クライアントサイドでの一時的な認証用）

## Speech to Text API (Scribe)

### エンドポイント
```
POST https://api.elevenlabs.io/v1/speech-to-text
```

### リクエスト形式
- Content-Type: multipart/form-data
- 必須パラメータ:
  - `model_id`: "scribe_v1" または "scribe_v1_experimental"
  - `file`: 音声/動画ファイル（最大3GB）
  - または `cloud_storage_url`: HTTPSでアクセス可能なURL（最大2GB）

### オプションパラメータ
- `language_code`: ISO-639-1/3言語コード（日本語は "ja"）
- `diarize`: 話者分離（true/false）
- `num_speakers`: 話者数（1-32）
- `timestamps_granularity`: "word" | "character" | "none"
- `tag_audio_events`: 笑い声などのタグ付け

### レスポンス形式
```json
{
  "language_code": "en",
  "language_probability": 0.98,
  "text": "Hello world!",
  "words": [
    {
      "text": "Hello",
      "start": 0,
      "end": 0.5,
      "type": "word",
      "speaker_id": "speaker_1"
    }
  ]
}
```

## 対応言語
- 99言語対応（Scribe v1）
- 日本語: 高精度（≤5% WER）

## 実装方針
1. ユーザーからElevenLabs APIキーを取得（webdev_request_secrets）
2. サーバーサイドでElevenLabs APIを呼び出し
3. 録音ファイルをmultipart/form-dataで送信
4. 文字起こし結果をクライアントに返却
