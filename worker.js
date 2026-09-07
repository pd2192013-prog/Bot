/**
 * Telegram Subject Tutor Bot — Cloudflare Workers version
 * =========================================================================
 * Google Apps Script wale bot (Sheets database) ka poora Cloudflare Workers
 * (JavaScript) me conversion. Koi feature kam nahi kiya gaya — sirf storage
 * ka tareeka badla hai (Sheets ki jagah D1, PropertiesService ki jagah KV),
 * kyunki Cloudflare Workers ke paas Google Sheets jaisi cheez nahi hoti.
 *
 * IMAGE-SAWAL SYSTEM PURI TARAH HATA DIYA GAYA HAI (jaisa maanga gaya tha):
 * - Photo bhejne par ab OCR/Gemini-vision kuch nahi hota.
 * - Sirf ek chhota sa message jaata hai (jis language me user ne select
 *   kiya hai usi me): "text me sawal bhejo, image padhne ka tool nahi hai".
 * - Image limits, "Free Image Limit" admin setting, "Image Exceeded
 *   Message" admin setting, Plan ka "Daily Image Limit" — sab hata diya
 *   gaya hai. Baaki sab (Math/Science/English/Hindi/SST, Plans, Custom
 *   limit, Unlimited, Auto-delete, Telegram Stars payment, Admin panel)
 *   bilkul pehle jaisa hi kaam karta hai.
 *
 * SETUP (README.md me detail me hai):
 * 1. `wrangler d1 create mathbot-db` chalao, ID ko wrangler.toml me daalo.
 * 2. `wrangler d1 execute mathbot-db --remote --file=./schema.sql` chalao.
 * 3. `wrangler kv namespace create BOT_KV` chalao, ID ko wrangler.toml me daalo.
 * 4. `wrangler deploy` chalao.
 * 5. Apne deployed worker URL ko browser me kholo: <your-worker-url>/setWebhook
 *    — isse Telegram ko bata diya jaayega ki updates kahan bhejne hain.
 * 6. Admin panel kholne ke liye ADMIN_PASSWORD wala exact message bhejo —
 *    sirf ADMIN_ID wale Telegram account se hi khulega.
 */

// ==== Config ====
var BOT_TOKEN = "8934885021:AAHOig55eA6B4V38EurEdCeM9PSeAhh9Qcs"; // <-- naya token (jaisa diya gaya)
var GEMINI_API_KEY = "AQ.Ab8RN6KVIk2FTvUUdTvbSfNpLCP2aZg7LMt2rK2vsj0SZvExUg";
var ADMIN_PASSWORD = "Botadmin###pd#8643$$&()489fikncj@dminpbdhl#-+)&\":!((&_7";
var ADMIN_ID = "8054528325";

var DEFAULT_MODEL = "gemini-3.5-flash-lite";
var DEFAULT_FREE_LIMIT = "5";
var DEFAULT_RESET_MS = String(24 * 60 * 60 * 1000);
var DEFAULT_RESET_LABEL = "24 hour(s)";

var DEFAULT_WELCOME_HI =
  "🤖 गणित समाधान बॉट (संशोधित एवं प्रोफेशनल संदेश)\n" +
  "प्रणाम! 🙏\n" +
  "गणित समाधान सहायक (Math Solver Bot) में आपका स्वागत है।\n\n" +
  "✨ संक्षिप्त परिचय\n" +
  "मैं एक उन्नत स्वचालित प्रणाली हूँ, जिसे गणितीय समस्याओं और प्रश्नों को अत्यंत सुगमता से हल करने के लिए विकसित किया गया है।\n\n" +
  "👑 मुख्य निर्माता\n" +
  "मेरा यह स्वरूप परम आदरणीय श्री प्रिंस द्विवेदी जी के कुशल मार्गदर्शन और निर्माण का परिणाम है। उन्होंने मुझे आपकी गणितीय शंकाओं के निवारण के लिए एक डिजिटल शिक्षक के रूप में तैयार किया है।\n\n" +
  "🧮 कार्य एवं क्षमताएं (Capabilities)\n" +
  "प्राथमिक गणित: जोड़, घटाव, गुणा, भाग और संख्या पद्धति।\n" +
  "बीजगणित (Algebra): कठिन समीकरणों और गुणनखंडों का सटीक समाधान।\n" +
  "त्रिकोणमिति एवं ज्यामिति: कोणों, आकृतियों और प्रमेयों पर आधारित गणनाएं।\n" +
  "उच्च गणित (Calculus): अवकलन (Differentiation) और समाकलन (Integration) के प्रश्न।\n\n" +
  "🚀 उपयोग करने की विधि\n" +
  "कृपया अपनी गणितीय समस्या या प्रश्न को नीचे टेक्स्ट (Text) प्रारूप में भेजें। संदेश प्राप्त होते ही मैं आपको उसका चरणबद्ध (Step-by-step) समाधान तुरंत प्रदान करूँगा।\n\n" +
  "\"सत्य और शुद्धता गणित की आत्मा है।\"\n" +
  "आपकी बौद्धिक सहायता के लिए सदैव उपलब्ध।";

var DEFAULT_EXCEED_HI = "❌ Aapki free limit khatm ho gayi hai. Kripya thodi der baad phir try karo.";
var DEFAULT_EXCEED_EN = "❌ You have used up your free limit. Please try again later.";

var DEFAULT_UNLIMITED_CONFIRM_HI = "🎉 Badhai ho! Admin ne aapko unlimited access de diya hai. Ab aap bina kisi limit ke jitne chahe sawal pooch sakte hain.";
var DEFAULT_UNLIMITED_CONFIRM_EN = "🎉 Congratulations! The admin has granted you unlimited access. You can now ask as many questions as you like, with no limit.";

var DEFAULT_CUSTOM_CONFIRM_HI = "🎁 Admin ne aapko ek special limit diya hai!\nHar {interval} me {limit} messages milenge.\nYe suvidha {duration} tak valid hai.";
var DEFAULT_CUSTOM_CONFIRM_EN = "🎁 The admin has granted you a special limit!\nYou get {limit} messages every {interval}.\nThis is valid for {duration}.";

var DEFAULT_FREEPLAN_CONFIRM_HI = "🎉 Badhai ho! Admin ne aapko '{plan}' plan bilkul FREE me activate kar diya hai.\nHar din {limit} sawal milenge.\nYe plan {duration} din tak valid hai.";
var DEFAULT_FREEPLAN_CONFIRM_EN = "🎉 Congratulations! The admin has activated the '{plan}' plan for you completely FREE.\nYou get {limit} questions every day.\nThis plan is valid for {duration} day(s).";

// Image-sawal hatane ke baad, photo bhejne par ye message jaata hai (user ki language me).
var IMAGE_REMOVED_MSG_HI = "कृपया सवाल को टेक्स्ट रूप में लिखकर भेजिए, मेरे पास इमेज पढ़ने का टूल नहीं है।";
var IMAGE_REMOVED_MSG_EN = "Please send your question as text — I don't have a tool to read images.";

// ================= SUBJECTS (Math + optional Science/English/Hindi/SST) =================
var SUBJECT_CONFIG = {
  math: { labelHi: "गणित (Math)", labelEn: "Math" },
  science: { labelHi: "विज्ञान (Science)", labelEn: "Science" },
  english: { labelHi: "अंग्रेज़ी (English)", labelEn: "English" },
  hindi: { labelHi: "हिंदी (Hindi)", labelEn: "Hindi" },
  sst: { labelHi: "सामाजिक विज्ञान (SST)", labelEn: "SST (Social Science)" }
};
var TOGGLEABLE_SUBJECTS = ["science", "english", "hindi", "sst"];

function isAdmin(chatId) { return String(chatId) === ADMIN_ID; }

// Mobile keyboards curly quotes bhej dete hain — seedhe quote me normalize karke compare karte hain.
function normalizeAdminPasswordInput(text) {
  return String(text || "")
    .trim()
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, "\"")
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
}

// ================= TELEGRAM HELPERS =================
function telegramApi(method) {
  return "https://api.telegram.org/bot" + BOT_TOKEN + "/" + method;
}

async function sendRaw(method, payload) {
  const res = await fetch(telegramApi(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res;
}
async function sendMessage(chatId, text) { await sendRaw("sendMessage", { chat_id: chatId, text: text }); }
async function answerCallbackQuery(id) { await sendRaw("answerCallbackQuery", { callback_query_id: id }); }
async function showTyping(chatId) { await sendRaw("sendChatAction", { chat_id: chatId, action: "typing" }); }

async function sendMessageChunked(chatId, text) {
  const maxLen = 3900;
  if (text.length <= maxLen) { await sendMessage(chatId, text); return; }
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { await sendMessage(chatId, remaining); break; }
    let chunk = remaining.substring(0, maxLen);
    let splitAt = chunk.lastIndexOf("\n\n");
    if (splitAt < maxLen * 0.5) splitAt = chunk.lastIndexOf("\n");
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    await sendMessage(chatId, remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).replace(/^\n+/, "");
  }
}

function fmtDateTime(ms) {
  if (!ms) return "-";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return pad(d.getUTCDate()) + "-" + pad(d.getUTCMonth() + 1) + "-" + d.getUTCFullYear() + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
}

// ================= SETTINGS (D1) =================
async function getSetting(env, key, defaultValue) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  if (!row || row.value === null || row.value === "") return defaultValue;
  return row.value;
}
async function setSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(key, String(value)).run();
}

// ================= USERS (D1) =================
async function getUserRow(env, chatId) {
  return await env.DB.prepare("SELECT * FROM users WHERE chat_id = ?").bind(String(chatId)).first();
}

async function upsertUser(env, chatId, username, firstName) {
  const existing = await getUserRow(env, chatId);
  if (!existing) {
    await env.DB.prepare(
      "INSERT INTO users (chat_id, username, first_name) VALUES (?, ?, ?)"
    ).bind(String(chatId), username || "", firstName || "").run();
  } else {
    await env.DB.prepare(
      "UPDATE users SET username = ?, first_name = ? WHERE chat_id = ?"
    ).bind(username || "", firstName || "", String(chatId)).run();
  }
}

async function getUserLang(env, chatId) {
  const row = await getUserRow(env, chatId);
  return row ? (row.lang || "") : "";
}

async function setUserLang(env, chatId, lang) {
  let row = await getUserRow(env, chatId);
  if (!row) { await upsertUser(env, chatId, "", ""); }
  await env.DB.prepare("UPDATE users SET lang = ? WHERE chat_id = ?").bind(lang, String(chatId)).run();
}

async function resolveUserChatId(env, input) {
  if (input.indexOf("@") === 0) {
    const uname = input.substring(1);
    const row = await env.DB.prepare("SELECT chat_id FROM users WHERE username = ?").bind(uname).first();
    return row ? row.chat_id : null;
  }
  const row = await getUserRow(env, input);
  return row ? row.chat_id : null;
}

// ================= LIMIT CHECKING =================
async function checkAndConsumeLimit(env, chatId) {
  let row = await getUserRow(env, chatId);
  if (!row) { await upsertUser(env, chatId, "", ""); row = await getUserRow(env, chatId); }

  if (Number(row.unlimited) === 1) return { allowed: true };

  const now = Date.now();

  // ---- 1. Custom limit (admin-granted, highest priority after unlimited) ----
  const customExpiry = Number(row.custom_expiry) || 0;
  if (customExpiry && now < customExpiry) {
    const customLimit = Number(row.custom_limit) || 0;
    const customIntervalMs = Number(row.custom_interval_ms) || 0;
    let customUsed = Number(row.custom_used_in_interval) || 0;
    let customReset = Number(row.custom_interval_reset_at) || 0;

    if (!customReset || now > customReset) {
      customUsed = 0;
      customReset = now + customIntervalMs;
      await env.DB.prepare("UPDATE users SET custom_interval_reset_at = ? WHERE chat_id = ?").bind(customReset, String(chatId)).run();
    }

    if (customUsed >= customLimit) {
      const langC = (await getUserLang(env, chatId)) || "hi";
      const msgC = langC === "en"
        ? "❌ Your special limit is over for now. It resets at: " + fmtDateTime(customReset)
        : "❌ Aapki special limit abhi khatm hai. Reset hogi: " + fmtDateTime(customReset);
      return { allowed: false, message: msgC };
    }

    await env.DB.prepare("UPDATE users SET custom_used_in_interval = ? WHERE chat_id = ?").bind(customUsed + 1, String(chatId)).run();
    return { allowed: true };
  }

  // ---- 2. Paid plan ----
  const planExpiry = Number(row.plan_expiry) || 0;
  if (planExpiry && now < planExpiry) {
    const planDailyLimit = Number(row.plan_daily_limit) || 0;
    let planUsedToday = Number(row.plan_used_today) || 0;
    let planDayReset = Number(row.plan_day_reset_at) || 0;

    if (!planDayReset || now > planDayReset) {
      planUsedToday = 0;
      planDayReset = now + 86400000;
      await env.DB.prepare("UPDATE users SET plan_day_reset_at = ? WHERE chat_id = ?").bind(planDayReset, String(chatId)).run();
    }

    if (planUsedToday >= planDailyLimit) {
      const lang1 = (await getUserLang(env, chatId)) || "hi";
      const planObj = await findPlanById(env, row.plan_id);
      const baseMsg1 = planObj ? (lang1 === "en" ? planObj.exceed_en : planObj.exceed_hi) : (lang1 === "en" ? DEFAULT_EXCEED_EN : DEFAULT_EXCEED_HI);
      const label1 = lang1 === "en" ? "Your limit will reset at: " : "Aapki limit reset hogi: ";
      return { allowed: false, message: baseMsg1 + "\n\n⏳ " + label1 + fmtDateTime(planDayReset) };
    }

    await env.DB.prepare("UPDATE users SET plan_used_today = ? WHERE chat_id = ?").bind(planUsedToday + 1, String(chatId)).run();
    return { allowed: true };
  }

  // ---- 3. Free limit ----
  const freeLimit = parseInt(await getSetting(env, "free_limit", DEFAULT_FREE_LIMIT), 10);
  const resetMs = parseInt(await getSetting(env, "reset_ms", DEFAULT_RESET_MS), 10);

  let count = Number(row.question_count) || 0;
  let resetAt = Number(row.limit_reset_at) || 0;

  if (!resetAt || now > resetAt) {
    count = 0;
    resetAt = now + resetMs;
    await env.DB.prepare("UPDATE users SET limit_reset_at = ? WHERE chat_id = ?").bind(resetAt, String(chatId)).run();
  }

  if (count >= freeLimit) {
    const lang = (await getUserLang(env, chatId)) || "hi";
    const exceedMsg = lang === "en" ? await getSetting(env, "exceed_en", DEFAULT_EXCEED_EN) : await getSetting(env, "exceed_hi", DEFAULT_EXCEED_HI);
    const label = lang === "en" ? "Your limit will reset at: " : "Aapki limit reset hogi: ";
    return { allowed: false, message: exceedMsg + "\n\n⏳ " + label + fmtDateTime(resetAt), showPlans: true };
  }

  await env.DB.prepare("UPDATE users SET question_count = ? WHERE chat_id = ?").bind(count + 1, String(chatId)).run();
  return { allowed: true };
}

async function grantUnlimited(env, input) {
  const targetChatId = await resolveUserChatId(env, input);
  if (!targetChatId) return { ok: false, message: "❌ User nahi mila. Sahi Chat ID ya @username bhejo." };
  await env.DB.prepare("UPDATE users SET unlimited = 1 WHERE chat_id = ?").bind(String(targetChatId)).run();

  const targetLang = (await getUserLang(env, targetChatId)) || "hi";
  const template = targetLang === "en" ? await getSetting(env, "unlimited_confirm_en", DEFAULT_UNLIMITED_CONFIRM_EN) : await getSetting(env, "unlimited_confirm_hi", DEFAULT_UNLIMITED_CONFIRM_HI);
  await sendMessage(targetChatId, template);

  return { ok: true, message: "✅ Unlimited access de diya gaya (Chat ID: " + targetChatId + "), aur user ko confirmation message bhej diya gaya." };
}

async function cancelUnlimited(env, adminChatId, targetChatId) {
  const row = await getUserRow(env, targetChatId);
  if (!row) { await sendMessage(adminChatId, "❌ User nahi mila."); return; }
  await env.DB.prepare("UPDATE users SET unlimited = 0 WHERE chat_id = ?").bind(String(targetChatId)).run();
  await sendMessage(adminChatId, "✅ Unlimited cancel kar diya gaya (Chat ID: " + targetChatId + ").");
}

async function applyCustomLimit(env, chatIdTarget, limit, intervalMs, durationMs) {
  let row = await getUserRow(env, chatIdTarget);
  if (!row) { await upsertUser(env, chatIdTarget, "", ""); }
  const now = Date.now();
  await env.DB.prepare(
    "UPDATE users SET custom_limit = ?, custom_interval_ms = ?, custom_expiry = ?, custom_used_in_interval = 0, custom_interval_reset_at = ? WHERE chat_id = ?"
  ).bind(limit, intervalMs, now + durationMs, now + intervalMs, String(chatIdTarget)).run();
}

// ================= REMAINING-LIMIT FOOTER =================
async function getRemainingFooter(env, chatId) {
  const row = await getUserRow(env, chatId);
  if (!row) return "";
  const lang = row.lang || "hi";
  if (Number(row.unlimited) === 1) {
    return lang === "en" ? "\n\n♾ You have unlimited questions." : "\n\n♾ Aapke paas unlimited sawal poochhne ki suvidha hai.";
  }
  const now = Date.now();

  const customExpiry = Number(row.custom_expiry) || 0;
  if (customExpiry && now < customExpiry) {
    const cLimit = Number(row.custom_limit) || 0;
    const cUsed = Number(row.custom_used_in_interval) || 0;
    const cReset = Number(row.custom_interval_reset_at) || 0;
    const remainingC = Math.max(cLimit - cUsed, 0);
    return lang === "en"
      ? "\n\n📊 You can ask " + remainingC + " more question(s) (resets at " + fmtDateTime(cReset) + ")."
      : "\n\n📊 Aap " + remainingC + " sawal aur pooch sakte hain (reset hogi " + fmtDateTime(cReset) + " par).";
  }

  const planExpiry = Number(row.plan_expiry) || 0;
  if (planExpiry && now < planExpiry) {
    const pLimit = Number(row.plan_daily_limit) || 0;
    const pUsed = Number(row.plan_used_today) || 0;
    const pReset = Number(row.plan_day_reset_at) || 0;
    const remainingP = Math.max(pLimit - pUsed, 0);
    return lang === "en"
      ? "\n\n📊 You can ask " + remainingP + " more question(s) (resets at " + fmtDateTime(pReset) + ")."
      : "\n\n📊 Aap " + remainingP + " sawal aur pooch sakte hain (reset hogi " + fmtDateTime(pReset) + " par).";
  }

  const freeLimit = parseInt(await getSetting(env, "free_limit", DEFAULT_FREE_LIMIT), 10);
  const fUsed = Number(row.question_count) || 0;
  const fReset = Number(row.limit_reset_at) || 0;
  const remainingF = Math.max(freeLimit - fUsed, 0);
  return lang === "en"
    ? "\n\n📊 You can ask " + remainingF + " more question(s) (resets at " + fmtDateTime(fReset) + ")."
    : "\n\n📊 Aap " + remainingF + " sawal aur pooch sakte hain (reset hogi " + fmtDateTime(fReset) + " par).";
}

// ================= SOLVE + REPLY =================
async function solveAndReply(env, chatId, questionText, lang, subject) {
  subject = subject || "math";
  const limitCheck = await checkAndConsumeLimit(env, chatId);
  if (!limitCheck.allowed) {
    if (limitCheck.showPlans) await sendLimitExceededWithPlans(env, chatId, limitCheck.message);
    else await sendMessage(chatId, limitCheck.message);
    return;
  }
  await showTyping(chatId);
  const answer = await solveMath(env, questionText, lang, subject);
  const footer = await getRemainingFooter(env, chatId);
  await sendMessageChunked(chatId, answer + footer);
  await logMessage(env, chatId, questionText, answer);
}

// ================= SUBJECT DISPATCH (text questions) =================
async function handleTextQuestion(env, chatId, text, lang) {
  const subject = (await anyToggleableSubjectEnabled(env)) ? await classifyQuestionSubject(env, text) : "math";

  if (subject === "math" || subject === "other") {
    await solveAndReply(env, chatId, text, lang, "math");
    return;
  }

  if (!(await isSubjectGloballyEnabled(env, subject))) {
    await sendMessage(chatId, subjectNotAvailableMessage(subject, lang));
    return;
  }

  if (!(await userHasSubjectAccess(env, chatId, subject))) {
    await sendMessage(chatId, subjectNotInPlanMessage(subject, lang));
    return;
  }

  await solveAndReply(env, chatId, text, lang, subject);
}

async function isSubjectGloballyEnabled(env, subject) {
  if (subject === "math") return true;
  return String(await getSetting(env, "subject_" + subject + "_enabled", "FALSE")).toUpperCase() === "TRUE";
}

async function anyToggleableSubjectEnabled(env) {
  for (const s of TOGGLEABLE_SUBJECTS) {
    if (await isSubjectGloballyEnabled(env, s)) return true;
  }
  return false;
}

async function userHasSubjectAccess(env, chatId, subject) {
  if (subject === "math") return true;
  const row = await getUserRow(env, chatId);
  if (!row) return true; // naya user, koi plan nahi — sirf global toggle lagu hota hai

  const now = Date.now();
  const planExpiry = Number(row.plan_expiry) || 0;

  if (planExpiry && now < planExpiry) {
    const plan = await findPlanById(env, row.plan_id);
    if (!plan) return false;
    const subjectsList = String(plan.subjects || "math").split(",").map((s) => s.trim().toLowerCase());
    return subjectsList.indexOf(subject) !== -1;
  }

  return true; // Free / Unlimited / Custom-limit user — sirf global toggle lagu hai
}

function subjectNotAvailableMessage(subject, lang) {
  const cfg = SUBJECT_CONFIG[subject];
  const label = cfg ? (lang === "en" ? cfg.labelEn : cfg.labelHi) : subject;
  return lang === "en"
    ? "❌ " + label + " questions are not available right now. Please ask a Math question."
    : "❌ Abhi " + label + " ke sawal available nahi hain. Kripya Math ka sawal poochhiye.";
}

function subjectNotInPlanMessage(subject, lang) {
  const cfg = SUBJECT_CONFIG[subject];
  const label = cfg ? (lang === "en" ? cfg.labelEn : cfg.labelHi) : subject;
  return lang === "en"
    ? "❌ Your current plan does not include " + label + " questions. Please check /plans or contact admin."
    : "❌ Aapke current plan mein " + label + " ke sawal include nahi hain. Kripya /plans dekho ya admin se contact karo.";
}

// ================= IMAGE HANDLING (REMOVED — sirf text-only reply) =================
async function handleIncomingPhoto(chatId, lang) {
  await sendMessage(chatId, lang === "en" ? IMAGE_REMOVED_MSG_EN : IMAGE_REMOVED_MSG_HI);
}

// ================= SUBJECT CLASSIFICATION (text questions) =================
async function classifyQuestionSubject(env, text) {
  const instruction =
    "Classify which ONE school subject the following student question belongs to. " +
    "Respond with ONLY a raw JSON object, no markdown, no code fences, no extra text, in exactly this shape: " +
    "{\"subject\":\"math\"} — the value must be one of: \"math\", \"science\", \"english\", \"hindi\", \"sst\", \"other\". " +
    "Definitions: math = arithmetic/algebra/geometry/trigonometry/calculus questions. " +
    "science = physics/chemistry/biology questions. " +
    "english = English grammar, vocabulary, comprehension, or essay/letter writing questions. " +
    "hindi = Hindi grammar (vyakaran), comprehension, or essay/letter writing questions (in Hindi). " +
    "sst = Social Science: history, geography, civics, political science, or economics questions. " +
    "other = anything that does not clearly fit one of the above (greetings, random text, non-academic chat, etc). " +
    "If the question could fit more than one subject, pick the single best match.\n\n" +
    "QUESTION:\n" + text;

  try {
    const payload = { contents: [{ parts: [{ text: instruction }] }] };
    const data = await callGemini(env, payload);
    let raw = data.candidates[0].content.parts[0].text;
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(raw);
    const subj = String(parsed.subject || "other").toLowerCase();
    if (["math", "science", "english", "hindi", "sst"].indexOf(subj) === -1) return "other";
    return subj;
  } catch (err) {
    console.log("classifyQuestionSubject error: " + err);
    return "math"; // safe fallback
  }
}

// ================= PLANS =================
async function findPlanById(env, planId) {
  if (!planId) return null;
  return await env.DB.prepare("SELECT * FROM plans WHERE plan_id = ?").bind(String(planId)).first();
}

async function deletePlan(env, planId) {
  await env.DB.prepare("DELETE FROM plans WHERE plan_id = ?").bind(String(planId)).run();
}

async function showDeletePlanList(env, chatId) {
  const { results } = await env.DB.prepare("SELECT * FROM plans").all();
  if (!results || results.length === 0) { await sendMessage(chatId, "Koi plan nahi bana hua hai."); return; }
  const buttons = results.map((p) => [{ text: "🗑 " + p.name + " (" + p.price_stars + "⭐)", callback_data: "adm_delplanid_" + p.plan_id }]);
  await sendRaw("sendMessage", { chat_id: chatId, text: "Delete karne ke liye plan chuno:", reply_markup: { inline_keyboard: buttons } });
}

async function showAdminPlansList(env, chatId) {
  const { results } = await env.DB.prepare("SELECT * FROM plans").all();
  if (!results || results.length === 0) { await sendMessage(chatId, "Koi plan nahi bana hua hai."); return; }
  let text = "📋 All Plans:\n\n";
  results.forEach((p, i) => {
    text += (i + 1) + ". " + p.name + " — " + p.price_stars + "⭐ — " + p.daily_limit + " Q/day — " + p.validity_days + " din — Active: " + (Number(p.active) ? "TRUE" : "FALSE") +
      " — Subjects: " + (p.subjects || "math") + "\n";
  });
  await sendMessage(chatId, text);
}

async function sendPlansToUser(env, chatId) {
  const { results } = await env.DB.prepare("SELECT * FROM plans WHERE active = 1").all();
  const lang = (await getUserLang(env, chatId)) || "hi";
  if (!results || results.length === 0) {
    await sendMessage(chatId, lang === "en" ? "No plans available right now." : "Abhi koi plan available nahi hai.");
    return;
  }
  const buttons = results.map((p) => {
    const subjLabel = String(p.subjects || "math").split(",").join(" + ");
    const label = p.name + " — " + p.price_stars + "⭐ (" + p.daily_limit + " Q/din, " + p.validity_days + " din) [" + subjLabel + "]";
    return [{ text: label, callback_data: "buy_plan_" + p.plan_id }];
  });
  await sendRaw("sendMessage", { chat_id: chatId, text: "💳 Available Plans:", reply_markup: { inline_keyboard: buttons } });
}

async function sendLimitExceededWithPlans(env, chatId, message) {
  const { results } = await env.DB.prepare("SELECT plan_id FROM plans WHERE active = 1 LIMIT 1").all();
  if (!results || results.length === 0) { await sendMessage(chatId, message); return; }
  const lang = (await getUserLang(env, chatId)) || "hi";
  await sendRaw("sendMessage", {
    chat_id: chatId, text: message,
    reply_markup: { inline_keyboard: [[{ text: lang === "en" ? "💳 View Plans" : "💳 Plans Dekho", callback_data: "show_plans" }]] }
  });
}

// ================= TELEGRAM STARS PAYMENT =================
async function handlePreCheckout(env, pcq) {
  const planId = pcq.invoice_payload.replace("plan_", "");
  const plan = await findPlanById(env, planId);
  if (plan && Number(plan.active) === 1) {
    await sendRaw("answerPreCheckoutQuery", { pre_checkout_query_id: pcq.id, ok: true });
  } else {
    await sendRaw("answerPreCheckoutQuery", { pre_checkout_query_id: pcq.id, ok: false, error_message: "Ye plan ab available nahi hai." });
  }
}

async function handleSuccessfulPayment(env, chatId, payment) {
  const planId = payment.invoice_payload.replace("plan_", "");
  const plan = await findPlanById(env, planId);
  if (!plan) { await sendMessage(chatId, "Payment mil gaya lekin plan nahi mila, admin se contact karo."); return; }

  let row = await getUserRow(env, chatId);
  if (!row) { await upsertUser(env, chatId, "", ""); }

  const now = Date.now();
  const expiry = now + (plan.validity_days * 86400000);
  await env.DB.prepare(
    "UPDATE users SET plan_id = ?, plan_expiry = ?, plan_daily_limit = ?, plan_used_today = 0, plan_day_reset_at = ? WHERE chat_id = ?"
  ).bind(planId, expiry, plan.daily_limit, now + 86400000, String(chatId)).run();

  const lang = (await getUserLang(env, chatId)) || "hi";
  await sendMessage(chatId, lang === "en"
    ? "✅ Payment successful! Plan '" + plan.name + "' activated: " + plan.daily_limit + " questions/day for " + plan.validity_days + " day(s)."
    : "✅ Payment safal raha! Plan '" + plan.name + "' activate ho gaya: " + plan.daily_limit + " sawal/din, " + plan.validity_days + " din tak.");
}

// ================= FREE PLAN ACTIVATION (Admin) =================
async function showFreePlanList(env, chatId) {
  const { results } = await env.DB.prepare("SELECT * FROM plans").all();
  if (!results || results.length === 0) { await sendMessage(chatId, "Koi plan nahi bana hua hai. Pehle 📦 Manage Plans se ek plan banao."); return; }
  const buttons = results.map((p) => [{ text: "🆓 " + p.name + " (" + p.price_stars + "⭐)", callback_data: "adm_freeplanid_" + p.plan_id }]);
  await sendRaw("sendMessage", { chat_id: chatId, text: "Kis plan ko kisi user ke liye FREE me activate karna hai, chuno:", reply_markup: { inline_keyboard: buttons } });
}

async function activateFreePlanForUser(env, adminChatId, targetChatId, planId) {
  const plan = await findPlanById(env, planId);
  if (!plan) { await sendMessage(adminChatId, "❌ Ye plan ab maujood nahi hai."); return; }

  let row = await getUserRow(env, targetChatId);
  if (!row) { await upsertUser(env, targetChatId, "", ""); }

  const now = Date.now();
  const expiry = now + (plan.validity_days * 86400000);
  await env.DB.prepare(
    "UPDATE users SET plan_id = ?, plan_expiry = ?, plan_daily_limit = ?, plan_used_today = 0, plan_day_reset_at = ? WHERE chat_id = ?"
  ).bind(planId, expiry, plan.daily_limit, now + 86400000, String(targetChatId)).run();

  await sendMessage(adminChatId, "✅ Plan '" + plan.name + "' FREE me activate kar diya gaya (Chat ID: " + targetChatId + "), aur user ko confirmation message bhej diya gaya.");

  const targetLang = (await getUserLang(env, targetChatId)) || "hi";
  const template = targetLang === "en" ? await getSetting(env, "freeplan_confirm_en", DEFAULT_FREEPLAN_CONFIRM_EN) : await getSetting(env, "freeplan_confirm_hi", DEFAULT_FREEPLAN_CONFIRM_HI);
  const finalMsg = String(template)
    .replace(/{plan}/g, plan.name)
    .replace(/{limit}/g, plan.daily_limit)
    .replace(/{duration}/g, plan.validity_days);
  await sendMessage(targetChatId, finalMsg);
}

// ================= MESSAGE LOG =================
async function logMessage(env, chatId, userMsg, botReply) {
  await env.DB.prepare(
    "INSERT INTO messages (chat_id, ts, user_message, bot_reply) VALUES (?, ?, ?, ?)"
  ).bind(String(chatId), Date.now(), userMsg, botReply).run();
}

// ================= ADMIN VIEWS =================
async function showUsersList(env, chatId) {
  const { results } = await env.DB.prepare("SELECT chat_id, username, first_name FROM users LIMIT 50").all();
  if (!results || results.length === 0) { await sendMessage(chatId, "Abhi tak koi user nahi hai."); return; }
  const buttons = results.map((u) => {
    const label = u.username ? "@" + u.username : (u.first_name || ("ID:" + u.chat_id));
    return [{ text: label, callback_data: "adm_user_" + u.chat_id }];
  });
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first();
  await sendRaw("sendMessage", { chat_id: chatId, text: "👥 Total Users: " + countRow.c + "\n\nDetail dekhne ke liye click karo:", reply_markup: { inline_keyboard: buttons } });
}

async function showUnlimitedList(env, chatId) {
  const { results } = await env.DB.prepare("SELECT chat_id, username, first_name FROM users WHERE unlimited = 1").all();
  if (!results || results.length === 0) { await sendMessage(chatId, "Abhi koi unlimited user nahi hai."); return; }
  const buttons = results.map((u) => {
    const label = u.username ? "@" + u.username : (u.first_name || ("ID:" + u.chat_id));
    return [{ text: "❌ Cancel: " + label, callback_data: "adm_cancelunlimited_" + u.chat_id }];
  });
  await sendRaw("sendMessage", { chat_id: chatId, text: "♾ Unlimited Users (" + buttons.length + ")\n\nCancel karne ke liye click karo:", reply_markup: { inline_keyboard: buttons } });
}

async function showUserDetail(env, chatId, targetChatId) {
  const u = await getUserRow(env, targetChatId);
  if (!u) { await sendMessage(chatId, "User nahi mila."); return; }
  const uPlan = u.plan_id ? await findPlanById(env, u.plan_id) : null;
  const uPlanSubjects = uPlan ? (uPlan.subjects || "math") : "-";

  let info = "👤 User Detail\n" +
    "Chat ID: " + u.chat_id + "\nUsername: " + (u.username ? "@" + u.username : "-") + "\nName: " + (u.first_name || "-") +
    "\nLanguage: " + (u.lang || "-") + "\nFree Q used: " + u.question_count + "\nFree limit resets: " + fmtDateTime(u.limit_reset_at) +
    "\nUnlimited: " + (Number(u.unlimited) ? "TRUE" : "FALSE") +
    "\n\n📦 Plan: " + (u.plan_id || "-") + "\nPlan expiry: " + fmtDateTime(u.plan_expiry) +
    "\nPlan daily Q limit: " + (u.plan_daily_limit || "-") + "\nPlan Q used today: " + (u.plan_used_today || 0) +
    "\nPlan subjects: " + uPlanSubjects +
    "\n\n🎁 Custom limit: " + (u.custom_limit || "-") + " messages\nCustom expiry: " + fmtDateTime(u.custom_expiry) +
    "\nCustom used (this interval): " + (u.custom_used_in_interval || 0) +
    "\n\n📝 Pichhle 4 dino ke messages:\n";

  const cutoffTime = Date.now() - (4 * 86400000);
  const { results: userMsgs } = await env.DB.prepare(
    "SELECT * FROM messages WHERE chat_id = ? AND ts >= ? ORDER BY ts ASC"
  ).bind(String(targetChatId), cutoffTime).all();

  if (!userMsgs || userMsgs.length === 0) info += "(pichhle 4 dino me is user ka koi message nahi mila)";
  else userMsgs.forEach((r) => {
    info += "\n🕒 " + fmtDateTime(r.ts) + "\n➡️ Q: " + r.user_message + "\n✅ A: " + String(r.bot_reply).substring(0, 200) + "\n";
  });

  await sendMessageChunked(chatId, info);
}

// ================= SUBJECTS MENU (admin panel) =================
async function sendSubjectsMenu(env, chatId) {
  const sciOn = String(await getSetting(env, "subject_science_enabled", "FALSE")).toUpperCase() === "TRUE";
  const engOn = String(await getSetting(env, "subject_english_enabled", "FALSE")).toUpperCase() === "TRUE";
  const hinOn = String(await getSetting(env, "subject_hindi_enabled", "FALSE")).toUpperCase() === "TRUE";
  const sstOn = String(await getSetting(env, "subject_sst_enabled", "FALSE")).toUpperCase() === "TRUE";
  const text = "📚 Subjects Availability\n\n🧮 Math: ✅ ON (hamesha required, band nahi ho sakta)\n\n" +
    "Neeche click karke baaki subjects globally ON/OFF karo. Jo subject OFF hoga, uska sawal koi bhi user (kisi bhi plan me) nahi poochh payega.";
  await sendRaw("sendMessage", { chat_id: chatId, text: text, reply_markup: { inline_keyboard: [
    [{ text: "🔬 Science: " + (sciOn ? "✅ ON" : "❌ OFF"), callback_data: "adm_subj_toggle_science" }],
    [{ text: "🔤 English: " + (engOn ? "✅ ON" : "❌ OFF"), callback_data: "adm_subj_toggle_english" }],
    [{ text: "📖 Hindi: " + (hinOn ? "✅ ON" : "❌ OFF"), callback_data: "adm_subj_toggle_hindi" }],
    [{ text: "🏛 SST: " + (sstOn ? "✅ ON" : "❌ OFF"), callback_data: "adm_subj_toggle_sst" }]
  ] } });
}

async function sendPlanSubjectsPrompt(env, chatId) {
  const pb = await getBuilderState(env, "planbuilder_" + chatId);
  const s = (pb && pb.subjects) || { science: false, english: false, hindi: false, sst: false };
  const text = "📚 Is Plan Ke Liye Subjects Chuno\n\n🧮 Math: ✅ (hamesha included, required)\n\n" +
    "Baaki subjects is plan ke liye ON/OFF karne ke liye click karo, phir neeche 'Plan Create Karo' dabao:";
  await sendRaw("sendMessage", { chat_id: chatId, text: text, reply_markup: { inline_keyboard: [
    [{ text: "🔬 Science: " + (s.science ? "✅ ON" : "❌ OFF"), callback_data: "adm_plansubj_toggle_science" }],
    [{ text: "🔤 English: " + (s.english ? "✅ ON" : "❌ OFF"), callback_data: "adm_plansubj_toggle_english" }],
    [{ text: "📖 Hindi: " + (s.hindi ? "✅ ON" : "❌ OFF"), callback_data: "adm_plansubj_toggle_hindi" }],
    [{ text: "🏛 SST: " + (s.sst ? "✅ ON" : "❌ OFF"), callback_data: "adm_plansubj_toggle_sst" }],
    [{ text: "✅ Plan Create Karo (Finish)", callback_data: "adm_plansubj_done" }]
  ] } });
}

async function showCurrentSettings(env, chatId) {
  const apiKey = String(await getSetting(env, "gemini_api_key", GEMINI_API_KEY));
  const maskedKey = apiKey.length > 8 ? (apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4)) : apiKey;
  const adEnabledS = String(await getSetting(env, "autodelete_enabled", "FALSE")).toUpperCase() === "TRUE";
  const adLabelS = await getSetting(env, "autodelete_label", "-");
  let subjStatus = "Math ✅";
  for (const sk of TOGGLEABLE_SUBJECTS) {
    const skOn = String(await getSetting(env, "subject_" + sk + "_enabled", "FALSE")).toUpperCase() === "TRUE";
    subjStatus += ", " + SUBJECT_CONFIG[sk].labelEn + " " + (skOn ? "✅" : "❌");
  }
  const text = "⚙️ Current Settings\n\nModel: " + (await getSetting(env, "model", DEFAULT_MODEL)) +
    "\nGemini API Key: " + maskedKey +
    "\nFree question limit: " + (await getSetting(env, "free_limit", DEFAULT_FREE_LIMIT)) +
    "\nReset duration: " + (await getSetting(env, "reset_label", DEFAULT_RESET_LABEL)) +
    "\nAuto-delete old chats: " + (adEnabledS ? ("✅ ON (" + adLabelS + ")") : "❌ OFF") +
    "\nSubjects: " + subjStatus;
  await sendMessage(chatId, text);
}

// ================= ADMIN SESSION STATE (KV) =================
async function setAdminState(env, chatId, state) { await env.BOT_KV.put("adminstate_" + chatId, state); }
async function getAdminState(env, chatId) { return await env.BOT_KV.get("adminstate_" + chatId); }
async function clearAdminState(env, chatId) { await env.BOT_KV.delete("adminstate_" + chatId); }

async function getBuilderState(env, key) {
  const raw = await env.BOT_KV.get(key);
  return raw ? JSON.parse(raw) : null;
}
async function setBuilderState(env, key, obj) { await env.BOT_KV.put(key, JSON.stringify(obj)); }
async function clearBuilderState(env, key) { await env.BOT_KV.delete(key); }

// ================= WELCOME =================
async function sendWelcomeWithOptions(env, chatId) {
  const welcome = await getSetting(env, "welcome_hi", DEFAULT_WELCOME_HI);
  await sendRaw("sendMessage", { chat_id: chatId, text: welcome,
    reply_markup: { inline_keyboard: [[{ text: "🇮🇳 हिंदी", callback_data: "lang_hi" }, { text: "🇬🇧 English", callback_data: "lang_en" }]] } });
}

// ================= GEMINI (TEXT SOLVING) =================
async function buildGeminiUrl(env) {
  const model = await getSetting(env, "model", DEFAULT_MODEL);
  const apiKey = await getSetting(env, "gemini_api_key", GEMINI_API_KEY);
  return "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
}

// Naye ("AQ....") aur purane ("AIzaSy...") dono API-key formats ke saath kaam
// kare, isliye key URL me bhi aur "x-goog-api-key" header me bhi bheji jaati hai.
async function callGemini(env, payload) {
  const apiKey = await getSetting(env, "gemini_api_key", GEMINI_API_KEY);
  const url = await buildGeminiUrl(env);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

function getSystemInstruction(lang, subject) {
  subject = subject || "math";

  if (subject === "science") {
    return lang === "en"
      ? "You are a professional Science tutor (physics, chemistry and biology), explaining exactly the way the best AI science tutors do. " +
        "When the user asks a valid science question, explain the underlying concept and answer clearly, step by step, using correct scientific terms, units and formulas where relevant, " +
        "and write the final answer on its own separate line starting with 'Answer:'. " +
        "Always reply strictly in English, never in any other language or script. " +
        "If the input is meaningless text, random words, or anything that is not genuinely a science question, " +
        "do NOT attempt to solve or interpret it — politely reply that you only answer science questions."
      : "Tum ek professional Science tutor ho (physics, chemistry aur biology), bilkul waise jaise behtareen AI science tutors sawalon ko samjhate hain. " +
        "Jab user koi valid science sawal poochhe, uske underlying concept ko aur answer ko clearly, step-by-step, sahi scientific terms, units aur formulas ke saath samjhao, " +
        "aur final answer ek alag line par 'Answer:' likh kar do. " +
        "Hamesha sirf Hindi (Devanagari script) me hi jawab do, kabhi doosri bhasha ya script use mat karo. " +
        "Agar input bekar/random shabd ho, ya kisi bhi tarah se genuinely science ka sawal na ho, " +
        "to use solve karne ya samajhne ki koshish bilkul mat karo — sirf politely bolo ki tum sirf science ke sawal solve karte ho.";
  }

  if (subject === "english") {
    return lang === "en"
      ? "You are a professional English language tutor, explaining exactly the way the best AI English tutors do. " +
        "When the user asks a valid English question (grammar, vocabulary, comprehension, essay or letter writing, etc.), explain and answer it clearly, step by step, " +
        "with correct grammar and examples where helpful, and write the final answer on its own separate line starting with 'Answer:'. " +
        "Always reply strictly in English, never in any other language or script. " +
        "If the input is meaningless text, random words, or anything that is not genuinely an English-subject question, " +
        "do NOT attempt to answer it — politely reply that you only answer English-subject questions."
      : "Tum ek professional English subject tutor ho jo Hindi-speaking students ko English grammar, vocabulary, comprehension aur writing sikhata hai, " +
        "bilkul waise jaise behtareen AI tutors sikhate hain. Jab user koi valid English subject ka sawal poochhe, uska explanation Hindi mein do (samjhane ke liye), " +
        "lekin English ke examples/sentences English mein hi rakho jahan zaroori ho, aur final answer ek alag line par 'Answer:' likh kar do. " +
        "Agar input bekar/random shabd ho, ya kisi bhi tarah se genuinely English subject ka sawal na ho, " +
        "to use solve karne ya samajhne ki koshish bilkul mat karo — sirf politely bolo ki tum sirf English subject ke sawal solve karte ho.";
  }

  if (subject === "hindi") {
    return lang === "en"
      ? "You are a professional Hindi-subject tutor (Hindi grammar/vyakaran, comprehension, and writing), explaining exactly the way the best AI tutors do. " +
        "Since this is the Hindi subject, always give the full explanation and content in the Hindi language (Devanagari script), even though the user's app language is English — " +
        "use English only for a short clarifying note if truly necessary, and write the final answer on its own separate line starting with 'Answer:'. " +
        "If the input is meaningless text, random words, or anything that is not genuinely a Hindi-subject question, " +
        "do NOT attempt to answer it — politely reply in English that you only answer Hindi-subject questions."
      : "Tum ek professional Hindi subject tutor ho (Hindi vyakaran, comprehension aur lekhan), bilkul waise jaise behtareen AI tutors sawalon ko samjhate hain. " +
        "Jab user koi valid Hindi subject ka sawal poochhe, use clearly, step-by-step, sahi vyakaran ke niyamon ke saath, hamesha shuddh Hindi (Devanagari script) mein samjhao, " +
        "aur final answer ek alag line par 'Answer:' likh kar do. " +
        "Agar input bekar/random shabd ho, ya kisi bhi tarah se genuinely Hindi subject ka sawal na ho, " +
        "to use solve karne ya samajhne ki koshish bilkul mat karo — sirf politely bolo ki tum sirf Hindi subject ke sawal solve karte ho.";
  }

  if (subject === "sst") {
    return lang === "en"
      ? "You are a professional Social Science (History, Geography, Civics, Political Science, Economics) tutor, explaining exactly the way the best AI tutors do. " +
        "When the user asks a valid SST question, explain and answer it clearly, step by step, with correct facts, dates and terms, " +
        "and write the final answer on its own separate line starting with 'Answer:'. " +
        "Always reply strictly in English, never in any other language or script. " +
        "If the input is meaningless text, random words, or anything that is not genuinely an SST question, " +
        "do NOT attempt to answer it — politely reply that you only answer SST (Social Science) questions."
      : "Tum ek professional Social Science (SST — Itihaas, Bhoogol, Nagrik Shastra, Rajniti Vigyan, Arthashastra) tutor ho, bilkul waise jaise behtareen AI tutors sawalon ko samjhate hain. " +
        "Jab user koi valid SST sawal poochhe, use clearly, step-by-step, sahi facts, tareekhon aur terms ke saath samjhao, " +
        "aur final answer ek alag line par 'Answer:' likh kar do. " +
        "Hamesha sirf Hindi (Devanagari script) mein hi jawab do. " +
        "Agar input bekar/random shabd ho, ya kisi bhi tarah se genuinely SST ka sawal na ho, " +
        "to use solve karne ya samajhne ki koshish bilkul mat karo — sirf politely bolo ki tum sirf SST (Social Science) ke sawal solve karte ho.";
  }

  // ---- Default / Math ----
  if (lang === "en") {
    return "You are a professional math solver assistant, explaining exactly the way the best AI math tutors do. " +
      "When the user asks a valid math question, solve it clearly, step by step, using correct mathematical notation and order, " +
      "and write the final answer on its own separate line starting with 'Answer:'. " +
      "Always reply strictly in English, never in any other language or script. " +
      "Always write numbers using digits (0-9), never spell them out as words. " +
      "If the input is meaningless text, random words, or anything that is not genuinely a math question, " +
      "do NOT attempt to solve or interpret it — politely reply that you only solve math questions.";
  }
  return "Tum ek professional math solver assistant ho, bilkul waise jaise behtareen AI math tutors sawalon ko samjhate hain. " +
    "Jab user koi valid math sawal poochhe, use clearly, step-by-step, sahi mathematical notation aur tarteeb ke saath hal karo, " +
    "aur final answer ek alag line par 'Answer:' likh kar do. " +
    "Hamesha sirf Hindi (Devanagari script) me hi jawab do, kabhi doosri bhasha ya script use mat karo. " +
    "Numbers hamesha ankon (digits: 0-9) me hi likho, kabhi shabdon me spell mat karo. " +
    "Agar input bekar/random shabd ho, ya kisi bhi tarah se genuinely math ka sawal na ho, " +
    "to use solve karne ya samajhne ki koshish bilkul mat karo — sirf politely bolo ki tum sirf math ke sawal solve karte ho.";
}

async function solveMath(env, question, lang, subject) {
  subject = subject || "math";
  try {
    const payload = { system_instruction: { parts: [{ text: getSystemInstruction(lang, subject) }] }, contents: [{ parts: [{ text: question }] }] };
    const data = await callGemini(env, payload);
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text;
    }
    console.log("Gemini response issue: " + JSON.stringify(data));
    return lang === "en" ? "Sorry, I could not answer this question." : "Maaf kijiye, main is sawal ka jawab nahi de paya.";
  } catch (err) {
    console.log("Gemini API error: " + err);
    return lang === "en" ? "There was a technical issue, please try again later." : "Kuch technical dikkat aa gayi hai, thodi der baad phir try karo.";
  }
}

function parseDuration(text) {
  const m = text.trim().toLowerCase().match(/^(\d+)\s*([a-z]+)/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  const unit = m[2];
  if (/^(sec|second|seconds)$/.test(unit)) return { ms: num * 1000, label: num + " second(s)" };
  if (/^(min|minute|minutes)$/.test(unit)) return { ms: num * 60000, label: num + " minute(s)" };
  if (/^(hour|hours|ghanta|ghante)$/.test(unit)) return { ms: num * 3600000, label: num + " hour(s)" };
  if (/^(day|days|din|dinon)$/.test(unit)) return { ms: num * 86400000, label: num + " day(s)" };
  if (/^(week|weeks|hafta|haftey)$/.test(unit)) return { ms: num * 604800000, label: num + " week(s)" };
  if (/^(year|years|saal|varsh)$/.test(unit)) return { ms: num * 365 * 86400000, label: num + " year(s)" };
  return null;
}

// ================= AUTO-DELETE OLD MESSAGES (Cron trigger, har 1 minute) =================
async function autoDeleteOldMessages(env) {
  try {
    const enabled = String(await getSetting(env, "autodelete_enabled", "FALSE")).toUpperCase() === "TRUE";
    if (!enabled) return;
    const ms = parseInt(await getSetting(env, "autodelete_ms", "0"), 10);
    if (!ms || ms <= 0) return;
    const cutoff = Date.now() - ms;
    await env.DB.prepare("DELETE FROM messages WHERE ts < ?").bind(cutoff).run();
  } catch (err) {
    console.log("autoDeleteOldMessages error: " + err);
  }
}

function ensureAutoDeleteTrigger() {
  // Cloudflare Workers me cron trigger wrangler.toml ke [triggers] block se
  // configure hota hai (har 1 minute par pehle se chal raha hai) — Apps
  // Script ki tarah runtime me alag se trigger banane ki zaroorat nahi hai.
}

// ================= ADMIN MENU =================
async function sendAdminMenu(chatId) {
  await sendRaw("sendMessage", {
    chat_id: chatId,
    text: "🔐 Admin Panel\n\nEk option chuno:",
    reply_markup: { inline_keyboard: [
      [{ text: "👥 Users List", callback_data: "adm_users" }],
      [{ text: "♾ Unlimited Users List", callback_data: "adm_unlimited_list" }],
      [{ text: "🎁 Custom Limit for User", callback_data: "adm_customlimit" }],
      [{ text: "🆓 Free Plan Activation", callback_data: "adm_freeplan_menu" }],
      [{ text: "📦 Manage Plans", callback_data: "adm_plans_menu" }],
      [{ text: "✏️ Welcome Message", callback_data: "adm_welcome_menu" }],
      [{ text: "🤖 Gemini Model", callback_data: "adm_model" }],
      [{ text: "🔑 Gemini API Key", callback_data: "adm_apikey" }],
      [{ text: "🔢 Free Question Limit", callback_data: "adm_limit" }],
      [{ text: "⏱ Reset Duration", callback_data: "adm_resetdur" }],
      [{ text: "🚫 Limit Exceeded Message", callback_data: "adm_exceedmsg_menu" }],
      [{ text: "➕ Grant Unlimited Access", callback_data: "adm_unlimited" }],
      [{ text: "✉️ Confirmation Messages", callback_data: "adm_confirmmsgs_menu" }],
      [{ text: "🗑 Auto-Delete Old Chats", callback_data: "adm_autodelete_menu" }],
      [{ text: "📚 Subjects (Science/English/Hindi/SST)", callback_data: "adm_subjects_menu" }],
      [{ text: "⚙️ Current Settings", callback_data: "adm_settings" }],
      [{ text: "🚪 Exit Admin Panel", callback_data: "adm_exit" }]
    ] }
  });
}

// ================= ADMIN TEXT-INPUT FLOW =================
async function handleAdminTextInput(env, chatId, state, text) {
  if (!isAdmin(chatId)) { await clearAdminState(env, chatId); return; }

  if (state === "await_welcome_hi") { await setSetting(env, "welcome_hi", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Hindi welcome message update ho gaya."); return; }
  if (state === "await_welcome_en") { await setSetting(env, "welcome_en", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ English welcome message updated."); return; }
  if (state === "await_model") { await setSetting(env, "model", text.trim()); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Gemini model update ho gaya: " + text.trim()); return; }
  if (state === "await_apikey") { await setSetting(env, "gemini_api_key", text.trim()); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Gemini API key update ho gayi."); return; }

  if (state === "await_limit") {
    const n = parseInt(text.trim(), 10);
    if (isNaN(n) || n < 0) { await sendMessage(chatId, "❌ Sahi number bhejo, e.g. 5"); return; }
    await setSetting(env, "free_limit", String(n));
    await clearAdminState(env, chatId);
    await sendMessage(chatId, "✅ Free limit set: " + n + " questions");
    return;
  }

  if (state === "await_resetdur") {
    const parsed = parseDuration(text);
    if (!parsed) { await sendMessage(chatId, "❌ Format sahi nahi hai. Example: 2 hour ya 1 day"); return; }
    await setSetting(env, "reset_ms", String(parsed.ms));
    await setSetting(env, "reset_label", parsed.label);
    await clearAdminState(env, chatId);
    await sendMessage(chatId, "✅ Reset duration set: " + parsed.label);
    return;
  }

  if (state === "await_exceedmsg_hi") { await setSetting(env, "exceed_hi", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Hindi exceeded-message updated."); return; }
  if (state === "await_exceedmsg_en") { await setSetting(env, "exceed_en", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ English exceeded-message updated."); return; }

  if (state === "await_unlimited") {
    const result = await grantUnlimited(env, text.trim());
    await clearAdminState(env, chatId);
    await sendMessage(chatId, result.message);
    return;
  }

  if (state === "await_unlimitedmsg_hi") { await setSetting(env, "unlimited_confirm_hi", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Unlimited confirmation (Hindi) update ho gaya."); return; }
  if (state === "await_unlimitedmsg_en") { await setSetting(env, "unlimited_confirm_en", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Unlimited confirmation (English) updated."); return; }
  if (state === "await_customlimitmsg_hi") { await setSetting(env, "custom_confirm_hi", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Custom limit confirmation (Hindi) update ho gaya."); return; }
  if (state === "await_customlimitmsg_en") { await setSetting(env, "custom_confirm_en", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Custom limit confirmation (English) updated."); return; }

  if (state === "await_autodelete_duration") {
    const parsedAD = parseDuration(text);
    if (!parsedAD) { await sendMessage(chatId, "❌ Format sahi nahi hai. Example: 30 day"); return; }
    await setSetting(env, "autodelete_ms", String(parsedAD.ms));
    await setSetting(env, "autodelete_label", parsedAD.label);
    await setSetting(env, "autodelete_enabled", "TRUE");
    await clearAdminState(env, chatId);
    await sendMessage(chatId, "✅ Auto-delete set ho gaya aur ON kar diya gaya: har purana message " + parsedAD.label + " ke baad automatically delete ho jaayega.");
    return;
  }

  // ---- Plan creation (6-step flow: name, price, limit, validity, exceedHi, exceedEn — subjects step alag) ----
  if (state === "await_plan_name") {
    await setBuilderState(env, "planbuilder_" + chatId, { name: text.trim() });
    await setAdminState(env, chatId, "await_plan_price");
    await sendMessage(chatId, "Price kitne Telegram Stars me rakhna hai? (sirf number, e.g. 50):");
    return;
  }
  if (state === "await_plan_price") {
    const price = parseInt(text.trim(), 10);
    if (isNaN(price) || price <= 0) { await sendMessage(chatId, "❌ Sahi number bhejo, e.g. 50"); return; }
    const pb2 = await getBuilderState(env, "planbuilder_" + chatId) || {};
    pb2.price = price;
    await setBuilderState(env, "planbuilder_" + chatId, pb2);
    await setAdminState(env, chatId, "await_plan_limit");
    await sendMessage(chatId, "Daily kitne QUESTIONS milenge is plan me? (sirf number, e.g. 50):");
    return;
  }
  if (state === "await_plan_limit") {
    const lim = parseInt(text.trim(), 10);
    if (isNaN(lim) || lim <= 0) { await sendMessage(chatId, "❌ Sahi number bhejo, e.g. 50"); return; }
    const pb3 = await getBuilderState(env, "planbuilder_" + chatId) || {};
    pb3.limit = lim;
    await setBuilderState(env, "planbuilder_" + chatId, pb3);
    await setAdminState(env, chatId, "await_plan_validity");
    await sendMessage(chatId, "Ye plan kitne dinon tak valid rahega? (sirf number, e.g. 30):");
    return;
  }
  if (state === "await_plan_validity") {
    const days = parseInt(text.trim(), 10);
    if (isNaN(days) || days <= 0) { await sendMessage(chatId, "❌ Sahi number bhejo, e.g. 30"); return; }
    const pb5 = await getBuilderState(env, "planbuilder_" + chatId) || {};
    pb5.validity = days;
    await setBuilderState(env, "planbuilder_" + chatId, pb5);
    await setAdminState(env, chatId, "await_plan_exceedhi");
    await sendMessage(chatId, "Is plan ki limit khatam hone par (Hindi me) kya message jaaye?");
    return;
  }
  if (state === "await_plan_exceedhi") {
    const pb6 = await getBuilderState(env, "planbuilder_" + chatId) || {};
    pb6.exceedHi = text;
    await setBuilderState(env, "planbuilder_" + chatId, pb6);
    await setAdminState(env, chatId, "await_plan_exceeden");
    await sendMessage(chatId, "Same message (English me) kya jaaye?");
    return;
  }
  if (state === "await_plan_exceeden") {
    const pb7 = await getBuilderState(env, "planbuilder_" + chatId) || {};
    pb7.exceedEn = text;
    pb7.subjects = { science: false, english: false, hindi: false, sst: false };
    await setBuilderState(env, "planbuilder_" + chatId, pb7);
    await clearAdminState(env, chatId);
    await sendPlanSubjectsPrompt(env, chatId);
    return;
  }

  // ---- Free Plan Activation: target user ka detail ----
  if (state === "await_freeplan_user") {
    const inputFP = text.trim();
    let targetChatIdFP;
    if (inputFP.indexOf("@") === 0) {
      targetChatIdFP = await resolveUserChatId(env, inputFP);
      if (!targetChatIdFP) { await sendMessage(chatId, "❌ User nahi mila. Pehle wo bot ko ek baar message kare, ya uska numeric Chat ID bhejo."); return; }
    } else {
      await upsertUser(env, inputFP, "", "");
      targetChatIdFP = inputFP;
    }
    const fpb = await getBuilderState(env, "freeplanbuilder_" + chatId) || {};
    await clearAdminState(env, chatId);
    await clearBuilderState(env, "freeplanbuilder_" + chatId);
    if (!fpb.planId) { await sendMessage(chatId, "❌ Session expire ho gayi. Phir se 🆓 Free Plan Activation try karo."); return; }
    await activateFreePlanForUser(env, chatId, targetChatIdFP, fpb.planId);
    return;
  }

  if (state === "await_freeplanmsg_hi") { await setSetting(env, "freeplan_confirm_hi", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Free-plan confirmation (Hindi) update ho gaya."); return; }
  if (state === "await_freeplanmsg_en") { await setSetting(env, "freeplan_confirm_en", text); await clearAdminState(env, chatId); await sendMessage(chatId, "✅ Free-plan confirmation (English) updated."); return; }

  // ---- Custom limit for specific user (4-step flow) ----
  if (state === "await_custom_user") {
    const input = text.trim();
    let targetChatId;
    if (input.indexOf("@") === 0) {
      targetChatId = await resolveUserChatId(env, input);
      if (!targetChatId) { await sendMessage(chatId, "❌ User nahi mila. Pehle wo bot ko ek baar message kare, ya uska numeric Chat ID bhejo."); return; }
    } else {
      await upsertUser(env, input, "", "");
      targetChatId = input;
    }
    await setBuilderState(env, "customlimitbuilder_" + chatId, { targetChatId: targetChatId });
    await setAdminState(env, chatId, "await_custom_limit");
    await sendMessage(chatId, "Kitne messages ki limit deni hai? (sirf number, e.g. 20):");
    return;
  }
  if (state === "await_custom_limit") {
    const climit = parseInt(text.trim(), 10);
    if (isNaN(climit) || climit <= 0) { await sendMessage(chatId, "❌ Sahi number bhejo, e.g. 20"); return; }
    const ccb = await getBuilderState(env, "customlimitbuilder_" + chatId) || {};
    ccb.limit = climit;
    await setBuilderState(env, "customlimitbuilder_" + chatId, ccb);
    await setAdminState(env, chatId, "await_custom_interval");
    await sendMessage(chatId, "Kitni-kitni der me ye limit reset ho?\nFormat: <number> <unit>\nUnits: second, minute, hour, day, week, year\nExample: 5 hour");
    return;
  }
  if (state === "await_custom_interval") {
    const parsedInt = parseDuration(text);
    if (!parsedInt) { await sendMessage(chatId, "❌ Format sahi nahi hai. Example: 5 hour"); return; }
    const ccb2 = await getBuilderState(env, "customlimitbuilder_" + chatId) || {};
    ccb2.intervalMs = parsedInt.ms;
    ccb2.intervalLabel = parsedInt.label;
    await setBuilderState(env, "customlimitbuilder_" + chatId, ccb2);
    await setAdminState(env, chatId, "await_custom_duration");
    await sendMessage(chatId, "Ye suvidha kitne samay tak valid rahegi (total duration)?\nFormat: <number> <unit>\nUnits: second, minute, hour, day, week, year\nExample: 7 day");
    return;
  }
  if (state === "await_custom_duration") {
    const parsedDur = parseDuration(text);
    if (!parsedDur) { await sendMessage(chatId, "❌ Format sahi nahi hai. Example: 7 day"); return; }
    const ccb3 = await getBuilderState(env, "customlimitbuilder_" + chatId) || {};
    await applyCustomLimit(env, ccb3.targetChatId, ccb3.limit, ccb3.intervalMs, parsedDur.ms);
    await clearBuilderState(env, "customlimitbuilder_" + chatId);
    await clearAdminState(env, chatId);
    await sendMessage(chatId, "✅ Custom limit set ho gaya: " + ccb3.limit + " messages har " + ccb3.intervalLabel + ", " + parsedDur.label + " tak valid.");

    const targetLang = (await getUserLang(env, ccb3.targetChatId)) || "hi";
    const template = targetLang === "en" ? await getSetting(env, "custom_confirm_en", DEFAULT_CUSTOM_CONFIRM_EN) : await getSetting(env, "custom_confirm_hi", DEFAULT_CUSTOM_CONFIRM_HI);
    const finalMsg = String(template)
      .replace(/{limit}/g, ccb3.limit)
      .replace(/{interval}/g, ccb3.intervalLabel)
      .replace(/{duration}/g, parsedDur.label);
    await sendMessage(ccb3.targetChatId, finalMsg);
    return;
  }
}

// ================= CALLBACK HANDLER =================
async function handleCallback(env, cq) {
  const chatId = cq.message.chat.id;
  const data = cq.data;
  await answerCallbackQuery(cq.id);

  if (data === "lang_hi" || data === "lang_en") {
    const lang = data === "lang_en" ? "en" : "hi";
    const username = (cq.from && cq.from.username) || "";
    const firstName = (cq.from && cq.from.first_name) || "";
    await upsertUser(env, chatId, username, firstName);
    await setUserLang(env, chatId, lang);
    await sendMessage(chatId, lang === "en"
      ? "✅ Language set to English. You can now send me any math question as text."
      : "✅ भाषा हिंदी सेट कर दी गई है। अब आप मुझे कोई भी गणित का सवाल टेक्स्ट में भेज सकते हैं।");
    return;
  }

  if (data === "show_plans") { await sendPlansToUser(env, chatId); return; }

  if (data.indexOf("buy_plan_") === 0) {
    const planId = data.substring("buy_plan_".length);
    const plan = await findPlanById(env, planId);
    if (!plan || Number(plan.active) !== 1) { await sendMessage(chatId, "Ye plan ab available nahi hai."); return; }
    await sendRaw("sendInvoice", {
      chat_id: chatId,
      title: String(plan.name).substring(0, 32),
      description: plan.daily_limit + " questions/day, " + plan.validity_days + " din tak valid",
      payload: "plan_" + planId,
      currency: "XTR",
      prices: [{ label: plan.name, amount: parseInt(plan.price_stars, 10) }]
    });
    return;
  }

  if (data.indexOf("adm_") === 0) {
    if (!isAdmin(chatId)) return;

    if (data === "adm_users") { await showUsersList(env, chatId); return; }
    if (data === "adm_unlimited_list") { await showUnlimitedList(env, chatId); return; }
    if (data.indexOf("adm_user_") === 0) { await showUserDetail(env, chatId, data.substring("adm_user_".length)); return; }
    if (data.indexOf("adm_cancelunlimited_") === 0) { await cancelUnlimited(env, chatId, data.substring("adm_cancelunlimited_".length)); return; }

    if (data === "adm_welcome_menu") {
      await sendRaw("sendMessage", { chat_id: chatId, text: "Kis language ka welcome message change karna hai?",
        reply_markup: { inline_keyboard: [[{ text: "हिंदी", callback_data: "adm_welcome_hi" }, { text: "English", callback_data: "adm_welcome_en" }]] } });
      return;
    }
    if (data === "adm_welcome_hi") { await setAdminState(env, chatId, "await_welcome_hi"); await sendMessage(chatId, "Naya Hindi welcome message type karke bhejo:"); return; }
    if (data === "adm_welcome_en") { await setAdminState(env, chatId, "await_welcome_en"); await sendMessage(chatId, "Type new English welcome message:"); return; }
    if (data === "adm_model") { await setAdminState(env, chatId, "await_model"); await sendMessage(chatId, "Naya Gemini model name type karo:"); return; }
    if (data === "adm_apikey") { await setAdminState(env, chatId, "await_apikey"); await sendMessage(chatId, "Naya Gemini API key type karke bhejo:"); return; }
    if (data === "adm_limit") { await setAdminState(env, chatId, "await_limit"); await sendMessage(chatId, "Free limit number bhejo (e.g. 5):"); return; }
    if (data === "adm_resetdur") { await setAdminState(env, chatId, "await_resetdur"); await sendMessage(chatId, "Format: <number> <unit>\nUnits: second, minute, hour, day, week, year\nExample: 2 hour"); return; }
    if (data === "adm_exceedmsg_menu") {
      await sendRaw("sendMessage", { chat_id: chatId, text: "Kis language ka limit-exceeded message change karna hai?",
        reply_markup: { inline_keyboard: [[{ text: "हिंदी", callback_data: "adm_exceedmsg_hi" }, { text: "English", callback_data: "adm_exceedmsg_en" }]] } });
      return;
    }
    if (data === "adm_exceedmsg_hi") { await setAdminState(env, chatId, "await_exceedmsg_hi"); await sendMessage(chatId, "Naya (Hindi) limit-exceeded message type karo:"); return; }
    if (data === "adm_exceedmsg_en") { await setAdminState(env, chatId, "await_exceedmsg_en"); await sendMessage(chatId, "Type new (English) limit-exceeded message:"); return; }
    if (data === "adm_unlimited") { await setAdminState(env, chatId, "await_unlimited"); await sendMessage(chatId, "Jise unlimited dena hai, uska Chat ID ya @username bhejo:"); return; }
    if (data === "adm_settings") { await showCurrentSettings(env, chatId); return; }
    if (data === "adm_exit") { await clearAdminState(env, chatId); await sendMessage(chatId, "🚪 Aap admin panel se bahar aa gaye. Ab normal mode me ho."); return; }

    if (data === "adm_plans_menu") {
      await sendRaw("sendMessage", { chat_id: chatId, text: "📦 Plans Management", reply_markup: { inline_keyboard: [
        [{ text: "➕ Add Plan", callback_data: "adm_addplan" }],
        [{ text: "🗑 Delete Plan", callback_data: "adm_delplan_menu" }],
        [{ text: "📋 List Plans", callback_data: "adm_listplans" }]
      ] } });
      return;
    }
    if (data === "adm_addplan") {
      await setBuilderState(env, "planbuilder_" + chatId, {});
      await setAdminState(env, chatId, "await_plan_name");
      await sendMessage(chatId, "Plan ka naam type karo (e.g. Basic Plan):");
      return;
    }
    if (data === "adm_delplan_menu") { await showDeletePlanList(env, chatId); return; }
    if (data.indexOf("adm_delplanid_") === 0) {
      await deletePlan(env, data.substring("adm_delplanid_".length));
      await sendMessage(chatId, "✅ Plan delete kar diya gaya.");
      return;
    }
    if (data === "adm_listplans") { await showAdminPlansList(env, chatId); return; }

    if (data === "adm_freeplan_menu") { await showFreePlanList(env, chatId); return; }
    if (data.indexOf("adm_freeplanid_") === 0) {
      const freePlanId = data.substring("adm_freeplanid_".length);
      const freePlanObj = await findPlanById(env, freePlanId);
      if (!freePlanObj) { await sendMessage(chatId, "❌ Ye plan ab maujood nahi hai."); return; }
      await setBuilderState(env, "freeplanbuilder_" + chatId, { planId: freePlanId });
      await setAdminState(env, chatId, "await_freeplan_user");
      await sendMessage(chatId, "Jise '" + freePlanObj.name + "' plan FREE me activate karna hai, uska Chat ID ya @username bhejo:");
      return;
    }

    if (data === "adm_customlimit") {
      await setAdminState(env, chatId, "await_custom_user");
      await sendMessage(chatId, "Jise custom limit dena hai, uska Chat ID ya @username bhejo:");
      return;
    }

    if (data === "adm_confirmmsgs_menu") {
      await sendRaw("sendMessage", { chat_id: chatId, text: "✉️ Confirmation Messages\n\nInhe edit karo — jab admin kisi ko unlimited, custom limit, ya free plan deta hai, ye message us user ko uski language me jaata hai.", reply_markup: { inline_keyboard: [
        [{ text: "Unlimited (HI)", callback_data: "adm_unlimitedmsg_hi" }, { text: "Unlimited (EN)", callback_data: "adm_unlimitedmsg_en" }],
        [{ text: "Custom Limit (HI)", callback_data: "adm_customlimitmsg_hi" }, { text: "Custom Limit (EN)", callback_data: "adm_customlimitmsg_en" }],
        [{ text: "Free Plan (HI)", callback_data: "adm_freeplanmsg_hi" }, { text: "Free Plan (EN)", callback_data: "adm_freeplanmsg_en" }]
      ] } });
      return;
    }
    if (data === "adm_unlimitedmsg_hi") { await setAdminState(env, chatId, "await_unlimitedmsg_hi"); await sendMessage(chatId, "Naya (Hindi) unlimited-confirmation message type karo:"); return; }
    if (data === "adm_unlimitedmsg_en") { await setAdminState(env, chatId, "await_unlimitedmsg_en"); await sendMessage(chatId, "Type new (English) unlimited-confirmation message:"); return; }
    if (data === "adm_customlimitmsg_hi") { await setAdminState(env, chatId, "await_customlimitmsg_hi"); await sendMessage(chatId, "Naya (Hindi) custom-limit confirmation message type karo.\nPlaceholders use kar sakte ho: {limit} {interval} {duration}"); return; }
    if (data === "adm_customlimitmsg_en") { await setAdminState(env, chatId, "await_customlimitmsg_en"); await sendMessage(chatId, "Type new (English) custom-limit confirmation message.\nPlaceholders available: {limit} {interval} {duration}"); return; }
    if (data === "adm_freeplanmsg_hi") { await setAdminState(env, chatId, "await_freeplanmsg_hi"); await sendMessage(chatId, "Naya (Hindi) free-plan-activation confirmation message type karo.\nPlaceholders use kar sakte ho: {plan} {limit} {duration}"); return; }
    if (data === "adm_freeplanmsg_en") { await setAdminState(env, chatId, "await_freeplanmsg_en"); await sendMessage(chatId, "Type new (English) free-plan-activation confirmation message.\nPlaceholders available: {plan} {limit} {duration}"); return; }

    if (data === "adm_autodelete_menu") {
      const adEnabledM = String(await getSetting(env, "autodelete_enabled", "FALSE")).toUpperCase() === "TRUE";
      const adLabelM = await getSetting(env, "autodelete_label", "-");
      const adText = "🗑 Auto-Delete Old Chats\n\nStatus: " + (adEnabledM ? "✅ ON" : "❌ OFF") +
        "\nDuration: " + adLabelM +
        "\n\nYe feature ON hone par, set kiye gaye samay se purane user ke saare input/output messages (Messages table se) apne aap automatically delete ho jaate hain.";
      await sendRaw("sendMessage", { chat_id: chatId, text: adText, reply_markup: { inline_keyboard: [
        [{ text: "⏱ Set/Change Duration", callback_data: "adm_autodelete_setdur" }],
        [{ text: "✅ Turn ON", callback_data: "adm_autodelete_on" }, { text: "❌ Turn OFF", callback_data: "adm_autodelete_off" }]
      ] } });
      return;
    }
    if (data === "adm_autodelete_setdur") {
      await setAdminState(env, chatId, "await_autodelete_duration");
      await sendMessage(chatId, "Kitne samay se purane messages automatically delete ho jaayen?\nFormat: <number> <unit>\nUnits: second, minute, hour, day, week, year\nExample: 30 day\n\n(Duration set karte hi auto-delete apne aap ON bhi ho jaayega.)");
      return;
    }
    if (data === "adm_autodelete_on") {
      const existingAdMs = parseInt(await getSetting(env, "autodelete_ms", "0"), 10);
      if (!existingAdMs) { await sendMessage(chatId, "❌ Pehle duration set karo (⏱ Set/Change Duration wale button se)."); return; }
      await setSetting(env, "autodelete_enabled", "TRUE");
      await sendMessage(chatId, "✅ Auto-delete ON kar diya gaya. Duration: " + (await getSetting(env, "autodelete_label", "-")));
      return;
    }
    if (data === "adm_autodelete_off") {
      await setSetting(env, "autodelete_enabled", "FALSE");
      await sendMessage(chatId, "❌ Auto-delete OFF kar diya gaya. Purane messages ab automatically delete nahi honge.");
      return;
    }

    if (data === "adm_subjects_menu") { await sendSubjectsMenu(env, chatId); return; }
    if (data.indexOf("adm_subj_toggle_") === 0) {
      const subjKey = data.substring("adm_subj_toggle_".length);
      if (TOGGLEABLE_SUBJECTS.indexOf(subjKey) === -1) return;
      const curOn = String(await getSetting(env, "subject_" + subjKey + "_enabled", "FALSE")).toUpperCase() === "TRUE";
      await setSetting(env, "subject_" + subjKey + "_enabled", curOn ? "FALSE" : "TRUE");
      await sendSubjectsMenu(env, chatId);
      return;
    }

    if (data.indexOf("adm_plansubj_toggle_") === 0) {
      const pKey = data.substring("adm_plansubj_toggle_".length);
      if (TOGGLEABLE_SUBJECTS.indexOf(pKey) === -1) return;
      const pbT = await getBuilderState(env, "planbuilder_" + chatId);
      if (!pbT) { await sendMessage(chatId, "❌ Session expire ho gayi. Phir se ➕ Add Plan try karo."); return; }
      if (!pbT.subjects) pbT.subjects = { science: false, english: false, hindi: false, sst: false };
      pbT.subjects[pKey] = !pbT.subjects[pKey];
      await setBuilderState(env, "planbuilder_" + chatId, pbT);
      await sendPlanSubjectsPrompt(env, chatId);
      return;
    }
    if (data === "adm_plansubj_done") {
      const pbD = await getBuilderState(env, "planbuilder_" + chatId);
      if (!pbD) { await sendMessage(chatId, "❌ Session expire ho gayi. Phir se ➕ Add Plan try karo."); return; }
      const s2 = pbD.subjects || {};
      const subjList = ["math"];
      if (s2.science) subjList.push("science");
      if (s2.english) subjList.push("english");
      if (s2.hindi) subjList.push("hindi");
      if (s2.sst) subjList.push("sst");
      const subjectsStr = subjList.join(",");
      const planId = String(Date.now());
      await env.DB.prepare(
        "INSERT INTO plans (plan_id, name, price_stars, daily_limit, validity_days, exceed_hi, exceed_en, active, subjects) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)"
      ).bind(planId, pbD.name, pbD.price, pbD.limit, pbD.validity, pbD.exceedHi, pbD.exceedEn, subjectsStr).run();
      await clearBuilderState(env, "planbuilder_" + chatId);
      await sendMessage(chatId, "✅ Plan '" + pbD.name + "' launch ho gaya: " + pbD.price + "⭐ = " + pbD.limit + " Q/din, " + pbD.validity + " din tak valid.\n📚 Subjects: " + subjectsStr);
      return;
    }
  }
}

// ================= MAIN WEBHOOK ENTRY =================
async function handleUpdate(update, env) {
  try {
    // Telegram jab retry karke same update dobara bhejta hai, use dedupe karo (KV, 10 min TTL).
    if (update.update_id !== undefined) {
      const dedupKey = "upd_" + update.update_id;
      const seen = await env.BOT_KV.get(dedupKey);
      if (seen) return;
      await env.BOT_KV.put(dedupKey, "1", { expirationTtl: 600 });
    }

    if (update.pre_checkout_query) { await handlePreCheckout(env, update.pre_checkout_query); return; }
    if (update.callback_query) { await handleCallback(env, update.callback_query); return; }
    if (!update.message) return;

    const msg = update.message;
    const chatId = msg.chat.id;

    if (msg.successful_payment) { await handleSuccessfulPayment(env, chatId, msg.successful_payment); return; }

    const text = msg.text || "";
    const username = (msg.from && msg.from.username) || "";
    const firstName = (msg.from && msg.from.first_name) || "";

    if (normalizeAdminPasswordInput(text) === ADMIN_PASSWORD) {
      if (isAdmin(chatId)) await sendAdminMenu(chatId);
      return;
    }

    const state = await getAdminState(env, chatId);
    if (state) { await handleAdminTextInput(env, chatId, state, text); return; }

    await upsertUser(env, chatId, username, firstName);
    const userLang = await getUserLang(env, chatId);
    if (!userLang || text === "/start") { await sendWelcomeWithOptions(env, chatId); return; }

    if (msg.photo) { await handleIncomingPhoto(chatId, userLang); return; }

    if (text === "/plans") { await sendPlansToUser(env, chatId); return; }

    if (!text) return;

    await handleTextQuestion(env, chatId, text, userLang);
  } catch (err) {
    console.log("Error in handleUpdate: " + err);
    try {
      if (update && update.message && update.message.chat && update.message.chat.id) {
        await sendMessage(update.message.chat.id, "⚠️ Kuch technical dikkat aa gayi, kripya apna sawal dobara bhejo.");
      }
    } catch (err2) {
      console.log("Error while sending fallback error message: " + err2);
    }
  }
}

// ================= WEBHOOK REGISTRATION =================
async function setWebhookHandler(request) {
  const url = new URL(request.url);
  const webhookUrl = url.origin + "/";
  const res = await fetch(telegramApi("setWebhook") + "?url=" + encodeURIComponent(webhookUrl));
  const body = await res.text();
  return new Response(body, { headers: { "Content-Type": "application/json" } });
}

// ================= WORKER ENTRYPOINTS =================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/setWebhook") {
      return await setWebhookHandler(request);
    }

    if (request.method === "POST") {
      let update;
      try {
        update = await request.json();
      } catch (e) {
        return new Response("ok"); // malformed body, Telegram ko phir bhi 200 do
      }
      ctx.waitUntil(handleUpdate(update, env));
      return new Response("ok");
    }

    return new Response("ok");
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(autoDeleteOldMessages(env));
  }
};
