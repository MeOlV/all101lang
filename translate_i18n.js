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

// Рахуємо кількість TOML-ключів (за секціями [key] або квадратними дужками)
const keyMatches = masterEnContent.match(/^\[.+\]/gm);
const totalKeys = keyMatches ? keyMatches.length : 0;
const totalChars = masterEnContent.length;

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

async function translateLang(langCode, currentIndex, totalLangs) {
  const prompt = `You are a professional software localizer (UI/UX).
Translate the following Hugo i18n TOML file from English into the target language code: "${langCode}".

CRITICAL RULES:
1. Preserve all TOML keys exactly as they are.
2. DO NOT translate or modify Hugo template variables inside double curly braces: {{ .Title }}, {{ .Type }}, {{ .Count }}, {{ .Name }}.
3. "current_lang" means "Current language" (adjective, e.g. "Current"), NOT electrical current.
4. "readMore" means "Read more" (button text).
5. "open_gdoc" means "Open manual in Google Docs" (use native words for Manual/Guidance, avoid technical "instructions").
6. "embedded_gdoc_title" means "Embedded Google Docs document" (UI section header).
7. "toggle_embed_hint" means "click to collapse/expand" (UI instruction for expanding/collapsing details).
8. "open_gdoc_external" means "Open in a new window" (button label for opening document in external tab).
9. Output ONLY valid TOML code. Do not wrap in markdown quotes or add explanation.

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
    console.log(`[✓] [${currentIndex}/${totalLangs}] Успішно перекладено: ${langCode}.toml`);
  } catch (err) {
    console.error(`[X] [${currentIndex}/${totalLangs}] Помилка перекладу для ${langCode}:`, err.message);
  }
}

async function processAll() {
  const totalLangs = langCodes.size;
  
  // Отримуємо точну кількість токенів від Gemini API
  let tokenInfo = "";
  try {
    const countResult = await ai.models.countTokens({
      model: 'gemini-2.5-flash',
      contents: masterEnContent,
    });
    tokenInfo = `, ~${countResult.totalTokens} токенів (вхідні)`;
  } catch (e) {
    // Якщо помилка запиту токенів — продовжуємо без них
  }

  console.log(`==================================================`);
  console.log(`📦 Джерельний файл en.toml: ${totalKeys} ключів, ${totalChars} символів${tokenInfo}`);
  console.log(`🌐 Мов для перекладу: ${totalLangs}`);
  console.log(`==================================================\n`);

  let index = 1;
  for (const lang of langCodes) {
    await translateLang(lang, index, totalLangs);
    index++;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n✨ Пакетний переклад повністю завершено!");
}

processAll();
