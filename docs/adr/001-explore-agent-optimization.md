# ADR-001: Explore Agentトークン消費最適化

## Status
Accepted

## Context

Claude Codeの~/.claude/debugセッションログを分析した結果、Explore Agent（haiku）の呼び出しパターンにおいて以下の課題が特定された：

### 分析データ

**トークン消費パターン（サンプル分析）**:
- システムプロンプトキャッシュ作成: 約14,000トークン（初回）
- キャッシュ再利用時: 大幅削減（cache_read_input_tokensで確認）
- シングルターンセッションが大多数（turns=1）

**ツール使用パターン（典型的なExploreセッション）**:
- Read: 17回
- Grep: 11回
- Glob: 4回
- Bash: 1回

**課題**:
1. キャッシュ再利用率が低い（セッション間でキャッシュが失効）
2. Read呼び出し回数が多い（17ファイル読み込みの例）
3. CLAUDE.mdが毎回全体ロードされる（lazy load未対応）
4. フォルダ構造が探索効率を考慮していない

## Decision

以下の最適化を採用する：

### 1. CLAUDE.mdのlazy load構造化

```
~/.claude/CLAUDE.md           # 常にロード（最小限）
~/.claude/contexts/
  llm.md                      # LLM接続情報（必要時のみ）
  git.md                      # Git操作規約
  web.md                      # Web取得規約
```

**理由**: 毎セッション約27行（1.3KB）のCLAUDE.mdがロードされるが、多くのセッションでは全情報が不要

### 2. プロジェクト構造の標準化

```
.claude/
  CLAUDE.md                   # プロジェクト固有の指示（簡潔に）
  contexts/                   # 詳細情報（lazy load）
    architecture.md
    api.md
```

### 3. ファイル読み込みカバレッジの改善

Explore Agentが効率的にファイルを特定できるよう：
- エントリーポイントを明示（CLAUDE.mdに記載）
- ディレクトリ構造の説明を追加

## Consequences

### Positive
- トークン消費の削減（推定20-30%）
- キャッシュヒット率の向上
- Explore Agent探索効率の改善

### Negative
- 初期設定の手間が増加
- contexts/の管理が必要

### Neutral
- 既存プロジェクトへの影響なし（後方互換）

## Metrics

効果測定のため以下を監視：
- セッションあたりの平均トークン消費
- Read呼び出し回数/探索タスク
- cache_read_input_tokens / cache_creation_input_tokens比率

## Baseline Measurement (2026-01-10)

**分析対象**: ~/.claude/debug/ (3,675ファイル, 102MB)

**サブエージェントログ分析**:
| ファイルサイズ | 数 | 備考 |
|-------------|---|------|
| >500KB | 2 | 長時間探索タスク |
| 100-500KB | 多数 | 一般的な探索 |
| <10KB | 多数 | シングルターンセッション |

**トークン消費サンプル（38ターンセッション）**:
- input_tokens合計: 6,603
- output_tokens合計: 965
- cache_creation: 120,284
- cache_read: 614,693
- キャッシュ効率: 83.6%

**deslop適用度**: 現コードベースはクリーンでslop率は低い

## Implementation Log

- 2026-01-10: ADR作成、~/.claude/contexts/にllm.md, web.mdを分離
- CLAUDE.md縮小: 27行 → 11行（約60%削減）
