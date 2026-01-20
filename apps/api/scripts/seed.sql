-- Seed data for local development
-- Note: Uses existing user (592a65b7-21e4-4d8c-a27d-37599265e446)
-- Run: wrangler d1 execute tailf-db --local --file=scripts/seed.sql

-- Create test blogs
INSERT OR IGNORE INTO blogs (id, title, description, feed_url, site_url, author_id, created_at, updated_at)
VALUES
  ('blog_seed_001', 'Tech Blog Alpha', 'A technical blog about programming', 'https://example.com/feed1.xml', 'https://example.com/blog1', '592a65b7-21e4-4d8c-a27d-37599265e446', 1737349200000, 1737349200000),
  ('blog_seed_002', 'Code Journey', 'My coding journey and learnings', 'https://example.com/feed2.xml', 'https://example.com/blog2', '592a65b7-21e4-4d8c-a27d-37599265e446', 1737349200000, 1737349200000);

-- Create test posts with varying tech_scores
-- High tech score posts (>= 0.3)
INSERT OR IGNORE INTO posts (id, title, summary, url, blog_id, published_at, created_at, tech_score)
VALUES
  ('post_seed_001', 'TypeScriptで型安全なAPIを作る', 'TypeScript, Node.js, 型システムを活用したAPI設計について解説します。', 'https://example.com/post1', 'blog_seed_001', 1737262800000, 1737349200000, 0.85),
  ('post_seed_002', 'React Hooksのベストプラクティス', 'useStateとuseEffectの正しい使い方とパフォーマンス最適化について。', 'https://example.com/post2', 'blog_seed_001', 1737176400000, 1737349200000, 0.75),
  ('post_seed_003', 'Rustでゼロコスト抽象化を理解する', 'Rustの所有権システムとゼロコスト抽象化の実装方法。', 'https://example.com/post3', 'blog_seed_001', 1737090000000, 1737349200000, 0.90),
  ('post_seed_004', 'Docker Composeでマイクロサービス構築', 'Docker Composeを使ってマイクロサービスを構築する実践ガイド。', 'https://example.com/post4', 'blog_seed_001', 1737003600000, 1737349200000, 0.70),
  ('post_seed_005', 'Next.js App Routerの新機能', 'Next.js 14のApp Routerとサーバーコンポーネントの使い方。', 'https://example.com/post5', 'blog_seed_001', 1736917200000, 1737349200000, 0.80),
  ('post_seed_006', 'Kubernetesで本番環境を構築する', 'k8sクラスタのセットアップからデプロイまでの完全ガイド。', 'https://example.com/post6', 'blog_seed_002', 1736830800000, 1737349200000, 0.85),
  ('post_seed_007', 'GraphQL vs REST API比較', 'GraphQLとREST APIの違いと、プロジェクトに合った選び方。', 'https://example.com/post7', 'blog_seed_002', 1736744400000, 1737349200000, 0.65),
  ('post_seed_008', 'Goで並行処理を実装する', 'Goroutineとチャネルを使った並行プログラミングの実践。', 'https://example.com/post8', 'blog_seed_002', 1736658000000, 1737349200000, 0.75);

-- Low tech score posts (< 0.3)
INSERT OR IGNORE INTO posts (id, title, summary, url, blog_id, published_at, created_at, tech_score)
VALUES
  ('post_seed_009', '今週のランチ記録', '今週食べたランチの写真と感想をまとめました。', 'https://example.com/post9', 'blog_seed_002', 1736571600000, 1737349200000, 0.05),
  ('post_seed_010', '旅行記: 京都の紅葉', '先週末に行った京都旅行の記録です。', 'https://example.com/post10', 'blog_seed_002', 1736485200000, 1737349200000, 0.02),
  ('post_seed_011', '読書メモ: おすすめの本5選', '最近読んだ本の中からおすすめを紹介します。', 'https://example.com/post11', 'blog_seed_002', 1736398800000, 1737349200000, 0.10),
  ('post_seed_012', '2025年の目標を振り返る', '年初に立てた目標の進捗を振り返ります。', 'https://example.com/post12', 'blog_seed_002', 1736312400000, 1737349200000, 0.00);
