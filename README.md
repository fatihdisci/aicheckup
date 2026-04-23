# 🚀 AIO Check-up Tool

**AIO Check-up Tool**, web sitenizin modern yapay zeka arama motorlarında (ChatGPT, Perplexity, Gemini vb.) ne kadar görünür olduğunu analiz eden gelişmiş bir **AIO (Artificial Intelligence Optimization)** ve **GEO (Generative Engine Optimization)** aracıdır.

Vibe Coding mantığıyla, modern web teknolojileri kullanılarak geliştirilmiş olup, markanızın yapay zeka hafızasındaki yerini "Kör Test" ve "Teknik RAG Analizi" yöntemleriyle ölçer.

---

## ✨ Özellikler

*   **🕷️ Derin Web Taraması (Playwright):** Hedef URL'yi derinlemesine tarar, meta etiketleri, başlıkları (H1, H2) ve ana içerik metinlerini (body) karakter sınırlarına dikkat ederek çıkarır.
*   **🤖 AI Arama Simülasyonu (Objektif Kör Test):** Site verisi verilmeden, yapay zekanın sadece önceden eğitilmiş bilgisi kullanılarak (sadece Sektör ve Lokasyon verisiyle) markanızın organik olarak önerilip önerilmediği test edilir. Yapay zekanın halüsinasyon görmesini engelleyen katı sistem komutları içerir.
*   **🛠️ Teknik Audit (RAG & AEO Analizi):** Taranan site içeriği yapay zekaya sunulur. Konuşma dili uyumu (NLO), yapısal netlik (AEO) ve E-E-A-T sinyalleri gibi 6 farklı metrik üzerinden /10 puanlama yapılır.
*   **📊 AIO Skor Kartı:** "Kör Test" (%40 etki) ve "Teknik RAG" (%60 etki) analizleri birleştirilerek genel bir AIO skoru ve harf notu (A, B, C, D, F) oluşturulur. Markanın hafıza durumu (Emerging, Recognized vb.) tespit edilir.
*   **📥 Detaylı Rapor Dışa Aktarma:** 
    *   Markdown (.md) formatında indirme veya panoya kopyalama.
    *   **💎 Tam Rapor (HTML):** Yapay zeka ile arka planda yapılan tüm konuşmaların (Prompt ve Raw Response logları), site içeriğinin ve özet skorların yer aldığı, yazdırmaya (PDF çıktı almaya) özel olarak optimize edilmiş profesyonel bir HTML raporu sunar.
*   **⚙️ Dinamik Model Seçimi:** OpenRouter altyapısı sayesinde Gemini 2.5, GPT-4o-Mini, Llama 3.3, DeepSeek gibi birçok farklı LLM modeli seçilerek analiz yapılabilir.

---

## 🏗️ Teknoloji Yığını (Tech Stack)

*   **Frontend:** Next.js (App Router), React 19, Tailwind CSS (v4)
*   **Backend:** Next.js API Routes, Node.js
*   **Tarama (Scraping):** Playwright, Cheerio
*   **AI Entegrasyonu:** OpenAI SDK (OpenRouter API üzerinden)
*   **Markdown & UI:** react-markdown, remark-gfm

---

## 🚀 Kurulum ve Çalıştırma

Projeyi yerel bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

### 1. Gereksinimler
*   Node.js (v18 veya üzeri)
*   npm veya pnpm
*   OpenRouter API Anahtarı

### 2. Kurulum Adımları

Projeyi klonlayın ve bağımlılıkları yükleyin:
```bash
git clone https://github.com/fatihdisci/aicheckup.git
cd aicheckup
npm install
```

Playwright tarayıcılarını indirin (Site taraması için gereklidir):
```bash
npx playwright install
```

Çevresel değişkenleri ayarlayın. Kök dizinde bir `.env.local` dosyası oluşturun ve OpenRouter API anahtarınızı ekleyin:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Geliştirme Sunucusunu Başlatma

Aşağıdaki komut ile projeyi başlatın:
```bash
npm run dev
```
Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresine giderek uygulamayı kullanmaya başlayabilirsiniz.

---

## 🧠 Nasıl Çalışır? (Arka Plan Mantığı)

1.  **Kullanıcı Girişi:** Kullanıcı bir URL, sektör (örn: Lojistik) ve lokasyon (örn: Türkiye) girer.
2.  **Veri Toplama (`/api/crawl`):** Playwright, verilen URL'ye gider ve sayfadaki metinleri (H1, meta description, raw text) kazıyarak frontend'e parça parça (stream) gönderir.
3.  **Kör Test Çağrısı (`/api/analyze` - Adım 1):** Sadece sektör ve lokasyon verisi LLM'e gönderilir. *Amaç:* "Bir kullanıcı X sektöründe arama yaptığında, yapay zeka doğal olarak bu firmayı tavsiye ediyor mu?" sorusunun cevabını bulmaktır (LLMO Score).
4.  **Teknik RAG Çağrısı (`/api/analyze` - Adım 2):** Toplanan tüm site içeriği LLM'e gönderilir. *Amaç:* "Eğer yapay zeka bu siteyi okursa, içeriği ne kadar iyi anlar ve RAG (Retrieval-Augmented Generation) sistemleri için ne kadar uygundur?" sorusunun cevabını bulmaktır. Rekabet açıkları ve aksiyon planı üretilir.
5.  **Sonuç:** Tüm veriler birleştirilir, skor kartı oluşturulur ve kullanıcıya estetik, dışa aktarılabilir bir arayüzde sunulur.

---

## 📜 Lisans

Bu proje kişisel kullanım ve geliştirme amacıyla oluşturulmuştur. Tüm hakları saklıdır.
