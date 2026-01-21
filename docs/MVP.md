# tailf MVP

日本語技術ブログアグリゲーター

## コンセプト

`tail -f` コマンドのように、日本の技術ブログをリアルタイムで追いかける。

## MVP機能

### 必須機能（v1.0）

| 機能 | 説明 | 状態 |
|------|------|------|
| GitHub OAuth | ログイン/ログアウト | ✅ 完全実装（UserMenu.tsx） |
| フィード登録 | RSS URLでフィードを登録 | ✅ 完全実装（RegisterFeedForm.tsx） |
| 新着記事 | 登録フィードの最新記事を表示 | ✅ 完全実装（RecentPosts.tsx） |
| ランキング | 人気フィード/記事のランキング | ✅ 完全実装（PopularPosts.tsx、はてブ連携） |
| RSSフィード取得 | Cronで定期的にRSSを取得 | ✅ 実装済み |
| ユーザースタッツ | 登録フィード数、フォロー数など | ⚠️ 部分実装（フィード数のみ） |

### 後回し機能（v1.x）

| 機能 | 説明 | 状態 |
|------|------|--------|
| 全文検索 | D1 FTSでキーワード検索 | ✅ 実装済み（FTS5 Trigram） |
| AIセマンティック検索 | Vectorize + Workers AIで意味検索 | ⬜ 未実装 |
| トピックフィルター | #frontend, #backend などのタグ | ⬜ 未実装 |
| フォロー機能 | フィードをフォローしてタイムライン作成 | ⬜ 未実装 |
| いいね/ブックマーク | 記事を保存 | ⬜ 未実装 |

## 技術スタック

### Frontend (apps/web)
- Astro (SSG/ISR)
- React (インタラクティブコンポーネント)
- Tailwind CSS v4
- shadcn/ui

### Backend (apps/api)
- Hono (Cloudflare Workers)
- Drizzle ORM
- D1 (SQLite)

### インフラ
- Cloudflare Workers
- Cloudflare Pages (静的ホスティング)
- Cloudflare D1 (データベース)
- Cloudflare Workers Builds (CI/CD)

## データモデル

```
users
├── id (GitHub ID)
├── name
├── avatarUrl
└── createdAt

feeds
├── id
├── title
├── feedUrl (RSS)
├── siteUrl
├── authorId → users.id
└── createdAt

posts
├── id
├── title
├── summary
├── url
├── publishedAt
├── feedId → feeds.id
└── createdAt

follows
├── userId → users.id
├── feedId → feeds.id
└── createdAt

sessions
├── id
├── userId → users.id
└── expiresAt
```

## ページ構成

| パス | 説明 |
|------|------|
| `/` | ホーム（新着記事） |
| `/posts` | 新着記事一覧 |
| `/blogs` | フィード一覧 |
| `/ranking` | ランキング |
| `/terms` | 利用規約 |
| `/privacy` | プライバシーポリシー |

## API エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/auth/github` | GitHub OAuth開始 |
| GET | `/api/auth/callback` | OAuth コールバック |
| GET | `/api/auth/me` | 現在のユーザー取得 |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/feeds` | フィード一覧 |
| POST | `/api/feeds` | フィード登録 |
| GET | `/api/posts` | 記事一覧 |
| GET | `/api/feed` | フィード取得 |

## 環境変数

```
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
SESSION_SECRET=xxx
```

## 参考サービス

- [diff.blog](https://diff.blog/) - Developer blog aggregator
- [Zenn](https://zenn.dev/) - 日本の技術情報共有
- [Qiita](https://qiita.com/) - 技術記事共有

## 今後の展望

1. AIによる記事要約（TL;DR）
2. 週間/月間ダイジェストメール
3. RSSフィード出力（自分のフォローフィード）
4. ブログ作者へのスポンサー機能
