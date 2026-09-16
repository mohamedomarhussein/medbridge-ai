import { useState, useRef, useEffect } from 'react';

const URGENCY_STYLES = {
  EMERGENCY: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    badge: 'bg-red-500 text-white',
    pulse: 'animate-pulse',
  },
  URGENT: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    badge: 'bg-orange-500 text-white',
  },
  ROUTINE: {
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    badge: 'bg-sky-500 text-white',
  },
  'SELF-CARE': {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    badge: 'bg-emerald-500 text-white',
  },
};

const LANG_TO_VOICE = {
  en: 'en-KE', sw: 'sw-KE', so: 'en-KE', ki: 'en-KE',
  luo: 'en-KE', kam: 'en-KE', kln: 'en-KE', mas: 'en-KE', bor: 'en-KE',
};

const COMMON_SYMPTOMS = [
  { label: '🤕 Headache', text: 'I have a headache' },
  { label: '🌡️ Fever', text: 'I have a fever' },
  { label: '😮‍💨 Cough', text: 'I have a cough' },
  { label: '❤️ Chest pain', text: 'I have chest pain' },
  { label: '🤢 Stomach ache', text: 'I have a stomach ache' },
  { label: '💧 Diarrhea', text: 'I have diarrhea' },
  { label: '😴 Fatigue', text: 'I feel very tired' },
  { label: '🤧 Runny nose', text: 'I have a runny nose' },
];

const MULTILINGUAL_DEMOS = [
  { label: '🇬🇧 English', text: 'I have a headache and fever' },
  { label: '🇰🇪 Kiswahili', text: 'Nina kichwa na homa' },
  { label: '🇰🇪 Kikuyu', text: 'Nĩ ndwarira mũtwe' },
  { label: '🇸🇴 Somali', text: 'Madax iyo xumad ayaan qabaa' },
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
      setVoiceError('Voice input not supported in this browser. Use Chrome or Edge.');
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
        'not-allowed': 'Microphone blocked. Click the 🔒 in the address bar → allow Microphone → refresh.',
        'service-not-allowed': 'Browser blocked speech service. Try real Google Chrome.',
        'no-speech': 'No speech detected. Speak louder or check your mic.',
        'audio-capture': 'No microphone found. Check system sound settings.',
        'network': 'Network error. Web Speech API needs internet to Google servers.',
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
      setVoiceError('Could not start voice recognition: ' + err.message);
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
      if (!data.response) throw new Error('Invalid response from server');
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
        { role: 'ai', text: 'Sorry, something went wrong. Please try again.' },
      ]);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <span className="text-2xl">🌉</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                MedBridge <span className="bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">AI</span>
              </h1>
              <p className="text-xs text-slate-500">
                Your bridge to better health
              </p>
            </div>
          </div>
          <button
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
              voiceEnabled
                ? 'bg-teal-500 text-white border-teal-500 shadow-lg shadow-teal-500/30'
                : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'
            }`}
          >
            <span>{voiceEnabled ? '🔊' : '🔇'}</span>
            <span className="hidden sm:inline">{voiceEnabled ? 'Voice ON' : 'Voice OFF'}</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 overflow-y-auto">
        {messages.length === 0 && (
          <div className="py-6">
            {/* Hero */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold mb-4">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                Powered by Gemini · 9 Languages
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3 tracking-tight">
                How are you <span className="bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">feeling</span> today?
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto">
                Describe your symptoms in any language — English, Kiswahili, Kikuyu, Somali, or more.
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              {/* Symptoms */}
              <div className="mb-8">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-6 h-px bg-slate-300"></span>
                  Common symptoms
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {COMMON_SYMPTOMS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setInput(s.text)}
                      className="group p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-6 h-px bg-slate-300"></span>
                  Try in your language
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {MULTILINGUAL_DEMOS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setInput(s.text)}
                      className="group p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => (
          <div key={i} className={`mb-5 ${m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
            {m.role === 'user' ? (
              <div className="flex items-end gap-2 max-w-md">
                <span className="inline-block bg-gradient-to-br from-teal-500 to-emerald-500 text-white px-4 py-2.5 rounded-2xl rounded-br-sm shadow-lg shadow-teal-500/20 text-sm">
                  {m.text}
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-3 max-w-2xl w-full">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-md shadow-teal-500/20 text-white text-sm">
                  🌉
                </div>
                <div className="flex-1 bg-white rounded-2xl rounded-tl-sm p-5 shadow-sm border border-slate-100">
                  {m.urgency && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-3 tracking-wide ${
                        URGENCY_STYLES[m.urgency]?.badge || 'bg-slate-100 text-slate-700'
                      } ${m.urgency === 'EMERGENCY' ? URGENCY_STYLES.EMERGENCY.pulse : ''}`}
                    >
                      {m.urgency === 'EMERGENCY' && '🚨'}
                      {m.urgency === 'URGENT' && '⚠️'}
                      {m.urgency === 'ROUTINE' && 'ℹ️'}
                      {m.urgency === 'SELF-CARE' && '✓'}
                      {m.urgency}
                    </div>
                  )}
                  <p className="text-slate-800 leading-relaxed whitespace-pre-wrap text-sm">
                    {m.text}
                  </p>

                  {m.redFlags?.length > 0 && (
                    <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                      <p className="text-xs font-bold text-red-800 mb-2 uppercase tracking-wide">
                        ⚠️ Warning signs
                      </p>
                      <ul className="text-sm text-red-700 space-y-1">
                        {m.redFlags.map((f, i) => (
                          <li key={i} className="flex gap-2">
                            <span>•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {m.nextSteps?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                        Next steps
                      </p>
                      <ul className="text-sm text-slate-700 space-y-1.5">
                        {m.nextSteps.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-teal-500 font-bold">›</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {m.disclaimer && (
                    <p className="mt-4 text-[11px] text-slate-400 italic border-t border-slate-100 pt-3">
                      {m.disclaimer}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    {m.language && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                        Detected: <span className="font-semibold text-slate-500">{m.language}</span>
                      </p>
                    )}
                    <button
                      onClick={() => speak(m.text, m.langCode || 'en')}
                      className="text-[11px] text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
                    >
                      🔊 Read aloud
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3 max-w-2xl">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-md text-white text-sm">
              🌉
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{animationDelay: '0ms'}}></span>
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{animationDelay: '150ms'}}></span>
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{animationDelay: '300ms'}}></span>
              <span className="text-xs text-slate-500 ml-2">MedBridge AI is thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* Footer Input */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200 sticky bottom-0">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex gap-2 items-center bg-white rounded-2xl border border-slate-200 p-1.5 shadow-lg shadow-slate-200/50 focus-within:border-teal-400 focus-within:shadow-teal-200/50 transition-all">
            <button
              onClick={listening ? stopListening : startListening}
              className={`shrink-0 w-11 h-11 rounded-xl font-medium transition flex items-center justify-center ${
                listening
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-600'
              }`}
              title={listening ? 'Stop listening' : 'Start voice input'}
            >
              {listening ? '⏹️' : '🎤'}
            </button>
            <input
              className="flex-1 bg-transparent border-0 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Describe your symptoms... (any language)"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="shrink-0 bg-gradient-to-br from-teal-500 to-emerald-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-teal-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Send →
            </button>
          </div>

          {listening && (
            <p className="text-center text-xs text-red-500 mt-2 font-medium">
              🎤 Listening... speak now
            </p>
          )}
          {voiceError && (
            <p className="text-center text-xs text-orange-600 bg-orange-50 py-2 px-4 mt-2 rounded-lg">
              ⚠️ {voiceError}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}