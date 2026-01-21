# TODO - MVP完成まで

## Phase 1: データ接続

- [x] フロントエンドとAPIの接続確認
- [x] 新着記事ページで実データ表示
- [x] フィード一覧ページで実データ表示（/blogs）

## Phase 2: 認証フロー

- [x] Cloudflareにシークレット設定
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `SESSION_SECRET`
- [x] ログインボタンの動作確認（UserMenu.tsx）
- [x] ログイン後のユーザー情報表示（アバター + ドロップダウン）
- [x] ログアウト機能

## Phase 3: フィード登録

- [x] フィード登録フォームUI（RegisterFeedForm.tsx）
- [x] RSS URL検証（fetchAndParseFeed）
- [x] フィード登録API呼び出し（POST /api/feeds）
- [x] 登録完了後のリダイレクト

## Phase 4: ユーザー機能

- [x] マイページ（/mypage/feeds）
- [x] 登録フィード一覧（MyFeeds.tsx）
- [ ] ユーザースタッツ表示（フィード数は表示済み、フォロー数等は未実装）

## Phase 5: 運用準備

- [x] ドメイン取得（tailf.pavegy.workers.dev で運用中）
- [x] Cloudflare DNS設定
- [x] OGP画像作成（og-image.png）
- [x] 初期フィードデータ投入（公式ブログ多数登録済み）

## 後回し → 実装済み

- [x] ランキング機能（はてなブックマーク数ベース、PopularPosts.tsx）
- [x] 検索機能（FTS5 Trigramで日本語対応、SearchInput.tsx）

## 後回し → 未実装

- [ ] トピックフィルター（#frontend, #backend など）
- [ ] フォロー機能（タイムライン作成）
- [ ] AIセマンティック検索（Vectorize + Workers AI）
