# tailf.dev MVP

日本語技術ブログアグリゲーター

## コンセプト

`tail -f` コマンドのように、日本の技術ブログをリアルタイムで追いかける。

## MVP機能

### 必須機能（v1.0）

| 機能 | 説明 | 状態 |
|------|------|------|
| GitHub OAuth | ログイン/ログアウト | ✅ API実装済み |
| ブログ登録 | RSS URLでブログを登録 | ⬜ UI未実装 |
| 新着記事 | 登録ブログの最新記事を表示 | ⬜ 実データ接続未 |
| ランキング | 人気ブログ/記事のランキング | ⬜ 実データ接続未 |
| RSSフィード取得 | Cronで定期的にRSSを取得 | ✅ 実装済み |
| ユーザースタッツ | 登録ブログ数、フォロー数など | ⬜ 未実装 |

### 後回し機能（v1.x）

| 機能 | 説明 | 優先度 |
|------|------|--------|
| 全文検索 | D1 FTSでキーワード検索 | 中 |
| AIセマンティック検索 | Vectorize + Workers AIで意味検索 | 低 |
| トピックフィルター | #frontend, #backend などのタグ | 中 |
| フォロー機能 | ブログをフォローしてフィード作成 | 中 |
| いいね/ブックマーク | 記事を保存 | 低 |

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

blogs
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
├── blogId → blogs.id
└── createdAt

follows
├── userId → users.id
├── blogId → blogs.id
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
| `/blogs` | ブログ一覧 |
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
| GET | `/api/blogs` | ブログ一覧 |
| POST | `/api/blogs` | ブログ登録 |
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
3. RSSフィード出力（自分のフォローブログ）
4. ブログ作者へのスポンサー機能
