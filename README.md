# tail -f tech blogs

日本の技術ブログを、もっと見つけやすく。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## About

tailf は日本語の技術ブログを集約・表示するアグリゲーションサービスです。`tail -f` コマンドのように、技術ブログの更新をリアルタイムで追いかけることができます。

## Tech Stack

- **Frontend**: [Astro](https://astro.build/) + [React](https://react.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Backend**: [Hono](https://hono.dev/) + [Drizzle ORM](https://orm.drizzle.team/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **Deploy**: [Cloudflare Workers](https://workers.cloudflare.com/)

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10

### Installation

```bash
# Clone the repository
git clone https://github.com/paveg/tailf.git
cd tailf

# Install dependencies
pnpm install

# Setup local database
pnpm db:migrate:local

# Start development server
pnpm dev
```

Open [http://localhost:4321](http://localhost:4321) for the web app and [http://localhost:8788](http://localhost:8788) for the API.

### Environment Variables

Create a `.dev.vars` file in `apps/api/`:

```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
SESSION_SECRET=your_session_secret
```

## Project Structure

```
tailf/
├── apps/
│   ├── api/          # Hono API (Cloudflare Workers)
│   └── web/          # Astro + React frontend
├── packages/
│   └── shared/       # Shared types and utilities
└── docs/             # Documentation
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start both API and Web dev servers |
| `pnpm build` | Build web for production |
| `pnpm lint` | Run Biome linter |
| `pnpm db:migrate:local` | Apply DB migrations locally |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

[Ryota Ikezawa](https://github.com/paveg)
