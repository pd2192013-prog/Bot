# MathBot — Cloudflare Workers Version

Google Apps Script wale bot ka poora Cloudflare Workers (JavaScript) conversion.
Image-sawal system (photo bhejkar poochna) puri tarah hata diya gaya hai — ab photo
bhejne par bot sirf ye kahega: "text me sawal bhejo, image padhne ka tool nahi hai"
(user ki language me). Bot token naya wala laga diya gaya hai. Baaki saare features
(Math/Science/English/Hindi/SST, Plans, Telegram Stars payment, Custom limit,
Unlimited access, Auto-delete, poora Admin panel) bilkul pehle jaisa hi kaam karte hain.

Google Sheets ki jagah **Cloudflare D1** (SQL database) use hua hai, aur
`PropertiesService`/`CacheService` ki jagah **Cloudflare KV** use hua hai — kyunki
Workers ke paas Sheets jaisi cheez nahi hoti.

## Files
- `worker.js` — poora bot code
- `schema.sql` — database tables (ek baar chalana hai)
- `wrangler.toml` — deployment config

## Setup (step-by-step)

1. **Wrangler install/login karo** (agar pehle se nahi hai):
   ```
   npm install -g wrangler
   wrangler login
   ```

2. **D1 database banao:**
   ```
   wrangler d1 create mathbot-db
   ```
   Ye jo `database_id` output me milega, use `wrangler.toml` me
   `database_id = "..."` wali line me paste karo.

3. **Schema (tables) load karo:**
   ```
   wrangler d1 execute mathbot-db --remote --file=./schema.sql
   ```

4. **KV namespace banao:**
   ```
   wrangler kv namespace create BOT_KV
   ```
   Jo `id` milega, use `wrangler.toml` me `[[kv_namespaces]]` ke neeche
   `id = "..."` wali line me paste karo.

5. **Deploy karo:**
   ```
   wrangler deploy
   ```
   Deploy hone ke baad ek URL milega, jaise:
   `https://mathbot-worker.<your-subdomain>.workers.dev`

6. **Telegram ko webhook batao** — us URL ke aage `/setWebhook` laga kar
   browser me kholo:
   `https://mathbot-worker.<your-subdomain>.workers.dev/setWebhook`
   Response me `"ok":true` dikhna chahiye.

7. **Admin panel kholne ke liye**, bot ko wahi ADMIN_PASSWORD wala message
   apne (ADMIN_ID wale) Telegram account se bhejo — jaisa pehle hota tha.

## Note: API keys code me hardcoded hain

`worker.js` ke top par `BOT_TOKEN`, `GEMINI_API_KEY`, `ADMIN_PASSWORD`,
`ADMIN_ID` — bilkul original file ki tarah seedhe code me likhe hain (naya
bot token daal diya gaya hai). Agar chaho to inhe Cloudflare Secrets me
move kar sakte ho (`wrangler secret put BOT_TOKEN`) — lekin ye zaroori nahi,
bot bina isके bhi chalega. Gemini API key admin panel se bhi kabhi change ki
ja sakti hai (wahi "🔑 Gemini API Key" wala button).

## Kya-kya hata diya gaya

- Image bhejkar sawal poochhna (OCR + Gemini vision)
- "🖼 Free Image Limit" admin setting
- "🚫 Image Exceeded Message" admin setting
- Plan banate waqt "Daily Image Limit" wala step
- User-detail me image-usage wali lines

Sab jagah jahan pehle "images/din" ya image-limit dikhta tha, wo hata diya
gaya hai — baaki sab (questions/din, plans, subjects) waisa hi hai.
