// Telegram Coaching Bot — Cloudflare Workers
// Required bindings (set in wrangler.toml / dashboard):
//   BOT_TOKEN   (secret)      -> your Telegram bot token from BotFather
//   USERS       (KV namespace) -> stores each user's language + purchases

const REG_LINK = "https://forms.gle/Eh4chNMZnZDrE1BTA";

const PLANS = [
  { id: "8th", price: 100, name: { hi: "8वीं कक्षा (सभी विषय)", en: "Class 8th (All Subjects)", ur: "8ویں جماعت (تمام مضامین)" } },
  { id: "9th", price: 100, name: { hi: "9वीं कक्षा (सभी विषय)", en: "Class 9th (All Subjects)", ur: "9ویں جماعت (تمام مضامین)" } },
  { id: "10th", price: 100, name: { hi: "10वीं कक्षा (सभी विषय)", en: "Class 10th (All Subjects)", ur: "10ویں جماعت (تمام مضامین)" } },
  { id: "11th", price: 250, name: { hi: "11वीं कक्षा (सभी विषय)", en: "Class 11th (All Subjects)", ur: "11ویں جماعت (تمام مضامین)" } },
];

const FEATURES = {
  hi: ["📚 Daily lecture", "📝 हर शनिवार Mock Test", "✍️ Daily Practice Questions", "📊 Poll type Questions", "❓ Doubt Support", "💬 WhatsApp Group", "👨‍🏫 Teacher Support"],
  en: ["📚 Daily lecture", "📝 Mock test every Saturday", "✍️ Daily Practice Questions", "📊 Poll type Questions", "❓ Doubt Support", "💬 WhatsApp Group", "👨‍🏫 Teacher Support"],
  ur: ["📚 روزانہ لیکچر", "📝 ہر ہفتہ Mock Test", "✍️ روزانہ Practice Questions", "📊 Poll طرز کے سوالات", "❓ Doubt Support", "💬 WhatsApp Group", "👨‍🏫 Teacher Support"],
};

const TEXT = {
  welcome:
    "नमस्कार! 👋\nआप किस भाषा में बातचीत करना चाहते हैं? कृपया अपनी पसंदीदा भाषा चुनें।\n\n" +
    "Hello! 👋 Please choose your preferred language.\n\n" +
    "ہیلو! 👋 براہ کرم اپنی پسندیدہ زبان منتخب کریں۔",
  registration: {
    hi: `स्वयं का पंजीकरण करने के लिए इस लिंक पर क्लिक करें और दिए गए फॉर्म को भरें।\n${REG_LINK}\nकृपया अपना detail सही-सही दर्ज करें, ताकि हमारी टीम आपसे संपर्क कर सके।`,
    en: `Click the link below to register yourself and fill out the given form.\n${REG_LINK}\nPlease enter your details correctly so our team can contact you.`,
    ur: `خود کو رجسٹر کرنے کے لیے اس لنک پر کلک کریں اور دیے گئے فارم کو بھریں۔\n${REG_LINK}\nبراہ کرم اپنی تفصیلات درست طریقے سے درج کریں، تاکہ ہماری ٹیم آپ سے رابطہ کر سکے۔`,
  },
  plansHeader: {
    hi: "🎓 हमारे उपलब्ध कोर्स प्लान देखें और अपनी क्लास चुनें:",
    en: "🎓 Check out our available course plans and choose your class:",
    ur: "🎓 ہمارے دستیاب کورس پلانز دیکھیں اور اپنی کلاس منتخب کریں:",
  },
  buyButton: { hi: "🛒 अभी खरीदें", en: "🛒 Buy Now", ur: "🛒 ابھی خریدیں" },
  perMonth: { hi: "/माह", en: "/mo", ur: "/ماہ" },
  invoiceDesc: {
    hi: "मासिक सब्सक्रिप्शन - सभी विषय शामिल",
    en: "Monthly subscription - all subjects included",
    ur: "ماہانہ سبسکرپشن - تمام مضامین شامل",
  },
  congrats: {
    hi: "🎉 बधाई हो! आपका प्लान सफलतापूर्वक सक्रिय हो चुका है।\nकृपया ऊपर दिए गए लिंक पर जाकर फॉर्म भर दें, ताकि आपकी जानकारी दर्ज की जा सके।",
    en: "🎉 Congratulations! Your plan has been successfully activated.\nPlease go to the link shared above and fill out the form so your details can be recorded.",
    ur: "🎉 مبارک ہو! آپ کا پلان کامیابی سے فعال ہو چکا ہے۔\nبراہ کرم اوپر دیے گئے لنک پر جا کر فارم بھریں، تاکہ آپ کی معلومات درج کی جا سکیں۔",
  },
};

// ---------- Special redeem code (limited uses) ----------
const SPECIAL_CODE = "5252565252565252";
const SPECIAL_CODE_MAX_USES = 2;
const SPECIAL_CODE_MESSAGE = `🎉 हार्दिक बधाई, अभिषेक! 🎉

👤 नाम: अभिषेक
📚 कक्षा: 10वीं
📖 विषय: गणित

आपकी कक्षा 10वीं गणित की 1 माह की अध्ययन योजना सफलतापूर्वक सक्रिय हो गई है।

📌 योजना: 100 TS
📅 योजना समाप्ति: 10 अक्टूबर, प्रातः 10:00 बजे

हमसे जुड़ने के लिए नीचे दिए गए लिंक से चैनल अवश्य जॉइन करें।
https://t.me/+KVzCMkZrzMM4ODFl

📚 आपको मिलने वाली सुविधाएँ

✅ प्रतिदिन गणित का वीडियो व्याख्यान
✅ प्रत्येक शनिवार मॉक टेस्ट
✅ प्रतिदिन 10 महत्वपूर्ण अभ्यास प्रश्न
✅ प्रतिदिन 5 Poll आधारित प्रश्न
✅ संदेह समाधान की सुविधा
✅ WPP सुविधा
✅ शिक्षक से सहायता

🕖 कक्षाओं का समय

आपकी विशेष कक्षा विशेष चैनल पर प्रतिदिन शाम 7:00 बजे उपलब्ध कराई जाएगी।

📅 कक्षाएँ 10 सितंबर से प्रारंभ होंगी।

📝 दैनिक एवं साप्ताहिक कार्यक्रम

• प्रतिदिन: शाम 7:00 बजे कक्षा
• प्रतिदिन: 10 सबसे महत्वपूर्ण प्रश्न
• प्रतिदिन: 5 Poll आधारित प्रश्न
• प्रत्येक शनिवार: 1 प्रश्न-पत्र
• प्रत्येक शनिवार: 1 ऑनलाइन परीक्षा
• प्रत्येक रविवार: अवकाश

📢 महत्वपूर्ण सूचना: सभी कक्षाएँ, अभ्यास प्रश्न और परीक्षाएँ निर्धारित समय के अनुसार विशेष चैनल पर उपलब्ध कराई जाएँगी। इसलिए चैनल से जुड़े रहना आवश्यक है।

🌟 नियमित अध्ययन करें, निरंतर अभ्यास करें और अपनी तैयारी को मजबूत बनाएं।

आपकी सफलता ही हमारा लक्ष्य है। 📚✨`;

const LANG_BUTTONS = [
  [{ text: "🇮🇳 हिंदी", callback_data: "lang_hi" }],
  [{ text: "🇬🇧 English", callback_data: "lang_en" }],
  [{ text: "🇵🇰 اردو", callback_data: "lang_ur" }],
];

// ---------- Telegram API helpers ----------
function apiUrl(env, method) {
  return `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`;
}

async function tg(env, method, payload) {
  const res = await fetch(apiUrl(env, method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

function sendMessage(env, chatId, text, reply_markup) {
  return tg(env, "sendMessage", { chat_id: chatId, text, reply_markup, parse_mode: "HTML" });
}

// ---------- KV user state helpers ----------
async function getUser(env, chatId) {
  const raw = await env.USERS.get(String(chatId));
  return raw ? JSON.parse(raw) : { lang: null, purchased: [] };
}
async function saveUser(env, chatId, user) {
  await env.USERS.put(String(chatId), JSON.stringify(user));
}

// ---------- Message builders ----------
function plansMessage(lang) {
  let msg = TEXT.plansHeader[lang] + "\n\n";
  for (const plan of PLANS) {
    msg += `<b>${plan.name[lang]}</b>\n`;
    msg += FEATURES[lang].join("\n") + "\n";
    msg += `⭐ ${plan.price} ${TEXT.perMonth[lang]}\n\n`;
  }
  return msg;
}

function plansKeyboard(lang) {
  return {
    inline_keyboard: PLANS.map((p) => [
      { text: `${TEXT.buyButton[lang]} — ${p.name[lang]} (${p.price}⭐)`, callback_data: `buy_${p.id}` },
    ]),
  };
}

// ---------- Core update handling ----------
async function handleUpdate(update, env) {
  if (update.pre_checkout_query) {
    await tg(env, "answerPreCheckoutQuery", {
      pre_checkout_query_id: update.pre_checkout_query.id,
      ok: true,
    });
    return;
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query, env);
    return;
  }

  if (update.message) {
    await handleMessage(update.message, env);
  }
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;

  // Successful Telegram Stars payment
  if (message.successful_payment) {
    const planId = message.successful_payment.invoice_payload;
    const user = await getUser(env, chatId);
    if (!user.purchased.includes(planId)) user.purchased.push(planId);
    await saveUser(env, chatId, user);
    const lang = user.lang || "hi";
    await sendMessage(env, chatId, TEXT.congrats[lang]);
    return;
  }

  // Special redeem code -> works only the first SPECIAL_CODE_MAX_USES times (global count)
  if (message.text === SPECIAL_CODE) {
    const usesRaw = await env.USERS.get("special_code_uses");
    const uses = usesRaw ? parseInt(usesRaw, 10) : 0;
    if (uses < SPECIAL_CODE_MAX_USES) {
      await env.USERS.put("special_code_uses", String(uses + 1));
      await sendMessage(env, chatId, SPECIAL_CODE_MESSAGE);
      return;
    }
    // limit reached -> fall through to normal bot behaviour below
  }

  const user = await getUser(env, chatId);

  // /start or language not chosen yet -> ask language
  if (message.text === "/start" || !user.lang) {
    await sendMessage(env, chatId, TEXT.welcome, { inline_keyboard: LANG_BUTTONS });
    return;
  }

  // Already purchased at least one plan -> keep repeating the success message
  if (user.purchased.length > 0) {
    await sendMessage(env, chatId, TEXT.congrats[user.lang]);
    return;
  }

  // Otherwise, show subscription plans again
  await sendMessage(env, chatId, plansMessage(user.lang), plansKeyboard(user.lang));
}

async function handleCallback(cb, env) {
  const chatId = cb.message.chat.id;
  const data = cb.data;
  await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });

  if (data.startsWith("lang_")) {
    const lang = data.replace("lang_", "");
    const user = await getUser(env, chatId);
    user.lang = lang;
    await saveUser(env, chatId, user);
    await sendMessage(env, chatId, TEXT.registration[lang]);
    return;
  }

  if (data.startsWith("buy_")) {
    const planId = data.replace("buy_", "");
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return;
    const user = await getUser(env, chatId);
    const lang = user.lang || "hi";
    await tg(env, "sendInvoice", {
      chat_id: chatId,
      title: plan.name[lang],
      description: TEXT.invoiceDesc[lang],
      payload: plan.id,
      provider_token: "", // empty string = Telegram Stars payment
      currency: "XTR",
      prices: [{ label: plan.name[lang], amount: plan.price }],
    });
  }
}

// ---------- Worker entry point ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/webhook") {
      const update = await request.json();
      ctx.waitUntil(handleUpdate(update, env));
      return new Response("OK");
    }

    // Visit this URL once after deploying to register the Telegram webhook
    if (url.pathname === "/setup") {
      const webhookUrl = `${url.protocol}//${url.host}/webhook`;
      const result = await tg(env, "setWebhook", { url: webhookUrl });
      return new Response(JSON.stringify(result, null, 2), {
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Bot is running ✅");
  },
};
