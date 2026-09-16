import { useState, useRef, useEffect } from 'react';

const URGENCY_STYLES = {
  EMERGENCY: {
    badge: 'bg-red-600 text-white',
    ring: 'ring-red-200',
    label: 'Emergency',
  },
  URGENT: {
    badge: 'bg-amber-500 text-white',
    ring: 'ring-amber-200',
    label: 'Urgent',
  },
  ROUTINE: {
    badge: 'bg-sky-600 text-white',
    ring: 'ring-sky-200',
    label: 'Routine',
  },
  'SELF-CARE': {
    badge: 'bg-slate-600 text-white',
    ring: 'ring-slate-200',
    label: 'Self-care',
  },
};

const LANG_TO_VOICE = {
  en: 'en-KE', sw: 'sw-KE', so: 'en-KE', ki: 'en-KE',
  luo: 'en-KE', kam: 'en-KE', kln: 'en-KE', mas: 'en-KE', bor: 'en-KE',
};

const COMMON_SYMPTOMS = [
  { label: 'Headache', icon: '🤕', text: 'I have a headache' },
  { label: 'Fever', icon: '🌡️', text: 'I have a fever' },
  { label: 'Cough', icon: '😮‍💨', text: 'I have a cough' },
  { label: 'Chest pain', icon: '❤️', text: 'I have chest pain' },
  { label: 'Stomach ache', icon: '🤢', text: 'I have a stomach ache' },
  { label: 'Diarrhea', icon: '💧', text: 'I have diarrhea' },
  { label: 'Fatigue', icon: '😴', text: 'I feel very tired' },
  { label: 'Runny nose', icon: '🤧', text: 'I have a runny nose' },
];

const MULTILINGUAL_DEMOS = [
  { code: 'EN', label: 'English', text: 'I have a headache and fever' },
  { code: 'SW', label: 'Kiswahili', text: 'Nina kichwa na homa' },
  { code: 'KI', label: 'Kikuyu', text: 'Nĩ ndwarira mũtwe' },
  { code: 'SO', label: 'Somali', text: 'Madax iyo xumad ayaan qabaa' },
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const voicesRef = useRef([]);

  useEffect(() => {
    function loadVoices() {
      voicesRef.current = window.speechSynthesis?.getVoices() || [];
    }
    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function speak(text, langCode = 'en') {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const targetLang = LANG_TO_VOICE[langCode] || 'en-KE';
    const langPrefix = targetLang.split('-')[0];
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang === targetLang) ||
      voices.find((v) => v.lang.startsWith(langPrefix)) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || targetLang;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function startListening() {
    setVoiceError('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-KE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); setVoiceError(''); };
    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => {
      setListening(false);
      const messages = {
        'not-allowed': 'Microphone access denied. Enable it in your browser settings.',
        'service-not-allowed': 'Speech service unavailable. Please use Google Chrome.',
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'No microphone detected.',
        'network': 'Network error. Voice requires an internet connection.',
        'aborted': 'Listening stopped.',
      };
      setVoiceError(messages[e.error] || `Voice error: ${e.error}`);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + ' ' + transcript : transcript));
      setVoiceError('');
    };
    try { recognition.start(); } catch (err) {
      setVoiceError('Could not start voice input.');
    }
  }

  function stopListening() {
    try { recognitionRef.current?.stop(); } catch (err) {}
    setListening(false);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', text: input };
    setMessages((m) => [...m, userMsg]);
    const currentInput = input;
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (!data.response) throw new Error('Invalid response');
      setMessages((m) => [
        ...m,
        {
          role: 'ai',
          text: data.response,
          urgency: data.urgency,
          redFlags: data.redFlags || [],
          nextSteps: data.nextSteps || [],
          disclaimer: data.disclaimer,
          language: data.languageName,
          langCode: data.detectedLanguage,
        },
      ]);
      if (voiceEnabled) speak(data.response, data.detectedLanguage);
    } catch (err) {
      console.error(err);
      setMessages((m) => [
        ...m,
        { role: 'ai', text: 'Something went wrong. Please try again.' },
      ]);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">
                MedBridge AI
              </h1>
              <p className="text-[11px] text-slate-500 tracking-wide">
                Multilingual Health Triage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceEnabled((v) => !v)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition ${
                voiceEnabled
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {voiceEnabled ? 'Voice On' : 'Voice Off'}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 overflow-y-auto">
        {messages.length === 0 && (
          <div className="py-4">
            {/* Hero */}
            <div className="mb-10">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-3">
                Health Assistant
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 tracking-tight leading-tight mb-3">
                Describe your symptoms.
              </h2>
              <p className="text-[15px] text-slate-600 leading-relaxed max-w-xl">
                Get preliminary health guidance in English, Kiswahili, Kikuyu, Somali, and more.
                MedBridge AI helps you understand your symptoms and find the right next step.
              </p>
            </div>

            {/* Symptoms */}
            <section className="mb-8">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-3">
                Common symptoms
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {COMMON_SYMPTOMS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setInput(s.text)}
                    className="group text-left px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-slate-900 hover:shadow-sm transition-all"
                  >
                    <span className="text-lg block mb-1.5 opacity-80">{s.icon}</span>
                    <span className="text-[13px] font-medium text-slate-700 group-hover:text-slate-900">
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Languages */}
            <section>
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.15em] mb-3">
                Supported languages
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {MULTILINGUAL_DEMOS.map((s) => (
                  <button
                    key={s.code}
                    onClick={() => setInput(s.text)}
                    className="text-left px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-slate-900 hover:shadow-sm transition-all"
                  >
                    <span className="text-[10px] font-semibold text-slate-400 tracking-wider block mb-1">
                      {s.code}
                    </span>
                    <span className="text-[13px] font-medium text-slate-700">
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => (
          <div key={i} className="mb-6">
            {m.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-slate-900 text-white px-4 py-2.5 rounded-lg text-[14px] leading-relaxed">
                  {m.text}
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="w-8 h-8 shrink-0 rounded-md bg-slate-900 flex items-center justify-center mt-0.5">
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white">
                    <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-semibold text-slate-900">
                      MedBridge AI
                    </span>
                    {m.urgency && (
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${URGENCY_STYLES[m.urgency]?.badge || 'bg-slate-200 text-slate-700'}`}>
                        {URGENCY_STYLES[m.urgency]?.label || m.urgency}
                      </span>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {m.text}
                    </p>

                    {m.redFlags?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-2">
                          Warning Signs
                        </p>
                        <ul className="space-y-1">
                          {m.redFlags.map((f, i) => (
                            <li key={i} className="text-[13px] text-slate-700 flex gap-2">
                              <span className="text-red-500 mt-1">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {m.nextSteps?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Recommended Next Steps
                        </p>
                        <ol className="space-y-1.5">
                          {m.nextSteps.map((s, i) => (
                            <li key={i} className="text-[13px] text-slate-700 flex gap-2">
                              <span className="text-slate-400 font-mono text-[11px] mt-0.5">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {m.disclaimer && (
                      <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
                        {m.disclaimer}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    {m.language && (
                      <span>Detected: {m.language}</span>
                    )}
                    <button
                      onClick={() => speak(m.text, m.langCode || 'en')}
                      className="text-slate-500 hover:text-slate-900 font-medium transition"
                    >
                      Read aloud
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 shrink-0 rounded-md bg-slate-900 flex items-center justify-center mt-0.5">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white">
                <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-slate-900 mb-2">
                MedBridge AI
              </p>
              <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-2">
                <span className="text-[13px] text-slate-400">Analyzing symptoms</span>
                <span className="flex gap-1">
                  <span className="w-1 h-1 rounded-full bg-slate-400 animate-pulse"></span>
                  <span className="w-1 h-1 rounded-full bg-slate-400 animate-pulse" style={{animationDelay: '150ms'}}></span>
                  <span className="w-1 h-1 rounded-full bg-slate-400 animate-pulse" style={{animationDelay: '300ms'}}></span>
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* Footer Input */}
      <footer className="bg-white border-t border-slate-200 sticky bottom-0">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg focus-within:border-slate-900 transition-colors">
            <button
              onClick={listening ? stopListening : startListening}
              className={`shrink-0 w-10 h-10 ml-1 rounded-md transition flex items-center justify-center ${
                listening
                  ? 'bg-red-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title={listening ? 'Stop' : 'Voice input'}
            >
              {listening ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <rect x="6" y="6" width="12" height="12" rx="1"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                  <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>

            <input
              className="flex-1 bg-transparent border-0 px-2 py-3 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Describe your symptoms…"
              disabled={loading}
            />

            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="shrink-0 m-1 bg-slate-900 text-white px-5 py-2 rounded-md font-medium text-[13px] hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>

          {listening && (
            <p className="text-center text-[11px] text-red-600 mt-2 font-medium">
              Listening…
            </p>
          )}
          {voiceError && (
            <p className="text-center text-[11px] text-amber-700 bg-amber-50 py-2 px-3 mt-2 rounded-md border border-amber-200">
              {voiceError}
            </p>
          )}

          <p className="text-center text-[10px] text-slate-400 mt-3 leading-relaxed">
            MedBridge AI provides general health information and is not a substitute for professional medical advice.
          </p>
        </div>
      </footer>
    </div>
  );
}