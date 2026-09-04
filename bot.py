"""
Telegram Math Solver Bot (Gemini API)
=======================================

Install dependencies before running:
    pip install python-telegram-bot==21.6 google-generativeai==0.8.3 python-dotenv==1.0.1

Run:
    python bot.py

Requires a ".env" file in the same folder with:
    BOT_TOKEN=your_telegram_bot_token
    GEMINI_API_KEY=your_gemini_api_key
    MODEL_NAME=gemini-3.5-flash-lite
"""

import os
import logging
from dotenv import load_dotenv
import google.generativeai as genai
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

# .env file se variables load karo
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-3.5-flash-lite")

if not BOT_TOKEN or not GEMINI_API_KEY:
    raise ValueError("BOT_TOKEN aur GEMINI_API_KEY .env file me set karo")

# Gemini configure
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(
    model_name=MODEL_NAME,
    system_instruction=(
        "Tum ek math solver assistant ho. User jo bhi math ka sawal poochhe, "
        "use step by step tareeke se hal karo aur final answer clearly alag "
        "line me 'Answer:' likh kar do. Agar sawal math se related na ho, to "
        "politely bolo ki tum sirf math ke sawal solve karte ho."
    ),
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Namaste! Main aapka Math Solver Bot hoon.\n"
        "Mujhe koi bhi math ka sawal bhejo, main use step-by-step solve kar dunga."
    )


async def solve_math(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_question = update.message.text
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")
    try:
        response = model.generate_content(user_question)
        answer = response.text if response.text else "Maaf kijiye, main is sawal ka jawab nahi de paya."
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        answer = "Kuch technical dikkat aa gayi hai, thodi der baad phir try karo."
    await update.message.reply_text(answer)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    logger.error(f"Update {update} caused error {context.error}")


def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, solve_math))
    app.add_error_handler(error_handler)
    logger.info("Bot start ho raha hai...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
