import { NextResponse } from 'next/server';
import { chromium } from 'playwright';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const normalizeForComparison = (url: string) => {
  try {
    const urlObj = new URL(url);
    let href = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
    return href.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
};

const getBaseDomain = (hostname: string) => {
  const parts = hostname.split('.');
  if (parts.length >= 2) return parts.slice(-2).join('.');
  return hostname;
};

const isAllowedExtension = (url: string) => {
  const disallowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.mp3', '.zip', '.rar', '.doc', '.docx', '.xls', '.xlsx', '.xml', '.txt', '.css', '.js'];
  const lowerUrl = url.split('?')[0].toLowerCase();
  return !disallowedExtensions.some(ext => lowerUrl.endsWith(ext));
};

// Sitemap ve Robots.txt üzerinden link keşfi
async function discoverSitemapLinks(baseUrl: string): Promise<string[]> {
  const links = new Set<string>();
  const urlObj = new URL(baseUrl);
  const origin = urlObj.origin;
  
  const potentialSitemaps = new Set<string>([
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`
  ]);

  try {
    // 1. Robots.txt kontrolü
    const robotsRes = await fetch(`${origin}/robots.txt`).catch(() => null);
    if (robotsRes?.ok) {
      const text = await robotsRes.text();
      const sitemapMatches = text.matchAll(/Sitemap:\s*(https?:\/\/\S+)/gi);
      for (const match of sitemapMatches) {
        potentialSitemaps.add(match[1]);
      }
    }

    // 2. Sitemapları tara (Recursive)
    const processSitemap = async (sitemapUrl: string, visited: Set<string> = new Set()) => {
      if (visited.has(sitemapUrl) || visited.size > 10) return;
      visited.add(sitemapUrl);

      try {
        const res = await fetch(sitemapUrl).catch(() => null);
        if (!res?.ok) return;
        const xml = await res.text();
        
        // <loc> etiketlerini çek
        const locs = xml.match(/<loc>(.*?)<\/loc>/g)?.map(l => l.replace(/<\/?loc>/g, '').trim()) || [];
        
        for (const loc of locs) {
          if (loc.endsWith('.xml')) {
            await processSitemap(loc, visited); // Sitemap Index ise içeri gir
          } else if (isAllowedExtension(loc)) {
            links.add(loc);
          }
        }
      } catch {}
    };

    for (const sm of potentialSitemaps) {
      await processSitemap(sm);
    }
  } catch (e) {
    console.error('Sitemap discovery error:', e);
  }

  return Array.from(links);
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL zorunludur' }, { status: 400 });

    const startUrl = new URL(url).href;
    const initialDomain = getBaseDomain(new URL(startUrl).hostname);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let pagesCrawled = 0;
        const maxPages = 100;
        const visitedNormalized = new Set<string>();
        const queuedNormalized = new Set<string>();
        const queue: string[] = [];

        // 1. SİTEMAP KEŞFİ (Açılışta tüm haritayı çıkar)
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'status', message: 'Site haritası (Sitemap) taranıyor...' }) + '\n'));
        const sitemapLinks = await discoverSitemapLinks(startUrl);
        
        // Önce başlangıç URL'ini ekle
        queue.push(startUrl);
        queuedNormalized.add(normalizeForComparison(startUrl));

        // Sitemap linklerini kuyruğa ekle
        for (const link of sitemapLinks) {
          const norm = normalizeForComparison(link);
          if (!queuedNormalized.has(norm) && getBaseDomain(new URL(link).hostname) === initialDomain) {
            queuedNormalized.add(norm);
            queue.push(link);
          }
        }
        
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'status', message: `${queue.length} potansiyel sayfa bulundu. Tarama başlıyor...` }) + '\n'));

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });
        await context.route('**/*.{png,jpg,jpeg,gif,svg,mp4,webm,ogg,mp3,wav,flac,aac,woff,woff2,ttf,otf,eot,css}', r => r.abort());

        let actualBaseDomain = initialDomain;

        const crawlPage = async (targetUrl: string) => {
          if (pagesCrawled >= maxPages) return;
          const norm = normalizeForComparison(targetUrl);
          if (visitedNormalized.has(norm)) return;
          visitedNormalized.add(norm);

          controller.enqueue(encoder.encode(JSON.stringify({ type: 'status', message: `İşleniyor (${pagesCrawled + 1}/${maxPages}): ${targetUrl}` }) + '\n'));

          const page = await context.newPage();
          try {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(1500);

            if (pagesCrawled === 0) actualBaseDomain = getBaseDomain(new URL(page.url()).hostname);

            const data = await page.evaluate(() => {
              const cleanup = () => {
                const selectors = 'script, style, noscript, nav, footer, iframe, svg, header, aside, .menu, .navigation, #sidebar, .sidebar, [data-elementor-type="header"], [data-elementor-type="footer"]';
                document.querySelectorAll(selectors).forEach(el => el.remove());
              };
              const title = document.title.trim();
              const description = (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content?.trim() || "";
              const links = Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.startsWith('http'));
              cleanup();
              const main = document.querySelector('main') || document.querySelector('article') || document.body;
              return { 
                title, 
                description, 
                h1: Array.from(main.querySelectorAll('h1')).map(e => (e as HTMLElement).innerText.trim()).join(' | '), 
                bodyText: (main as HTMLElement).innerText.replace(/\s+/g, ' ').trim(), 
                links 
              };
            });

            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'page_data',
              url: targetUrl,
              title: data.title,
              description: data.description,
              h1: data.h1,
              bodyTextLength: data.bodyText.length,
              bodyText: data.bodyText.length > 8000 ? data.bodyText.substring(0, 8000) + '...' : data.bodyText
            }) + '\n'));

            pagesCrawled++;

            // Yeni link keşfi (Sitemap'te olmayanlar için fallback)
            for (const link of data.links) {
              try {
                const lObj = new URL(link);
                const nL = normalizeForComparison(link);
                if (getBaseDomain(lObj.hostname) === actualBaseDomain && !visitedNormalized.has(nL) && !queuedNormalized.has(nL) && isAllowedExtension(link)) {
                  queuedNormalized.add(nL);
                  queue.push(link);
                }
              } catch {}
            }
          } catch {} finally { await page.close(); }
        };

        try {
          while (queue.length > 0 && pagesCrawled < maxPages) {
            const batch = queue.splice(0, Math.min(queue.length, 3));
            await Promise.all(batch.map(u => crawlPage(u)));
          }
        } finally { await browser.close(); }

        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', totalCrawled: pagesCrawled }) + '\n'));
        controller.close();
      }
    });

    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
  } catch (error) {
    return NextResponse.json({ error: 'Hata' }, { status: 500 });
  }
}
