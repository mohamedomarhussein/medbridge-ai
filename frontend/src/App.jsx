import { useState, useRef, useEffect } from 'react';

const URGENCY_COLORS = {
  EMERGENCY: 'bg-red-100 border-red-500 text-red-900',
  URGENT: 'bg-orange-100 border-orange-500 text-orange-900',
  ROUTINE: 'bg-blue-100 border-blue-500 text-blue-900',
  'SELF-CARE': 'bg-green-100 border-green-500 text-green-900',
};

const LANG_TO_VOICE = {
  en: 'en-KE',
  sw: 'sw-KE',
  so: 'so-SO',
  ki: 'en-KE',
  luo: 'en-KE',
  kam: 'en-KE',
  kln: 'en-KE',
  mas: 'en-KE',
  bor: 'so-SO',
};

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function speak(text, langCode = 'en') {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_TO_VOICE[langCode] || 'en-KE';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function startListening() {
    setVoiceError('');
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

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

    recognition.onstart = () => {
      setListening(true);
      setVoiceError('');
    };

    recognition.onend = () => setListening(false);

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error, e.message);
      setListening(false);

      const messages = {
        'not-allowed': 'Microphone blocked. Click the 🔒 in the address bar → allow Microphone → refresh.',
        'service-not-allowed': 'Browser blocked speech service. Try real Google Chrome (not Chromium).',
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

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setVoiceError('Could not start voice recognition: ' + err.message);
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      console.error(err);
    }
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              MedBridge <span className="text-sky-500">AI</span>
            </h1>
            <p className="text-sm text-gray-500">
              Your bridge to better health — in your language
            </p>
          </div>
          <button
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
              voiceEnabled
                ? 'bg-sky-500 text-white border-sky-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-sky-500'
            }`}
          >
            {voiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              How are you feeling today?
            </h2>
            <p className="text-gray-500 mb-8">
              Describe your symptoms in any language.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
              {[
                'I have a headache and fever',
                'Nina kichwa na homa',
                'I have chest pain',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="p-3 bg-white border rounded-lg text-sm hover:border-sky-500 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`mb-4 ${m.role === 'user' ? 'text-right' : ''}`}>
            {m.role === 'user' ? (
              <span className="inline-block bg-sky-500 text-white px-4 py-2 rounded-2xl max-w-md text-left">
                {m.text}
              </span>
            ) : (
              <div className="bg-white rounded-2xl p-4 shadow-sm max-w-2xl">
                {m.urgency && (
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${
                      URGENCY_COLORS[m.urgency] || 'bg-gray-100'
                    }`}
                  >
                    {m.urgency}
                  </div>
                )}
                <p className="text-gray-800 whitespace-pre-wrap">{m.text}</p>

                {m.redFlags?.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-800 mb-1">
                      ⚠️ Warning signs:
                    </p>
                    <ul className="text-sm text-red-700 list-disc list-inside">
                      {m.redFlags.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.nextSteps?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Next steps:
                    </p>
                    <ul className="text-sm text-gray-600 list-disc list-inside">
                      {m.nextSteps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.disclaimer && (
                  <p className="mt-3 text-xs text-gray-400 italic border-t pt-2">
                    {m.disclaimer}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  {m.language && (
                    <p className="text-xs text-gray-400">
                      Detected: {m.language}
                    </p>
                  )}
                  <button
                    onClick={() => speak(m.text, m.langCode || 'en')}
                    className="text-xs text-sky-500 hover:text-sky-600 font-medium"
                  >
                    🔊 Read aloud
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="text-gray-400 text-sm italic">
            MedBridge AI is thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer className="bg-white border-t">
        <div className="max-w-4xl mx-auto px-4 py-4 flex gap-2 items-center">
          <button
            onClick={listening ? stopListening : startListening}
            className={`px-4 py-3 rounded-xl font-medium transition ${
              listening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={listening ? 'Stop listening' : 'Start voice input'}
          >
            {listening ? '⏹️' : '🎤'}
          </button>
          <input
            className="flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Describe your symptoms... (any language)"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading}
            className="bg-sky-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-sky-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        {listening && (
          <p className="text-center text-sm text-red-500 pb-2">
            🎤 Listening... speak now
          </p>
        )}
        {voiceError && (
          <p className="text-center text-sm text-orange-600 bg-orange-50 py-2 px-4">
            ⚠️ {voiceError}
          </p>
        )}
      </footer>
    </div>
  );
}