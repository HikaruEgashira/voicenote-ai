# pleno-live

Expo + tRPC ボイスメモアプリ

## Entry Points
- Client: `app/_layout.tsx`
- Server: `apps/server/_core/index.ts`

## Structure
```
app/               # Expo Router pages (クライアント)
  (tabs)/          # Tab navigation (record, index, settings)
  note/[id]        # Note detail
apps/              # 実行可能アプリケーション
  server/          # tRPC backend
    _core/         # Framework (trpc, llm)
    routers.ts     # API routes
packages/          # 共有ライブラリ
  components/      # UI components
  hooks/           # React hooks
  lib/             # Client utilities
  types/           # Type definitions
  constants/       # Constants
  infra/           # Terraform IaC
```

## Tech Stack
- Expo 54 + React Native 0.81
- tRPC 11 + Express
- ElevenLabs STT, Gemini AI

# Publish Guide

`/release` スキルを使用してリリースを実行します。

## 概要
- EAS Cloudは明示されない限り使用しない
- ローカルでAPKビルドし `gh release` で公開
- ダウンロードQR画像を生成しREADMEを更新

## Android SDK
```bash
# Homebrew SDK パス
sdk.dir=/opt/homebrew/share/android-commandlinetools
```

## ビルドコマンド
```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# 出力: android/app/build/outputs/apk/release/app-release.apk
```
