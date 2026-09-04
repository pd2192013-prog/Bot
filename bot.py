"""
Math Solver Telegram Bot — powered by Google Gemini API
---------------------------------------------------------
Requirements: pip install -r requirements.txt
Run: python bot.py
"""

import logging
import os
from dotenv import load_dotenv
import google.generativeai as genai
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters

# ---------- Setup ----------
load_dotenv()  # loads variables from .env file

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-3.5-flash-lite"

if not BOT_TOKEN or not GEMINI_API_KEY:
    raise ValueError("TELEGRAM_BOT_TOKEN or GEMINI_API_KEY missing. Check your .env file.")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(MODEL_NAME)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# System instruction so the model always behaves like a math tutor
SYSTEM_PROMPT = (
    "You are a math-solving assistant. Solve the given math question "
    "step by step, showing clear working, and give the final answer clearly "
    "highlighted at the end. If the question is not a math problem, "
    "politely say you only solve math questions. Keep formatting simple "
    "(use plain text, not heavy markdown) since this will be shown inside Telegram."
)


# ---------- Handlers ----------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Namaste! Mujhe koi bhi math ka question bhejo (algebra, calculus, "
        "arithmetic, word problem — kuch bhi), main step-by-step solve karke dunga."
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Bas apna math question type karke bhej do. Example:\n"
        "- 2x + 5 = 15, x nikaalo\n"
        "- Integrate x^2 dx\n"
        "- Ek train 60 km/h se chal rahi hai..."
    )


async def solve_math(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_question = update.message.text
    chat_id = update.effective_chat.id

    await context.bot.send_chat_action(chat_id=chat_id, action="typing")

    try:
        response = model.generate_content(
            [SYSTEM_PROMPT, f"Solve this math question:\n{user_question}"]
        )
        answer = response.text if response and response.text else (
            "Sorry, main is question ka jawab generate nahi kar paya. "
            "Dobara try karo."
        )
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        answer = "Kuch technical error aa gaya. Thodi der baad try karo."

    # Telegram messages have a 4096 character limit — split if needed
    for i in range(0, len(answer), 4000):
        await update.message.reply_text(answer[i:i + 4000])


# ---------- Main ----------
def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, solve_math))

    logger.info("Bot started. Listening for messages...")
    app.run_polling()


if __name__ == "__main__":
    main()
