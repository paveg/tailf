import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
	site: 'https://tailf.pages.dev',
	output: 'static',
	build: {
		assets: 'assets',
	},
	server: {
		host: true,
	},
	integrations: [react(), sitemap()],
	vite: {
		plugins: [tailwindcss()],
		server: {
			proxy: {
				'/api': {
					target: 'http://localhost:8788',
					changeOrigin: true,
				},
			},
		},
	},
})
