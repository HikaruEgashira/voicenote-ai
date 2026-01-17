---
name: release
description: APKビルドとGitHubリリースを作成するスキル
---

# Release Skill

Expo React Nativeアプリのリリースを自動化します。

## 手順

### 1. バージョン確認と更新

```bash
# 現在のバージョンと最新リリースを確認
node -p "require('./package.json').version"
gh release list --limit 5

# 適切なバージョンに更新 (patch/minor/major)
npm version <new-version> --no-git-tag-version
```

### 2. APKビルド

#### Android SDK設定
```bash
# Homebrew経由のAndroid SDK
echo "sdk.dir=/opt/homebrew/share/android-commandlinetools" > android/local.properties
```

#### ビルド実行
```bash
# Prebuild (必要な場合)
npx expo prebuild --platform android --clean

# APKビルド
cd android && ./gradlew assembleRelease

# APKは以下に生成される
# android/app/build/outputs/apk/release/app-release.apk
```

### 3. リリース作成

```bash
# APKをリネーム
SHORT_SHA=$(git rev-parse --short HEAD)
VERSION=$(node -p "require('./package.json').version")
cp android/app/build/outputs/apk/release/app-release.apk ./pleno-live-v${VERSION}-${SHORT_SHA}.apk

# バージョンをコミット・マージ
git checkout -b release/v${VERSION}
git add package.json
git commit -m "chore: bump version to ${VERSION}"
git push -u origin release/v${VERSION}
gh pr create --title "chore: bump version to ${VERSION}" --body "Release preparation"
gh pr merge --squash --delete-branch

# リリース作成
gh release create v${VERSION} ./pleno-live-v${VERSION}-${SHORT_SHA}.apk \
  --title "v${VERSION} - <title>" \
  --notes "<release notes>"
```

### 4. QRコード生成とREADME更新

```bash
# QRコード生成
npx qrcode -o ./download-qr.png "https://github.com/HikaruEgashira/pleno-live/releases/download/v${VERSION}/pleno-live-v${VERSION}-${SHORT_SHA}.apk"

# リリースにアップロード
gh release upload v${VERSION} ./download-qr.png

# README.mdを更新 (QRとダウンロードリンク)
# PRで更新をマージ
```

### 5. クリーンアップ

```bash
rm -f ./pleno-live-*.apk ./download-qr.png
rm -rf android/
```

## 注意事項

- EAS Cloudは明示されない限り使用しない
- ローカルビルドを基本とする
- Android SDK: `/opt/homebrew/share/android-commandlinetools`
- mainブランチは保護されているため、PRでマージする
