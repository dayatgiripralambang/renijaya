import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './pages/Login';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ProdukPage from './pages/ProdukPage';
import KategoriPage from './pages/KategoriPage';
import SupplierPage from './pages/SupplierPage';
import LaporanTransaksi from './pages/LaporanTransaksi';
import LaporanStok from './pages/LaporanStok';
import LaporanKas from './pages/LaporanKas';
import Diskon from './pages/Diskon';
import ProfilToko from './pages/ProfilToko';
import ManajemenUser from './pages/ManajemenUser';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true); // <--- Tetap true
  const [currentTab, setCurrentTab] = useState('dashboard');

  useEffect(() => {
    // Fungsi untuk inisialisasi sesi
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await checkAccess(session);
      }
      setLoading(false); // <--- WAJIB: Matikan loading setelah cek selesai
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkAccess(session);
      } else {
        setSession(null);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const checkAccess = async (session) => {
    // Tambahkan try-catch agar aplikasi tidak crash jika koneksi gagal
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (userData && (userData.role === 'admin' || userData.role === 'superuser')) {
        setSession({ ...session, role: userData.role });
      } else {
        await supabase.auth.signOut();
        setSession(null);
      }
    } catch (err) {
      console.error("Error checking access:", err);
      await supabase.auth.signOut();
      setSession(null);
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'produk':
        return <ProdukPage />;
      case 'laporan_transaksi':
        return <LaporanTransaksi />;
      case 'laporan_stok':
        return <LaporanStok />;
      case 'laporan_kas':
        return <LaporanKas />;
      case 'diskon':
        return <Diskon />;
      case 'kategori':
        return <KategoriPage />;
      case 'supplier':
        return <SupplierPage />;
      case 'profil':
        return <ProfilToko />;
      case 'manajemen_user':
        return <ManajemenUser />;
      default:
        return <DashboardPage />;
    }
  };

  // Tampilkan indikator loading saat mengecek sesi
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-500 font-medium">Memuat sistem...</p>
      </div>
    );
  }

  // Arahkan ke halaman Login jika belum ada sesi aktif
  if (!session) {
    return <Login onLoginSuccess={setSession} />;
  }

  // Tampilkan Layout dan Konten Utama jika sudah login
  return (
    <Layout currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {renderContent()}
    </Layout>
  );
}