import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ProfilToko() {
  const [formData, setFormData] = useState({
    nama_toko: '',
    alamat_toko: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfil();
  }, []);

  const fetchProfil = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profil_toko')
      .select('*')
      .eq('id', 1) 
      .single();

    if (data) {
      setFormData({
        nama_toko: data.nama_toko,
        alamat_toko: data.alamat_toko
      });
    }
    setLoading(false);
  };

const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      id: 1, 
      nama_toko: formData.nama_toko,
      alamat_toko: formData.alamat_toko,
      updated_at: Math.floor(Date.now()) // Pastikan angka bulat untuk bigint
    };

    // PERBAIKAN: Tambahkan onConflict dan .select()
    const { data, error } = await supabase
      .from('profil_toko')
      .upsert(payload, { onConflict: 'id' })
      .select();

    setSaving(false);

if (error) {
      alert(`Gagal menyimpan: ${error.message}`);
    } else {
      alert("Profil toko berhasil diperbarui!");
      fetchProfil();
      window.dispatchEvent(new CustomEvent('profilTokoDiupdate', { detail: formData.nama_toko }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-3"></div>
        <p className="text-gray-500 font-medium">Memuat profil toko...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header Section */}
      <div className="flex items-center gap-4 mb-8 border-b border-gray-200 pb-5">
        <div className="bg-emerald-100 p-3.5 rounded-xl text-emerald-600 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Profil Toko</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola informasi identitas dan alamat retail Anda.</p>
        </div>
      </div>
      
      {/* Form Section */}
      <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nama Toko
          </label>
          <input
            type="text"
            required
            placeholder="Masukkan nama toko..."
            value={formData.nama_toko}
            onChange={(e) => setFormData({ ...formData, nama_toko: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block p-3.5 transition-colors duration-200 outline-none"
          />
        </div>

        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Alamat Lengkap Toko
          </label>
          <textarea
            required
            rows="4"
            placeholder="Masukkan alamat lengkap toko retail..."
            value={formData.alamat_toko}
            onChange={(e) => setFormData({ ...formData, alamat_toko: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block p-3.5 transition-colors duration-200 outline-none resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-emerald-500/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Menyimpan Data...
            </>
          ) : (
            'Simpan Perubahan'
          )}
        </button>
      </form>
    </div>
  );
}