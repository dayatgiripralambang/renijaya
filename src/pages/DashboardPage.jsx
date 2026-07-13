import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProduk: 0,
    stokMenipis: 0,
    totalTransaksi: 0,
    totalPendapatan: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Ambil Total Produk
      const { count: countProduk } = await supabase
        .from('produk')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false);

      // 2. Ambil Stok Menipis (Stok di bawah atau sama dengan 5)
      const { count: countStok } = await supabase
        .from('produk')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .lte('stok', 5);

      // 3. Ambil Data Transaksi (Sesuaikan dengan nama tabel transaksi Anda)
      // Asumsi tabel bernama 'transaksi' dan kolom total bernama 'total_harga'
      const { data: dataTransaksi } = await supabase
        .from('transaksi')
        .select('total_harga');

      let totalPendapatan = 0;
      let totalTransaksi = 0;

      if (dataTransaksi) {
        totalTransaksi = dataTransaksi.length;
        totalPendapatan = dataTransaksi.reduce((sum, item) => sum + (item.total_harga || 0), 0);
      }

      setStats({
        totalProduk: countProduk || 0,
        stokMenipis: countStok || 0,
        totalTransaksi: totalTransaksi,
        totalPendapatan: totalPendapatan
      });
    } catch (error) {
      console.error("Gagal memuat data dashboard:", error);
    }
    setLoading(false);
  };

  if (loading) return <div className="p-4">Memuat data analisis...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Dashboard Analisa</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card Pendapatan */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-sm text-gray-500 mb-1">Total Pendapatan</p>
          <h3 className="text-2xl font-bold text-gray-800">
            Rp {stats.totalPendapatan.toLocaleString('id-ID')}
          </h3>
        </div>

        {/* Card Transaksi */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-sm text-gray-500 mb-1">Total Transaksi</p>
          <h3 className="text-2xl font-bold text-gray-800">
            {stats.totalTransaksi.toLocaleString('id-ID')}
          </h3>
        </div>

        {/* Card Total Produk */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-sm text-gray-500 mb-1">Total Produk Aktif</p>
          <h3 className="text-2xl font-bold text-gray-800">
            {stats.totalProduk.toLocaleString('id-ID')}
          </h3>
        </div>

        {/* Card Stok Menipis */}
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-sm text-gray-500 mb-1">Peringatan Stok Menipis</p>
          <h3 className="text-2xl font-bold text-red-600">
            {stats.stokMenipis.toLocaleString('id-ID')} Item
          </h3>
        </div>

      </div>
    </div>
  );
}