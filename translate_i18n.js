const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Помилка: Змінна GEMINI_API_KEY порожня! Спочатку виконайте export GEMINI_API_KEY=...");
  process.exit(1);
}

// Явно передаємо apiKey
const ai = new GoogleGenAI({ apiKey: apiKey }); 

const i18nDir = path.join(__dirname, 'i18n');
const masterEnPath = path.join(i18nDir, 'en.toml');
const masterEnContent = fs.readFileSync(masterEnPath, 'utf8');

const contentFiles = fs.readdirSync(path.join(__dirname, 'content'));
const langCodes = new Set();

contentFiles.forEach(file => {
  const parts = file.split('.');
  if (parts.length >= 3 && parts[parts.length - 1] === 'md') {
    const lang = parts[parts.length - 2].toLowerCase();
    if (lang && lang !== 'md' && lang !== 'en' && lang !== 'uk') {
      langCodes.add(lang);
    }
  }
});

async function translateLang(langCode) {
  const prompt = `You are a professional software localizer (UI/UX).
Translate the following Hugo i18n TOML file from English into the target language code: "${langCode}".

CRITICAL RULES:
1. Preserve all TOML keys exactly as they are.
2. DO NOT translate or modify Hugo template variables inside double curly braces: {{ .Title }}, {{ .Type }}, {{ .Count }}, {{ .Name }}.
3. "current_lang" means "Current language" (adjective, e.g. "Current"), NOT electrical current.
4. "readMore" means "Read more" (button text).
5. "open_gdoc" means "Open manual in Google Docs" (use native words for Manual/Guidance, avoid technical "instructions").
6. Output ONLY valid TOML code. Do not wrap in markdown quotes or add explanation.

Input TOML:
${masterEnContent}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    let translatedText = response.text.trim();
    translatedText = translatedText.replace(/^```toml/i, '').replace(/^```/, '').replace(/```$/, '').trim();

    const targetPath = path.join(i18nDir, `${langCode}.toml`);
    fs.writeFileSync(targetPath, translatedText);
    console.log(`[✓] Успішно перекладено: ${langCode}.toml`);
  } catch (err) {
    console.error(`[X] Помилка перекладу для ${langCode}:`, err.message);
  }
}

async function processAll() {
  console.log(`Розпочинаємо переклад для ${langCodes.size} мов...`);
  for (const lang of langCodes) {
    await translateLang(lang);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log("Пакетний переклад завершено!");
}

processAll();
