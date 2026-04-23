# AIO Check-up: Proje Mimari ve Çalışma Mantığı Raporu

Bu proje, kullanıcıların herhangi bir web sitesini belirli bir sektör bağlamında yapay zeka kullanarak analiz etmelerini sağlayan modern bir web uygulamasıdır.

## 1. Teknolojik Altyapı

*   **Framework:** Next.js 15 (App Router mimarisi)
*   **Dil:** TypeScript (Tip güvenliği ve hata denetimi için)
*   **Stil (Tasarım):** Tailwind CSS (Hızlı ve duyarlı tasarım geliştirmek için)
*   **Yapay Zeka API Sağlayıcısı:** OpenRouter (Farklı AI modellerine erişim için bir geçit görevi görür)
*   **Yapay Zeka Modeli:** `google/gemini-2.5-flash` (Hızlı, yetenekli ve maliyet etkin olduğu için tercih edilmiştir)

## 2. Sistemin Çalışma Mantığı

Kullanıcı arayüzünden (Frontend) yapay zeka modeline (AI) kadar uzanan veri akışı şu şekilde gerçekleşir:

### Adım 1: Kullanıcı Etkileşimi (Frontend - `app/page.tsx`)
1.  Kullanıcı, tarayıcısında `http://localhost:3000` adresine girer ve "AIO Check-up" ana sayfasını görür.
2.  Sayfada bulunan formdaki iki alanı doldurur:
    *   **Web Sitesi URL'si:** İncelenmek istenen web sitesi (örneğin: `https://airbagtr.com/`).
    *   **Sektör:** Web sitesinin bulunduğu veya hedeflendiği sektör (örneğin: `lojistik güvenliği, konteyner hava yastığı`).
3.  Kullanıcı "Analiz Et" butonuna tıklar.
4.  Butona tıklandığı anda `handleSubmit` fonksiyonu devreye girer:
    *   Sayfanın standart yenilenme davranışını durdurur (`e.preventDefault()`).
    *   Yüklenme durumunu (`isLoading`) aktife çeker ve butondaki yazıyı "Yapay Zeka Analiz Ediyor..." olarak değiştirir.
    *   Formdaki verileri toplayıp JSON formatına çevirir ve uygulamanın arka uç (backend) rotasına (`/api/analyze`) bir POST isteği (HTTP Request) gönderir.

### Adım 2: Arka Uç İşlemleri (Backend Route - `app/api/analyze/route.ts`)
1.  İstek, sunucu tarafında çalışan `POST` fonksiyonuna ulaşır. Bu dosya, API anahtarı gibi hassas bilgilerin tarayıcıda (istemcide) görünmesini engelleyen güvenli bir köprü görevi görür.
2.  Gelen URL ve sektör verileri kontrol edilir. Eğer eksikse, istemciye bir hata mesajı döndürülür.
3.  Sunucunun gizli değişkenlerinden (`.env.local` dosyası içinden) `OPENROUTER_API_KEY` okunur.
4.  **Prompt (Komut) Hazırlanır:** Kullanıcıdan gelen bilgilerle yapay zekaya verilecek kesin ve net bir talimat (prompt) oluşturulur.
    *   *Örnek Prompt:* "Lütfen şu web sitesini (https://airbagtr.com/), şu sektör (lojistik) bağlamında detaylıca analiz et..."
5.  **OpenRouter'a İstek Atılır:** `fetch` fonksiyonu kullanılarak OpenRouter'ın `chat/completions` API'sine güvenli bir HTTP POST isteği yapılır. Bu istekte:
    *   Hangi modelin kullanılacağı (`google/gemini-2.5-flash`),
    *   Sistemin (Yapay Zekanın) rolü ("Sen uzman bir dijital stratejistsin..."),
    *   Ve oluşturduğumuz detaylı Prompt (Kullanıcı talebi) yer alır.

### Adım 3: Yapay Zekanın Yanıtı ve Gösterim
1.  OpenRouter, isteği Gemini modeline iletir. Model, belirtilen URL'yi bağlam olarak ele alıp sektörel bilgisiyle harmanlayarak bir rapor üretir ve bu raporu OpenRouter üzerinden bizim backend'imize metin olarak geri döndürür.
2.  Backend rotamız (`route.ts`), gelen bu yanıtı alır ve güvenli bir JSON formatında tekrar ön yüze (frontend'e) gönderir.
3.  Frontend'deki `handleSubmit` fonksiyonu, gelen bu yanıtı (`data.result`) alır.
4.  Yüklenme durumu (`isLoading`) bitirilir (buton tekrar aktifleşir).
5.  State'e kaydedilen bu uzun metin (rapor), `page.tsx` içindeki div blokları sayesinde ekrana Tailwind'in sunduğu şık kart tasarımıyla yansıtılır. `whitespace-pre-wrap` CSS özelliği sayesinde yapay zekanın koyduğu paragraf boşlukları ve maddeler ekranda düzgün bir şekilde okunabilir olur.

## 3. Neden Bu Mimari Seçildi?
*   **Güvenlik:** API anahtarları asla tarayıcıda (`page.tsx`) tutulmamış, sunucu tarafında (`route.ts`) gizlenmiştir.
*   **Performans:** Next.js App Router, sayfaların hızlı yüklenmesini sağlarken, API rotaları (Serverless Functions) sayesinde harici bir backend (Node.js/Express) sunucusu kurma ihtiyacı ortadan kalkmıştır.
*   **Esneklik:** OpenRouter kullanımı sayesinde, ileride `gemini-2.5-flash` modelinden vazgeçilip OpenAI (ChatGPT) veya Anthropic (Claude) modellerine geçilmek istenirse, sadece `route.ts` içindeki tek bir satır (`model: '...'`) değiştirilerek tüm sistem yeni yapay zekaya entegre edilebilir.
