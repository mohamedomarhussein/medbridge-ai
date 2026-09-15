import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SUPPORTED_LANGUAGES = {
  en: 'English',
  sw: 'Kiswahili',
  so: 'Somali',
  ki: 'Kikuyu',
  luo: 'Dholuo',
  kam: 'Kamba',
  kln: 'Kalenjin',
  mas: 'Maasai',
  bor: 'Borana',
};

const SYSTEM_PROMPT = `
You are MedBridge AI, a multilingual health triage assistant for Kenya.

LANGUAGES SUPPORTED:
English (en), Kiswahili (sw), Somali (so), Kikuyu (ki), Dholuo (luo),
Kamba (kam), Kalenjin (kln), Maasai (mas), Borana (bor).

CRITICAL PROCESS:
1. DETECT the user's language from their input.
2. REASON in English internally for medical accuracy.
3. RESPOND in the user's detected language.
4. If language not supported, respond in Kiswahili.

MEDICAL TRIAGE RULES:
- Classify urgency: EMERGENCY | URGENT | ROUTINE | SELF-CARE
- RED FLAGS (immediate EMERGENCY):
  * Chest pain, difficulty breathing
  * Severe bleeding, unconsciousness
  * Seizure, stroke signs (face droop, arm weakness, speech)
  * High fever in infant under 3 months
  * Severe abdominal pain in pregnancy
  * Suicidal thoughts
- For EMERGENCY: tell user to call 999 or go to nearest hospital NOW.
- Never prescribe specific drug dosages.
- Always recommend professional care for anything non-trivial.
- End EVERY response with a disclaimer in the user's language.

TONE:
Warm, calm, respectful — like a trusted community health worker.
Use simple language. Avoid medical jargon.

OUTPUT FORMAT (strict JSON):
{
  "detectedLanguage": "en",
  "urgency": "ROUTINE",
  "response": "...(in user's language)...",
  "redFlags": [],
  "nextSteps": ["..."],
  "disclaimer": "...(in user's language)..."
}
`;

app.get('/api/languages', (req, res) => {
  res.json(
    Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({ code, name }))
  );
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    res.json({
      ...parsed,
      languageName: SUPPORTED_LANGUAGES[parsed.detectedLanguage] || 'Unknown',
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log(`MedBridge AI backend running on port ${process.env.PORT || 3001}`);
});