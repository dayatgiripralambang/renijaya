import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#64748B'];

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProduk: 0,
    stokMenipis: 0,
    totalTransaksi: 0,
    totalPendapatan: 0,
    totalKas: 0,
    totalKategori: 0,
    totalSupplier: 0,
    totalPromoAktif: 0,
    // --- State Baru ---
    penjualanHariIni: 0,
    customerHariIni: 0,
    kasMasukHariIni: 0,
    kasKeluarHariIni: 0
  });

  const [charts, setCharts] = useState({
    trendPendapatan: [],
    produkTerlaris: [],
    kategoriProduk: []
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        { data: dataProduk },
        { count: countStok },
        { data: dataTransaksi },
        { data: dataDetailTransaksi },
        { data: dataKas },
        { count: countKategori },
        { count: countSupplier },
        { count: countPromo }
      ] = await Promise.all([
        supabase.from('produk').select('kategori').eq('is_deleted', false),
        supabase.from('produk').select('*', { count: 'exact', head: true }).eq('is_deleted', false).lte('stok', 5),
        supabase.from('transaksi').select('tanggal, total_harga').eq('is_deleted', false),
        supabase.from('detail_transaksi').select('nama_produk, jumlah').eq('is_deleted', false),
        supabase.from('kas').select('jumlah, tipe, created_at, tanggal').eq('is_deleted', false), // Menambahkan kolom waktu kas
        supabase.from('kategori').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('supplier').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('diskon').select('*', { count: 'exact', head: true }).eq('is_deleted', false).eq('is_aktif', true)
      ]);

      // --- DEKLARASI WAKTU HARI INI ---
      const now = new Date();
      // Mengambil timestamp (milidetik) pada pukul 00:00:00 hari ini
      const startOfDayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      // --- KALKULASI DATA HARIAN ---
      let penjualanHariIni = 0;
      let customerHariIni = 0;
      let kasMasukHariIni = 0;
      let kasKeluarHariIni = 0;

      // Filter Transaksi Hari Ini
      const totalTransaksi = dataTransaksi?.length || 0;
      const totalPendapatan = dataTransaksi?.reduce((sum, item) => {
          // Asumsi item.tanggal menyimpan timestamp ms
          if (Number(item.tanggal) >= startOfDayMs) {
              penjualanHariIni += (item.total_harga || 0);
              customerHariIni += 1;
          }
          return sum + (item.total_harga || 0);
      }, 0) || 0;

      // Filter Kas Hari Ini & Total Kas
      const totalKas = dataKas?.reduce((sum, item) => {
          // Deteksi tanggal kas, menggunakan item.tanggal jika ada, jika tidak gunakan item.created_at
          const kasDate = item.tanggal ? Number(item.tanggal) : new Date(item.created_at).getTime();
          
          if (kasDate >= startOfDayMs) {
              if (item.tipe === 'masuk') kasMasukHariIni += item.jumlah;
              else kasKeluarHariIni += item.jumlah;
          }

          return item.tipe === 'masuk' ? sum + item.jumlah : sum - item.jumlah;
      }, 0) || 0;

      setStats({
        totalProduk: dataProduk?.length || 0,
        stokMenipis: countStok || 0,
        totalTransaksi,
        totalPendapatan,
        totalKas,
        totalKategori: countKategori || 0,
        totalSupplier: countSupplier || 0,
        totalPromoAktif: countPromo || 0,
        penjualanHariIni,
        customerHariIni,
        kasMasukHariIni,
        kasKeluarHariIni
      });

      // --- KALKULASI DATA GRAFIK ---
      const trendMap = {};
      dataTransaksi?.forEach(t => {
        const dateObj = new Date(Number(t.tanggal));
        const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        trendMap[dateStr] = (trendMap[dateStr] || 0) + (t.total_harga || 0);
      });
      const trendArray = Object.keys(trendMap).map(key => ({
        tanggal: key,
        pendapatan: trendMap[key]
      }));

      const produkMap = {};
      dataDetailTransaksi?.forEach(d => {
        const nama = d.nama_produk || 'Tidak Diketahui';
        produkMap[nama] = (produkMap[nama] || 0) + (d.jumlah || 0);
      });
      const topProdukArray = Object.keys(produkMap)
        .map(key => ({ nama: key, terjual: produkMap[key] }))
        .sort((a, b) => b.terjual - a.terjual)
        .slice(0, 5);

      const kategoriMap = {};
      dataProduk?.forEach(p => {
        const kat = p.kategori || 'Tanpa Kategori';
        kategoriMap[kat] = (kategoriMap[kat] || 0) + 1;
      });
      const kategoriArray = Object.keys(kategoriMap)
        .map(key => ({ name: key, value: kategoriMap[key] }))
        .sort((a, b) => b.value - a.value);

      setCharts({
        trendPendapatan: trendArray,
        produkTerlaris: topProdukArray,
        kategoriProduk: kategoriArray
      });

    } catch (error) {
      console.error("Gagal memuat data dashboard:", error);
    }
    setLoading(false);
  };

  const formatRupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  if (loading) return <div className="p-4 text-center text-gray-500 font-medium">Memuat analisis lengkap dan merender grafik...</div>;

  // Struktur Array untuk rendering Kartu
  const cards = [
    // --- BARIS 1: DATA HARI INI ---
    { label: "Penjualan Hari Ini", value: `Rp ${stats.penjualanHariIni.toLocaleString('id-ID')}`, color: "border-blue-500", text: "text-blue-700", bg: "bg-blue-50" },
    { label: "Customer Hari Ini", value: `${stats.customerHariIni} Orang`, color: "border-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50" },
    { label: "Kas Masuk Hari Ini", value: `Rp ${stats.kasMasukHariIni.toLocaleString('id-ID')}`, color: "border-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Kas Keluar Hari Ini", value: `Rp ${stats.kasKeluarHariIni.toLocaleString('id-ID')}`, color: "border-red-500", text: "text-red-700", bg: "bg-red-50" },
    
    // --- BARIS 2 & 3: DATA AKUMULASI KESELURUHAN ---
    { label: "Total Pendapatan (All Time)", value: `Rp ${stats.totalPendapatan.toLocaleString('id-ID')}`, color: "border-green-500", text: "text-gray-800", bg: "bg-white" },
    { label: "Saldo Kas Bersih", value: `Rp ${stats.totalKas.toLocaleString('id-ID')}`, color: "border-teal-500", text: "text-gray-800", bg: "bg-white" },
    { label: "Total Transaksi (All Time)", value: stats.totalTransaksi, color: "border-sky-500", text: "text-gray-800", bg: "bg-white" },
    { label: "Promo Aktif", value: stats.totalPromoAktif, color: "border-yellow-500", text: "text-gray-800", bg: "bg-white" },
    { label: "Total Produk", value: stats.totalProduk, color: "border-purple-500", text: "text-gray-800", bg: "bg-white" },
    { label: "Kategori Produk", value: stats.totalKategori, color: "border-fuchsia-500", text: "text-gray-800", bg: "bg-white" },
    { label: "Supplier Aktif", value: stats.totalSupplier, color: "border-orange-500", text: "text-gray-800", bg: "bg-white" },
    { label: "Stok Menipis", value: `${stats.stokMenipis} Item`, color: "border-red-600", text: "text-red-600", bg: "bg-white" },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Dashboard Analisa Lengkap</h2>
      
      {/* Kumpulan Kartu Indikator */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card, idx) => (
            <div key={idx} className={`${card.bg} p-6 rounded-lg shadow-sm border-l-4 ${card.color}`}>
                <p className="text-sm text-gray-500 mb-1 font-medium">{card.label}</p>
                <h3 className={`text-xl font-bold ${card.text}`}>{card.value}</h3>
            </div>
        ))}
      </div>

      {/* Area Grafik Visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Grafik Tren Pendapatan */}
        <div className="bg-white p-6 rounded-lg shadow-sm border col-span-1 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-700 mb-4">Tren Pendapatan</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.trendPendapatan} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="tanggal" tick={{fontSize: 12}} stroke="#9CA3AF" />
                <YAxis tickFormatter={(value) => `Rp ${value / 1000}k`} tick={{fontSize: 12}} stroke="#9CA3AF" />
                <Tooltip formatter={(value) => formatRupiah(value)} labelStyle={{color: '#374151', fontWeight: 'bold'}} />
                <Legend />
                <Line type="monotone" dataKey="pendapatan" name="Pendapatan (Rp)" stroke="#10B981" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grafik 5 Produk Terlaris */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-bold text-gray-700 mb-4">Top 5 Produk Terlaris</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.produkTerlaris} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" tick={{fontSize: 12}} stroke="#9CA3AF" />
                <YAxis dataKey="nama" type="category" tick={{fontSize: 11}} width={100} stroke="#9CA3AF" />
                <Tooltip cursor={{fill: '#F3F4F6'}} formatter={(value) => [`${value} item`, 'Terjual']} />
                <Bar dataKey="terjual" name="Total Terjual" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grafik Proporsi Kategori */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-bold text-gray-700 mb-4">Sebaran Kategori Produk</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.kategoriProduk}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {charts.kategoriProduk.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} Produk`, 'Jumlah']} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}