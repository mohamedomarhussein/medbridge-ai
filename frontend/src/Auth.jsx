import { useState } from 'react';
import { supabase } from './supabase';

export default function Auth() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        alert('Account created! You can now sign in.');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen bg-[#FBF8F4] flex items-center justify-center px-6 py-12"
      style={{ fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif' }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-br from-orange-300 to-rose-300 items-center justify-center shadow-md mb-4">
            <span className="text-3xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold text-[#3D2B1F] mb-2">MedBridge AI</h1>
          <p className="text-[15px] text-[#7A6A5C]">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-orange-100 p-7">
          {mode === 'signup' && (
            <div className="mb-4">
              <label className="block text-[12px] font-bold text-[#A89585] uppercase tracking-wider mb-2">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border-2 border-orange-100 focus:border-orange-300 focus:outline-none text-[15px] text-[#3D2B1F] bg-white transition-colors"
                placeholder="e.g., Mohamed Omar"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[12px] font-bold text-[#A89585] uppercase tracking-wider mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl border-2 border-orange-100 focus:border-orange-300 focus:outline-none text-[15px] text-[#3D2B1F] bg-white transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-5">
            <label className="block text-[12px] font-bold text-[#A89585] uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-2xl border-2 border-orange-100 focus:border-orange-300 focus:outline-none text-[15px] text-[#3D2B1F] bg-white transition-colors"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200">
              <p className="text-[13px] text-rose-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-400 text-white font-bold text-[15px] hover:shadow-lg hover:shadow-orange-200 disabled:opacity-50 transition-all"
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="text-[13px] text-[#7A6A5C] hover:text-[#3D2B1F] font-semibold"
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] text-[#A89585] mt-6 leading-relaxed">
          MedBridge AI provides general health information only. Not a substitute for professional medical advice.
        </p>
      </div>
    </div>
  );
}
