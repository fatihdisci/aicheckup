"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CrawledPage {
  url: string;
  title: string;
  description: string;
  h1: string;
  h2: string;
  bodyTextLength: number;
  bodyText: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crawledPages, setCrawledPages] = useState<CrawledPage[]>([]);
  const [isDone, setIsDone] = useState(false);

  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('Türkiye');

  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash-lite");
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [debugLogs, setDebugLogs] = useState<{label: string, content: string}[]>([]);

  const models = [
    { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", cost: "I: $0.10, O: $0.40" },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", cost: "I: $0.30, O: $2.50" },
    { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash Preview", cost: "I: $0.50, O: $3.00" },
    { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", cost: "I: $0.252, O: $0.378" },
    { id: "xiaomi/mimo-v2-flash", name: "Xiaomi MiMo V2 Flash", cost: "I: $0.09, O: $0.29" },
    { id: "qwen/qwen3.5-flash-02-23", name: "Qwen 3.5 Flash", cost: "I: $0.065, O: $0.26" },
    { id: "qwen/qwen3.5-9b", name: "Qwen 3.5 9B", cost: "I: $0.10, O: $0.15" },
    { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", cost: "I: $0.10, O: $0.32" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", cost: "I: $0.15, O: $0.60" },
    { id: "openai/gpt-oss-120b:free", name: "GPT-OSS 120B (Free)", cost: "Ücretsiz" },
    { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", cost: "I: $0.039, O: $0.19" },
    { id: "google/gemma-4-31b-it", name: "Gemma 4 31B", cost: "I: $0.13, O: $0.38" },
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setCrawledPages([]);
    setError(null);
    setAnalysisResult(null);
    setDebugLogs([]);
    setStatusMessage("Tarayıcı (Playwright) başlatılıyor...");
    setIsDone(false);

    const formData = new FormData(e.currentTarget);
    const url = formData.get("url") as string;

    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error(`HTTP Hatası: ${response.status}`);
      if (!response.body) throw new Error('Sunucudan veri akışı alınamadı.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (part.trim() === '') continue;
            try {
              const data = JSON.parse(part);
              if (data.type === 'status') {
                setStatusMessage(data.message);
              } else if (data.type === 'page_data') {
                setCrawledPages((prev) => [...prev, data as CrawledPage]);
              } else if (data.type === 'done') {
                setIsDone(true);
                setStatusMessage(`Tarama tamamlandı! Toplam ${data.totalCrawled} sayfa analiz için hazır.`);
                setIsLoading(false);
              }
            } catch (err) {
              console.error('Parse Hatası:', err);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  const handleAIAnalyze = async () => {
    if (crawledPages.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisResult("");
    setDebugLogs([]);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pages: crawledPages, 
          model: selectedModel,
          industry,
          location
        }),
      });

      if (!response.ok) throw new Error('Analiz başlatılamadı.');
      if (!response.body) throw new Error('Analiz verisi alınamadı.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (part.trim() === '') continue;
            try {
              const data = JSON.parse(part);
              if (data.type === 'content') {
                setAnalysisResult((prev) => (prev || "") + data.content);
              } else if (data.type === 'debug') {
                setDebugLogs((prev) => [...prev, { label: data.label, content: data.content }]);
              } else if (data.type === 'error') {
                setError(data.message);
              }
            } catch (err) {
              console.error('Parse Hatası:', err);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateMarkdown = () => {
    const totalChars = crawledPages.reduce((sum, p) => sum + p.bodyTextLength, 0);
    let md = "# Web Sitesi Tarama Raporu\n\n";
    md += "## 📊 Özet Bilgiler\n";
    md += `- **Toplam Sayfa:** ${crawledPages.length}\n`;
    md += `- **Toplam Karakter:** ${totalChars.toLocaleString()}\n`;
    md += `- **Ortalama Sayfa Uzunluğu:** ${Math.round(totalChars / crawledPages.length).toLocaleString()} karakter\n`;
    md += `- **Tarama Tarihi:** ${new Date().toLocaleString('tr-TR')}\n\n`;
    md += "---\n\n";

    crawledPages.forEach((page, idx) => {
      md += `## Sayfa ${idx + 1}: ${page.url}\n`;
      md += `- **Başlık:** ${page.title}\n`;
      md += `- **H1:** ${page.h1}\n`;
      md += `- **İçerik Uzunluğu:** ${page.bodyTextLength} karakter\n\n`;
      md += `### Sayfa İçeriği\n${page.bodyText}\n\n`;
      md += `---\n\n`;
    });
    return md;
  };

  const copyToClipboard = async () => {
    const text = generateMarkdown();
    try {
      await navigator.clipboard.writeText(text);
      alert("Tüm içerik Markdown formatında kopyalandı!");
    } catch (err) {
      alert("Kopyalama başarısız oldu.");
    }
  };

  const downloadFile = () => {
    const text = generateMarkdown();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarama_raporu_${new Date().getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportFullReportHTML = () => {
    const totalChars = crawledPages.reduce((sum, p) => sum + p.bodyTextLength, 0);
    const date = new Date().toLocaleString('tr-TR');
    
    // Basit bir Markdown -> HTML dönüştürücü (Tablo desteği ile)
    const simpleMarkdownToHTML = (md: string) => {
      if (!md) return '';
      let html = '';
      let inTable = false;
      let isFirstTableRow = false;

      const lines = md.split('\n');
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (line.startsWith('|')) {
          if (!inTable) {
            html += '<div style="overflow-x: auto;"><table>\n';
            inTable = true;
            isFirstTableRow = true;
          }
          if (line.match(/^\|[\s\-:]+\|$/) || line.includes('---|')) {
            continue;
          }
          
          let row = line.substring(1, line.length - 1).split('|').map(c => c.trim());
          if (isFirstTableRow) {
             html += '<tr>' + row.map(c => '<th>' + c + '</th>').join('') + '</tr>\n';
             isFirstTableRow = false;
          } else {
             html += '<tr>' + row.map(c => '<td>' + c + '</td>').join('') + '</tr>\n';
          }
        } else {
          if (inTable) {
            html += '</table></div>\n';
            inTable = false;
          }

          if (line.startsWith('### ')) {
            html += '<h3 style="color: #6366f1; margin-top: 24px;">' + line.substring(4) + '</h3>\n';
          } else if (line.startsWith('## ')) {
            html += '<h2 style="color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 32px;">' + line.substring(3) + '</h2>\n';
          } else if (line.startsWith('# ')) {
            html += '<h1 style="color: #1e1b4b; text-align: center; margin-bottom: 40px;">' + line.substring(2) + '</h1>\n';
          } else if (line.startsWith('> ')) {
             html += '<blockquote style="border-left: 4px solid #cbd5e1; padding-left: 16px; color: #64748b; font-style: italic; margin: 16px 0;">' + line.substring(2) + '</blockquote>\n';
          } else if (line.startsWith('- ') || line.startsWith('* ')) {
            html += '<li style="margin-left: 20px; margin-bottom: 8px;">' + line.substring(2) + '</li>\n';
          } else if (line.length > 0) {
             html += '<p style="margin-bottom: 16px;">' + line + '</p>\n';
          }
        }
      }
      if (inTable) {
        html += '</table></div>\n';
      }
      
      return html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                 .replace(/`(.*?)`/g, '<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-size: 13px;">$1</code>');
    };

    const debugHtml = debugLogs.map(log => {
      const safeContent = log.content.replace(new RegExp('<', 'g'), '&lt;').replace(new RegExp('>', 'g'), '&gt;');
      return '<div class="debug-entry"><div class="debug-label">' + log.label + '</div><pre>' + safeContent + '</pre></div>';
    }).join('');

    const pagesHtml = crawledPages.map((page, idx) => {
      const safeText = page.bodyText.substring(0, 1000) + (page.bodyText.length > 1000 ? '...' : '');
      const h1Text = page.h1 || '---';
      const descText = page.description || '---';
      const titleText = page.title || 'Başlıksız';
      return '<div class="page-entry"><div class="badge">SAYFA ' + (idx + 1) + '</div><h3 style="margin: 12px 0 4px 0;">' + titleText + '</h3><div class="page-url">' + page.url + '</div><p><strong>H1:</strong> ' + h1Text + '</p><p><strong>Açıklama:</strong> ' + descText + '</p><div style="font-size: 13px; color: #475569; background: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 12px;">' + safeText + '</div></div>';
    }).join('');

    const modelName = selectedModel.split('/').pop() || '';
    const ind = industry || 'Belirtilmedi';
    const analysisHtml = simpleMarkdownToHTML(analysisResult || 'Analiz sonucu bulunamadı.');
    const year = new Date().getFullYear();

    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>AIO Check-up Tam Rapor - ${date}</title>
    <style>
        :root { --primary: #4f46e5; --bg: #f8fafc; --text: #334155; --border: #e2e8f0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: var(--text); max-width: 1000px; margin: 0 auto; padding: 40px; background: var(--bg); }
        .card { background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); margin-bottom: 32px; border: 1px solid var(--border); }
        .header { text-align: center; margin-bottom: 48px; position: relative; }
        .print-btn { position: absolute; right: 0; top: 0; background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgb(79 70 229 / 0.3); transition: all 0.2s; }
        .print-btn:hover { background: #4338ca; transform: translateY(-1px); }
        .stats-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #f1f5f9; padding: 24px; border-radius: 12px; text-align: center; border: 1px solid var(--border); }
        .stat-value { font-size: 28px; font-weight: 900; color: var(--primary); margin-bottom: 4px; }
        .stat-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        h1, h2, h3 { color: #0f172a; margin-top: 0; }
        h2 { border-bottom: 2px solid var(--border); padding-bottom: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
        pre { background: #0f172a; color: #cbd5e1; padding: 20px; border-radius: 12px; overflow-x: auto; font-size: 13px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid #1e293b; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; }
        th, td { border: 1px solid var(--border); padding: 16px; text-align: left; }
        th { background: #f8fafc; font-weight: 700; color: #475569; }
        td { background: white; }
        .debug-entry { margin-bottom: 32px; border-left: 4px solid var(--primary); padding-left: 20px; background: #f8fafc; padding: 20px 20px 20px 24px; border-radius: 0 12px 12px 0; }
        .debug-label { font-weight: 800; color: var(--primary); text-transform: uppercase; font-size: 13px; margin-bottom: 12px; letter-spacing: 0.05em; }
        .page-entry { border-bottom: 1px solid var(--border); padding: 32px 0; }
        .page-entry:last-child { border-bottom: none; padding-bottom: 0; }
        .page-url { color: var(--primary); font-size: 14px; word-break: break-all; margin-bottom: 16px; font-family: monospace; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: #e0e7ff; color: #4338ca; margin-bottom: 12px; }
        .content-box { font-size: 13px; color: #475569; background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 16px; border: 1px solid var(--border); }

        @media print {
            body { background: white; padding: 0; max-width: none; }
            .card { box-shadow: none; border: none; padding: 0; margin-bottom: 40px; page-break-inside: avoid; }
            .print-btn { display: none; }
            .stats-grid { page-break-inside: avoid; }
            .stat-card { border: 2px solid #000; background: white; }
            pre { background: white; color: black; border: 1px solid #ccc; white-space: pre-wrap; word-break: break-word; }
            .debug-entry { background: white; border-left: 4px solid #000; padding: 10px 0 10px 16px; page-break-inside: avoid; }
            .page-entry { page-break-inside: avoid; border-bottom: 1px solid #ccc; }
            .content-box { background: white; border: 1px solid #ccc; }
            table, th, td { border: 1px solid #000; }
            th { background: #eee; color: #000; }
            h1, h2, h3, .stat-value, .debug-label, .page-url { color: #000; }
            .badge { border: 1px solid #000; background: white; color: #000; }
        }
    </style>
</head>
<body>
    <div class="header">
        <button class="print-btn" onclick="window.print()">🖨️ Yazdır / PDF Kaydet</button>
        <h1 style="margin-bottom: 8px;">AIO Check-up Analiz Raporu</h1>
        <p style="color: #64748b;">Oluşturulma Tarihi: ${date}</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${crawledPages.length}</div><div class="stat-label">Sayfa</div></div>
        <div class="stat-card"><div class="stat-value">${totalChars.toLocaleString()}</div><div class="stat-label">Karakter</div></div>
        <div class="stat-card"><div class="stat-value">${modelName}</div><div class="stat-label">Model</div></div>
        <div class="stat-card"><div class="stat-value">${ind}</div><div class="stat-label">Sektör</div></div>
    </div>

    <div class="card">
        <h2>🤖 Yapay Zeka Analiz Sonucu</h2>
        <div class="analysis-content">
            ${analysisHtml}
        </div>
    </div>

    <div class="card">
        <h2>🛠️ Teknik Veri &amp; AI İletişim Kayıtları (Debug)</h2>
        ${debugHtml}
    </div>

    <div class="card">
        <h2>🌐 Taranan Site İçeriği</h2>
        ${pagesHtml}
    </div>

    <footer style="text-align: center; margin-top: 60px; color: #94a3b8; font-size: 12px; page-break-inside: avoid;">
        &copy; ${year} AIO Check-up Tool - Tüm hakları saklıdır.
    </footer>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aio_tam_rapor_${new Date().getTime()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalChars = crawledPages.reduce((sum, p) => sum + p.bodyTextLength, 0);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center py-12 px-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-7xl">
        
        {/* Header Section */}
        <div className="relative overflow-hidden bg-slate-900/50 backdrop-blur-xl rounded-[40px] border border-slate-800 p-10 mb-12 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 blur-[100px] rounded-full -ml-20 -mb-20"></div>
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
              Advanced AIO & GEO Engine
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              AIO Check-up Tool
            </h1>
            <p className="text-slate-400 max-w-2xl text-lg leading-relaxed mb-10">
              Web sitenizi modern yapay zeka motorları (GEO) için optimize edin. 
              Playwright ile derin tarama yapın, OpenRouter modelleriyle mikroskobik analizler gerçekleştirin.
            </p>

            <form className="w-full max-w-3xl flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col md:flex-row gap-4">
                <input 
                  type="url" 
                  name="url" 
                  placeholder="Analiz edilecek URL'yi girin (https://...)"
                  className="flex-grow px-6 py-5 bg-slate-950/50 border border-slate-700 rounded-3xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-white text-lg placeholder:text-slate-600 shadow-inner"
                  required 
                  disabled={isLoading}
                />
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <input 
                  type="text" 
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Sektör / Niş (İsteğe Bağlı - Örn: Lojistik)"
                  className="flex-grow px-6 py-4 bg-slate-950/50 border border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-white text-md placeholder:text-slate-600 shadow-inner"
                  disabled={isLoading}
                />
                <input 
                  type="text" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Lokasyon (İsteğe Bağlı - Örn: Türkiye)"
                  className="flex-grow px-6 py-4 bg-slate-950/50 border border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-white text-md placeholder:text-slate-600 shadow-inner"
                  disabled={isLoading}
                />
              </div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full px-8 py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black rounded-3xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 active:scale-95 mt-2"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <><span>🚀</span> Taramayı Başlat</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Status and Progress */}
        {(isLoading || statusMessage) && (
          <div className="mb-12 animate-fade-in">
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex items-center gap-6">
              <div className="flex-grow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-tighter">{statusMessage}</span>
                  {isLoading && <span className="text-xs text-indigo-400 animate-pulse font-mono">BROWSER_ACTIVE</span>}
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-indigo-500 transition-all duration-500 ${isLoading ? 'w-1/2 animate-pulse' : 'w-full'}`}></div>
                </div>
              </div>
              
              {!isLoading && isDone && (
                <div className="flex gap-3">
                  <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {models.map(m => <option key={m.id} value={m.id}>{m.name} ({m.cost})</option>)}
                  </select>
                  <button 
                    onClick={handleAIAnalyze}
                    disabled={isAnalyzing}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                  >
                    {isAnalyzing ? "Analiz Ediliyor..." : "AI Analizini Başlat"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Analysis Dashboard */}
        {analysisResult && (
          <div className="mb-12 animate-fade-in-up">
            <div className="bg-slate-900/60 backdrop-blur-md border-2 border-indigo-500/20 rounded-[40px] overflow-hidden shadow-2xl">
              <div className="bg-indigo-600 px-10 py-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🤖</div>
                  <div>
                    <h2 className="text-2xl font-black text-white leading-none mb-1">AIO & GEO DASHBOARD</h2>
                    <p className="text-indigo-100/70 text-sm font-medium">Stratejik Yapay Zeka Görünürlük Raporu</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowRawData(!showRawData)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white transition-all uppercase"
                  >
                    {showRawData ? "Raporu Gör" : "AI Verisini Gör"}
                  </button>
                </div>
              </div>

              <div className="p-10">
                {showRawData ? (
                  <div className="space-y-8">
                    {debugLogs.length > 0 ? (
                      debugLogs.map((log, idx) => (
                        <div key={idx} className="bg-slate-950 rounded-3xl p-8 border border-slate-800">
                          <h3 className="text-indigo-400 font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-sm">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                            {log.label}
                          </h3>
                          <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 p-4 bg-black/30 rounded-xl">
                            {log.content}
                          </pre>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 text-center py-20 font-medium italic">
                        Henüz debug verisi toplanmadı. Analizi başlatın...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none prose-indigo prose-headings:font-black prose-headings:tracking-tight prose-p:text-slate-300 prose-p:leading-relaxed prose-table:border prose-table:border-slate-800 prose-th:bg-slate-900 prose-th:p-4 prose-td:p-4 prose-td:border-t prose-td:border-slate-800">
                    {analysisResult ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {analysisResult}
                      </ReactMarkdown>
                    ) : (
                      <div className="flex items-center gap-3 text-slate-500 animate-pulse">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                        Analiz raporu oluşturuluyor...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Crawled Content Grid */}
        {crawledPages.length > 0 && (
          <div className="animate-fade-in-up">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              {[
                { label: "Toplam Sayfa", value: crawledPages.length, color: "indigo" },
                { label: "Toplam Karakter", value: totalChars.toLocaleString(), color: "emerald" },
                { label: "Ortalama Uzunluk", value: Math.round(totalChars / crawledPages.length), color: "amber" },
                { label: "Analiz Durumu", value: isDone ? "HAZIR" : "TARANIYOR", color: "rose" }
              ].map((stat, i) => (
                <div key={i} className="bg-slate-900/40 border border-slate-800 p-8 rounded-[32px] hover:border-slate-700 transition-colors group">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2 group-hover:text-slate-400 transition-colors">{stat.label}</div>
                  <div className={`text-4xl font-black text-${stat.color}-500 tracking-tighter`}>{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
              <h2 className="text-3xl font-black text-white tracking-tight">Taranan İçerik Arşivi</h2>
              <div className="flex gap-3">
                <button onClick={exportFullReportHTML} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all uppercase tracking-widest shadow-lg shadow-indigo-600/20">💎 TAM RAPOR (HTML)</button>
                <button onClick={copyToClipboard} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-xs font-bold transition-all uppercase tracking-widest">📋 Kopyala</button>
                <button onClick={downloadFile} className="px-6 py-3 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-600/20 rounded-2xl text-xs font-bold transition-all uppercase tracking-widest">📥 İndir (.md)</button>
              </div>
            </div>

            <div className="space-y-6">
              {crawledPages.map((page, idx) => (
                <div key={idx} className="group bg-slate-900/30 border border-slate-800 rounded-[32px] p-8 hover:bg-slate-900/50 hover:border-indigo-500/30 transition-all duration-500">
                  <div className="flex flex-col lg:flex-row gap-10">
                    <div className="lg:w-1/3">
                      <div className="inline-flex px-3 py-1 bg-slate-800 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">PAGE_INDEX_0{idx + 1}</div>
                      <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{page.title || 'Başlıksız Sayfa'}</h3>
                      <p className="text-indigo-400 text-xs font-medium break-all mb-6 hover:text-indigo-300 transition-colors cursor-pointer">{page.url}</p>
                      
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                          <div className="text-[10px] font-black text-slate-500 uppercase mb-1">H1 Tag</div>
                          <div className="text-sm text-slate-300 font-semibold">{page.h1 || '---'}</div>
                        </div>
                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                          <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Meta Description</div>
                          <div className="text-sm text-slate-400 leading-relaxed italic line-clamp-3">{page.description || 'Açıklama bulunamadı.'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:w-2/3 bg-slate-950/80 rounded-[24px] p-8 border border-slate-800 shadow-inner relative group/content">
                      <div className="absolute top-6 right-8 text-[10px] font-black text-slate-600 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 group-hover/content:border-indigo-500/20 transition-colors">
                        {page.bodyTextLength} CHARS
                      </div>
                      <div className="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest">Extracted Content</div>
                      <div className="text-sm text-slate-400 leading-[1.8] max-h-[320px] overflow-y-auto pr-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                        {page.bodyText || <span className="opacity-20">İçerik çekilemedi.</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
        .animate-fade-in-up { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </div>
  );
}
