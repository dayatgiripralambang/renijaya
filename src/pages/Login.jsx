import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage({ text: 'Email atau password salah.', type: 'error' });
      setLoading(false);
      return;
    }

    // 2. Ambil Role Pengguna dari tabel public.users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (userError || !userData) {
      setMessage({ text: 'Gagal memuat profil pengguna.', type: 'error' });
      await supabase.auth.signOut();
    } 
    // 3. Blokir spesifik untuk Kasir
    else if (userData.role === 'kasir') {
      setMessage({ text: 'Akses Ditolak: Akun Kasir tidak diizinkan masuk ke Web Admin. Silakan gunakan Aplikasi Kasir.', type: 'error' });
      await supabase.auth.signOut();
    } 
    // 4. Blokir untuk role lain yang tidak valid (jika ada)
    else if (userData.role !== 'superuser' && userData.role !== 'admin') {
      setMessage({ text: 'Akses ditolak. Web admin hanya untuk Superuser dan Admin.', type: 'error' });
      await supabase.auth.signOut();
    } 
    // 5. Beri akses untuk Admin & Superuser
    else {
      const sessionWithRole = { ...data.session, role: userData.role };
      onLoginSuccess(sessionWithRole);
    }
    
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-gray-100">
        <div className="text-center mb-8">
          <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            Masuk Web Admin
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Masukkan kredensial Admin / Superuser
          </p>
        </div>

        {message.text && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-emerald-500 block p-3.5 outline-none"
              placeholder="admin@toko.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-emerald-500 block p-3.5 outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition disabled:opacity-70"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}