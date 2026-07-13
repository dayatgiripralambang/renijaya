import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Layout({ children, currentTab, setCurrentTab }) {
  const [namaToko, setNamaToko] = useState('Memuat...');

  const menuItems = [
    { id: 'dashboard', label: '1. Dashboard' },
    { id: 'produk', label: '2. Manajemen Produk' },
    { id: 'laporan_transaksi', label: '3. Laporan Transaksi' },
    { id: 'laporan_stok', label: '4. Laporan Stok' },
    { id: 'laporan_kas', label: '5. Laporan Kas' },
    { id: 'diskon', label: '6. Setting Diskon' },
    { id: 'kategori', label: '7. Setting Kategori' },
    { id: 'supplier', label: '8. Setting Supplier' },
    { id: 'profil', label: '9. Profil Toko' },
    { id: 'manajemen_user', label: '10. Manajemen User' },
  ];

useEffect(() => {
    fetchProfilToko();

    const channel = supabase
      .channel('profil_toko_channel')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profil_toko' },
        (payload) => {
          if (payload.new && payload.new.nama_toko) {
            setNamaToko(payload.new.nama_toko); // Langsung update state
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProfilToko = async () => {
    const { data, error } = await supabase
      .from('profil_toko')
      .select('nama_toko')
      .limit(1)
      .maybeSingle();

    if (error || !data || !data.nama_toko) {
      setNamaToko('POS Admin'); // Fallback jika gagal atau data kosong
    } else {
      setNamaToko(data.nama_toko);
    }
  };

  const handleLogout = async () => {
    const confirmLogout = window.confirm('Apakah Anda yakin ingin keluar?');
    if (!confirmLogout) return;

    const { error } = await supabase.auth.signOut();
    
    if (error) {
      alert('Gagal memproses logout: ' + error.message);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* Sidebar - Fix lebar 64 (256px) */}
      <aside className="w-64 flex flex-col bg-gray-900 text-gray-300 shadow-xl h-full flex-shrink-0">
        
        {/* Box Header - padding px-4 agar sejajar */}
        <div className="px-4 py-6 text-center border-b border-gray-800 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white tracking-wide">{namaToko}</h2>
          <p className="text-xs text-emerald-500 mt-1">Sistem Manajemen Toko</p>
        </div>
        
        {/* Box Menu - padding px-4 agar sejajar */}
        {/* Tambahkan [&::-webkit-scrollbar]:hidden untuk mencegah scrollbar mengubah lebar tombol */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`block w-full text-left px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                currentTab === item.id 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Box Logout - padding px-4 agar sejajar */}
        <div className="px-4 py-4 border-t border-gray-800 bg-gray-900 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 font-semibold py-3 px-4 rounded-xl transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1 overflow-y-auto bg-gray-50 h-full relative">
        {children}
      </main>
    </div>
  );
}