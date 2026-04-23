import { OpenAI } from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-checkup.com',
    'X-Title': 'AIO Checkup',
  },
});

// === PROMPT TANIMLAMALARI ===

const BLIND_TEST_SYSTEM = `You are an independent AI Search Behavior Analyst. You have NO access to any company's website. You only use your pre-trained knowledge to simulate how AI answer engines (ChatGPT, Perplexity, Gemini) respond to user queries.

ALL OUTPUT MUST BE IN TURKISH. ONLY THIS SYSTEM PROMPT IS IN ENGLISH.

CRITICAL RULE — ZERO DATA CONTAMINATION:
You will receive only: (1) an industry/niche description, (2) a geographic location, and (3) a company name to check against.
Answer purely from pre-trained memory. DO NOT favor the target company.

YOUR TASK:
Generate 10 high-intent, long-tail questions a real customer would type into an AI assistant.

For each question, simulate how ChatGPT or Perplexity would naturally answer (list 2-4 real companies from memory). Check if the target company appears.

CRITICAL SCORING RULE (NO HALLUCINATIONS):
You MUST NOT score "Birincil Öneri" or "İkincil Öneri" UNLESS the target company's name ACTUALLY APPEARS in your generated text for "Yapay Zekanın Doğal Cevabı".
If the exact target company name is NOT written in your answer text, you MUST score it "Hayır". Do not pretend it is mentioned if it is not.
Also, provide a short 1-sentence justification (Gerekçe) explaining why you gave that score.

Score each appearance:
- "Birincil Öneri" = mentioned 1st or 2nd  
- "İkincil Öneri" = mentioned 3rd or 4th
- "Hayır" = not mentioned in the text at all

OUTPUT — Strict Markdown Table first:
| # | Müşteri Sorusu | Yapay Zekanın Doğal Cevabı (Gerçek Firmalar) | Hedef Firma | Görünürlük | Gerekçe |
|---|----------------|----------------------------------------------|-------------|------------|---------|

Then a JSON block:
\`\`\`json
{
  "llmo_raw_score": <0-100 integer>,
  "llmo_calculation": "<scoring explanation>",
  "dominant_competitors": ["firma1", "firma2", "firma3"],
  "brand_memory_status": "<unknown|emerging|recognized|dominant>"
}
\`\`\`

LLMO Score Rubric:
- Base: 0
- +8 per "İkincil Öneri" appearance (max 80)
- +10 per "Birincil Öneri" appearance (max 100)  
- -5 if brand name is confused/misspelled in your memory
- Cap at 100.`;

const TECHNICAL_AUDIT_SYSTEM = `You are a world-class Technical AIO Auditor specializing in AI answer engine visibility.

ALL OUTPUT MUST BE IN TURKISH. ONLY THIS SYSTEM PROMPT IS IN ENGLISH.

You will receive: (1) LLMO data from a blind test, (2) scraped website content.

Generate a 3-section technical audit report:

### 3. Yapay Zeka Okunabilirlik Skoru (RAG & AEO Audit)

Score these 6 dimensions /10 with a 1-sentence finding each:
| Kriter | Puan /10 | Bulgu |
|--------|----------|-------|
| Konuşma Dili Uyumu (NLO) | x/10 | ... |
| Yapısal Netlik (AEO) | x/10 | ... |
| Semantik Derinlik | x/10 | ... |
| E-E-A-T Sinyalleri | x/10 | ... |
| Schema & Yapısal Veri | x/10 | ... |
| Atıf Çekim Gücü | x/10 | ... |

**RAG Okunabilirlik Genel Skoru: [AVERAGE]/10**
**Kritik Bulgu:** [Sitenin en büyük tek AEO sorunu]

### 4. Rekabet Açığı Analizi

| İçerik Açığı | Rakip Avantajı | Kapama Stratejisi |
|--------------|----------------|-------------------|
(3 satır — her biri blind test'te ortaya çıkan gerçek rakiplere dayalı)

### 5. Site'ye Özel AIO Aksiyon Planı

5 action, each MUST reference specific scraped content findings:
**[EYLEM X] [Kritik/Yüksek/Orta]**
- **Ne yapılmalı:** [specific action]
- **Neden:** [reference to scraped content finding]
- **Beklenen Etki:** [AI visibility impact]
- **Tahmini Süre:** [implementation time]`;

// === YARDIMCI FONKSİYONLAR ===

function buildStructuredContent(pages: any[]): string {
  return pages.map((p: any, idx: number) => {
    if (idx < 30) {
      return `URL: ${p.url}\nBaşlık: ${p.title}\nH1: ${p.h1}\nİçerik: ${p.bodyText}\n---`;
    }
    return `URL: ${p.url}\nBaşlık: ${p.title} (özet alındı)\n---`;
  }).join('\n');
}

function extractCompanyMeta(pages: any[]): { name: string; domain: string; industry: string } {
  const firstPage = pages[0] || {};
  const domain = firstPage.url ? new URL(firstPage.url).hostname.replace('www.', '') : 'bilinmiyor';
  return {
    name: firstPage.title?.split(/[-|]/)[0]?.trim() || domain,
    domain,
    industry: 'otomatik tespit edilecek',
  };
}

async function streamToController(
  response: AsyncIterable<any>,
  controller: ReadableStreamDefaultController,
  prefix: string = ''
): Promise<string> {
  let fullText = '';
  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullText += content;
      controller.enqueue(new TextEncoder().encode(prefix + content));
      prefix = '';
    }
  }
  if (prefix) {
      controller.enqueue(new TextEncoder().encode(prefix));
  }
  return fullText;
}

// === ANA ROUTE ===

export async function POST(req: Request) {
  try {
    const { pages, model, industry, location } = await req.json();

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return new Response('Hata: Taranmış veri bulunamadı.', { status: 400 });
    }

    const meta = extractCompanyMeta(pages);
    const structuredContent = buildStructuredContent(pages);
    
    const blindTestModel = 'google/gemini-2.5-flash';
    const auditModel = model || 'google/gemini-2.5-flash-lite';

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendData = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        };

        try {
          // ============================================
          // ÇAĞRI 1: KÖR TEST (Site verisi yok)
          // ============================================
          sendData({ type: 'debug', label: 'Blind Test System Prompt', content: BLIND_TEST_SYSTEM });
          
          const blindTestUserPrompt = `Sektör/Niş: ${industry || meta.industry}
Lokasyon: ${location || 'Türkiye'}
Hedef Firma Adı: ${meta.name}

Lütfen bu firmayı hiç bilmiyormuş gibi, yalnızca sektör ve lokasyon bilgisiyle kör testi gerçekleştir.`;

          sendData({ type: 'debug', label: 'Blind Test User Prompt', content: blindTestUserPrompt });

          sendData({ type: 'content', content: '\n## 1. Yapay Zeka Arama Simülasyonu (Objektif Kör Test)\n\n' });
          sendData({ type: 'content', content: '> *Bu bölüm site verisi olmadan, yalnızca yapay zekanın önceden eğitilmiş bilgisiyle oluşturulmuştur.*\n\n' });

          const blindTestResponse = await openai.chat.completions.create({
            model: blindTestModel,
            messages: [
              { role: 'system', content: BLIND_TEST_SYSTEM },
              { role: 'user', content: blindTestUserPrompt },
            ],
            stream: true,
            max_tokens: 3000,
          });

          // Kör test çıktısını topla (hem stream hem parse için)
          let blindTestOutput = '';
          for await (const chunk of blindTestResponse) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              blindTestOutput += content;
              sendData({ type: 'content', content });
            }
          }

          sendData({ type: 'debug', label: 'Blind Test Raw Response', content: blindTestOutput });

          // JSON bloğunu parse et (Çağrı 2'ye geçirmek için)
          let llmoData = { llmo_raw_score: 0, dominant_competitors: [], brand_memory_status: 'unknown' };
          try {
            const jsonMatch = blindTestOutput.match(/```json\s*([\s\S]*?)```/);
            if (jsonMatch) {
              llmoData = JSON.parse(jsonMatch[1]);
            }
          } catch {
            // Parse başarısız olursa varsayılan değerler kullanılır
          }

          // ============================================
          // ÇAĞRI 2: TEKNİK AUDIT (Site verisi İLE)
          // ============================================
          sendData({ type: 'content', content: '\n\n---\n\nKör Test Tamamlandı ✓ — Teknik Audit Başlıyor...\n\n---\n\n' });

          const technicalAuditUserPrompt = `LLMO_DATA: ${JSON.stringify(llmoData)}

SCRAPED_CONTENT:
${structuredContent}

Firma: ${meta.name}
Domain: ${meta.domain}`;

          sendData({ type: 'debug', label: 'Technical Audit System Prompt', content: TECHNICAL_AUDIT_SYSTEM });
          sendData({ type: 'debug', label: 'Technical Audit User Prompt', content: technicalAuditUserPrompt });

          const technicalResponse = await openai.chat.completions.create({
            model: auditModel,
            messages: [
              { role: 'system', content: TECHNICAL_AUDIT_SYSTEM },
              { role: 'user', content: technicalAuditUserPrompt },
            ],
            stream: true,
            max_tokens: 3000,
          });

          let technicalOutput = '';
          for await (const chunk of technicalResponse) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              technicalOutput += content;
              sendData({ type: 'content', content });
            }
          }

          sendData({ type: 'debug', label: 'Technical Audit Raw Response', content: technicalOutput });
          
          // ============================================
          // BÖLÜM 4: SKOR KARTI SİSTEMİ
          // ============================================
          
          let ragScore = 50; 
          const ragMatch = technicalOutput.match(/Genel Skoru:\s*([\d.]+)\s*\/\s*10/i);
          if (ragMatch && ragMatch[1]) {
             ragScore = parseFloat(ragMatch[1]) * 10;
          }

          const llmoScore = llmoData.llmo_raw_score || 0;
          const overallAioScore = Math.round((llmoScore * 0.4) + (ragScore * 0.6));
          
          let grade = 'F';
          if (overallAioScore >= 80) grade = 'A';
          else if (overallAioScore >= 65) grade = 'B';
          else if (overallAioScore >= 50) grade = 'C';
          else if (overallAioScore >= 35) grade = 'D';

          const scoreCardMd = `\n\n---\n\n## 6. AIO Genel Skor Kartı\n\n| Metrik | Skor | Etki |\n|--------|------|------|\n| **LLMO Skoru** (Hafıza) | ${llmoScore}/100 | %40 |\n| **RAG Skoru** (Teknik) | ${ragScore}/100 | %60 |\n| **GENEL AIO SKORU** | **${overallAioScore}/100** | **100%** |\n\n**Genel Değerlendirme Notu:** \`${grade}\`\n**Baskın Rakipler:** ${llmoData.dominant_competitors?.join(', ') || 'Belirlenemedi'}\n**Marka Hafıza Durumu:** ${llmoData.brand_memory_status || 'Bilinmiyor'}\n`;

          sendData({ type: 'content', content: scoreCardMd });

        } catch (innerError: any) {
          sendData({ type: 'error', message: innerError.message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error: any) {
    console.error('AI Analiz Hatası:', error);
    return new Response(`Hata: ${error.message}`, { status: 500 });
  }
}
