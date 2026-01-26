/**
 * Official tech blog feeds (master list)
 *
 * To add a new feed:
 * 1. Add entry to this list
 * 2. Run sync script or deploy to sync with DB
 */
export const OFFICIAL_FEEDS = [
	// Big Tech
	{ label: 'Google Developers Japan', url: 'https://developers-jp.googleblog.com/atom.xml' },

	// Mega Ventures
	{ label: 'メルカリ', url: 'https://engineering.mercari.com/blog/feed.xml' },
	{ label: 'LINE ヤフー', url: 'https://techblog.lycorp.co.jp/ja/feed/index.xml' },
	{ label: 'サイバーエージェント', url: 'https://developers.cyberagent.co.jp/blog/feed/' },
	{ label: 'DeNA', url: 'https://engineering.dena.com/blog/index.xml' },
	{ label: 'GREE', url: 'https://labs.gree.jp/blog/feed/' },
	{ label: 'DMM', url: 'https://developersblog.dmm.com/feed' },
	{ label: 'クックパッド', url: 'https://techlife.cookpad.com/feed' },
	{ label: 'MIXI', url: 'https://mixi-developers.mixi.co.jp/feed' },
	{ label: 'ドワンゴ', url: 'https://dwango.github.io/index.xml' },
	{ label: 'ピクシブ', url: 'https://inside.pixiv.blog/feed' },

	// SaaS / Fintech
	{ label: 'freee', url: 'https://developers.freee.co.jp/feed' },
	{ label: 'SmartHR', url: 'https://tech.smarthr.jp/feed' },
	{ label: 'マネーフォワード', url: 'https://moneyforward-dev.jp/feed' },
	{ label: 'LayerX', url: 'https://tech.layerx.co.jp/feed' },
	{ label: 'Sansan', url: 'https://buildersbox.corp-sansan.com/feed' },
	{ label: 'サイボウズ', url: 'https://blog.cybozu.io/feed' },
	{ label: 'SmartBank', url: 'https://blog.smartbank.co.jp/feed' },
	{ label: 'READYFOR', url: 'https://tech.readyfor.jp/feed' },
	{ label: 'Repro', url: 'https://tech.repro.io/feed' },

	// Web Services
	{ label: 'はてな', url: 'https://developer.hatenastaff.com/feed' },
	{ label: '一休', url: 'https://user-first.ikyu.co.jp/feed' },
	{ label: 'ZOZO', url: 'https://techblog.zozo.com/feed' },
	{ label: 'BASE', url: 'https://devblog.thebase.in/feed' },
	{ label: 'Wantedly', url: 'https://www.wantedly.com/stories/s/wantedly_engineers/rss.xml' },
	{ label: '食べログ', url: 'https://tech-blog.tabelog.com/feed' },
	{ label: 'Retty', url: 'https://engineer.retty.me/feed' },
	{ label: 'ぐるなび', url: 'https://developers.gnavi.co.jp/feed' },
	{ label: 'LIFULL', url: 'https://www.lifull.blog/feed' },

	// HR / Recruiting
	{ label: 'Visional', url: 'https://engineering.visional.inc/blog/index.xml' },
	{ label: 'ラクスル', url: 'https://techblog.raksul.com/feed' },
	{ label: 'タイミー', url: 'https://tech.timee.co.jp/feed' },
	{ label: 'Findy', url: 'https://tech.findy.co.jp/feed' },

	// Education
	{ label: 'スタディサプリ', url: 'https://blog.studysapuri.jp/feed' },
	{ label: 'Classi', url: 'https://tech.classi.jp/feed' },

	// Healthcare
	{ label: 'エムスリー', url: 'https://www.m3tech.blog/feed' },
	{ label: 'カケハシ', url: 'https://kakehashi-dev.hatenablog.com/feed' },

	// Enterprise / SI
	{ label: 'GMOインターネット', url: 'https://developers.gmo.jp/feed/' },
	{ label: 'GMOペパボ', url: 'https://tech.pepabo.com/feed.xml' },
	{ label: 'NTT ドコモ', url: 'https://nttdocomo-developers.jp/feed' },
	{ label: 'IIJ', url: 'https://eng-blog.iij.ad.jp/feed' },
	{ label: 'フューチャー', url: 'https://future-architect.github.io/atom.xml' },
	{ label: 'CARTA', url: 'https://techblog.cartaholdings.co.jp/feed' },

	// Media / Entertainment
	{ label: 'TVer', url: 'https://techblog.tver.co.jp/feed' },
	{ label: 'Mirrativ', url: 'https://tech.mirrativ.stream/feed' },

	// Startup
	{ label: 'kubell', url: 'https://creators-note.chatwork.com/feed' },
	{ label: 'Eureka', url: 'https://medium.com/feed/eureka-engineering' },
	{ label: 'Speee', url: 'https://tech.speee.jp/feed' },
	{ label: 'ラクス', url: 'https://tech-blog.rakus.co.jp/feed' },
	{ label: 'ヌーラボ', url: 'https://nulab.com/ja/blog/categories/techblog/feed/' },
	{ label: '弥生', url: 'https://tech-blog.yayoi-kk.co.jp/feed' },
	{ label: 'あすけん', url: 'https://tech.asken.inc/feed' },
	{ label: 'レコチョク', url: 'https://techblog.recochoku.jp/feed/atom' },
	{ label: '10X', url: 'https://product.10x.co.jp/feed' },
	{ label: 'ANDPAD', url: 'https://tech.andpad.co.jp/feed' },
	{ label: 'Nature', url: 'https://engineering.nature.global/feed' },

	// Agency / Dev Shop
	{ label: 'LIG', url: 'https://liginc.co.jp/technology/feed' },
	{ label: 'TechRacho', url: 'https://techracho.bpsinc.jp/feed' },

	// Tech Blog Platforms
	{ label: 'Zenn', url: 'https://zenn.dev/feed' },
] as const

export type OfficialFeed = (typeof OFFICIAL_FEEDS)[number]
