import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

// Fungsi format angka ke Rupiah
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka || 0);
};

export default function LaporanStok() {
    // 1. DEKLARASIKAN FUNGSI TANGGAL TERLEBIH DAHULU
    const getTodayDate = () => {
        const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 2. BARU PANGGIL FUNGSI TERSEBUT DI DALAM USESTATE
    const [tglAwal, setTglAwal] = useState(getTodayDate());
    const [tglAkhir, setTglAkhir] = useState(getTodayDate());

    // State Utama
    const [produk, setProduk] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('semua');
    const [loading, setLoading] = useState(false);

    // State Modal Riwayat
    const [historyModal, setHistoryModal] = useState({ isOpen: false, type: '' });
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        fetchStok();
    }, [statusFilter]);

    // Ambil Data Stok Saat Ini (Optimasi Server-Side Filtering)
    const fetchStok = async () => {
        setLoading(true);
        
        // 1. Deklarasi kueri dasar
        let query = supabase
            .from('produk')
            .select('*')
            .neq('is_deleted', true)
            .order('nama', { ascending: true });

        // 2. Tambahkan filter langsung ke kueri Supabase sebelum dieksekusi
        if (statusFilter === 'habis') {
            query = query.eq('stok', 0);
        } else if (statusFilter === 'menipis') {
            query = query.gt('stok', 0).lte('stok', 10);
        }

        // 3. Eksekusi kueri
        const { data, error } = await query;

        if (error) {
            console.error('Gagal menarik data produk:', error.message);
        } else {
            // Data sudah tersaring dari server, langsung set ke state
            setProduk(data || []);
        }
        
        setLoading(false);
    };

    // Ambil Data Riwayat Riil dari Supabase (Menggantikan Placeholder)
    const openGlobalHistory = async (type) => {
        if (!tglAwal || !tglAkhir) {
            alert("Silakan pilih 'Dari Tanggal' dan 'Sampai Tanggal' terlebih dahulu.");
            return;
        }

        setHistoryModal({ isOpen: true, type });
        setLoadingHistory(true);

        // Konversi dan Kunci ke Zona Waktu GMT+7 (WIB)
        const awalMs = new Date(`${tglAwal}T00:00:00+07:00`).getTime(); 
        const akhirMs = new Date(`${tglAkhir}T23:59:59.999+07:00`).getTime();

        const { data, error } = await supabase
            .from('riwayat_stok')
            .select(`
                id,
                tanggal,
                barcode,
                jumlah,
                keterangan,
                produk!inner ( nama ) 
            `)
            .eq('jenis', type)
            .gte('tanggal', awalMs) 
            .lte('tanggal', akhirMs)
            .order('tanggal', { ascending: false });

        if (error) {
            console.error('Gagal menarik data riwayat:', error.message);
            alert('Gagal memuat riwayat: ' + error.message);
            setHistoryModal({ isOpen: false, type: '' });
        } else {
            setHistoryData(data || []);
        }
        setLoadingHistory(false);
    };

    // Logika Pencarian
    const filteredProduk = produk.filter(item => 
        item.nama?.toLowerCase().includes(search.toLowerCase()) ||
        item.barcode?.toLowerCase().includes(search.toLowerCase())
    );

    // Pengelompokan Kategori
    const groupedData = filteredProduk.reduce((acc, item) => {
        const kategori = item.kategori || "Tanpa Kategori";
        if (!acc[kategori]) acc[kategori] = [];
        acc[kategori].push(item);
        return acc;
    }, {});

    const exportExcel = () => {
        if (filteredProduk.length === 0) return alert("Tidak ada data");
        // Diperbarui: Excel juga ikut menampikan nominal harga
        const dataFormat = filteredProduk.map(item => ({
            "Kategori": item.kategori || "Tanpa Kategori",
            "Barcode": item.barcode,
            "Nama Produk": item.nama,
            "Stok": item.stok,
            "Harga Beli": item.harga_modal,
            "Total Beli": item.harga_modal * item.stok,
            "Harga Jual": item.harga_jual,
            "Total Jual": item.harga_jual * item.stok
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataFormat);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Stok");
        XLSX.writeFile(workbook, "Laporan_Stok.xlsx");
    };

    return (
        <div className="p-6 relative">
            <h1 className="text-2xl font-bold mb-6">Laporan Stok & Inventaris</h1>

            {/* Panel Kontrol & Filter */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex flex-wrap gap-4 items-end justify-between">
                <div className="flex flex-wrap gap-4 items-end w-full lg:w-auto">
                    <div className="min-w-[200px]">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Cari Produk</label>
                        <input 
                            type="text" 
                            placeholder="Nama atau barcode..."
                            className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Status Stok</label>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-gray-300 p-2 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="semua">Tampilkan Semua</option>
                            <option value="menipis">Stok Menipis (≤ 10)</option>
                            <option value="habis">Stok Habis (0)</option>
                        </select>
                    </div>
                    <button onClick={exportExcel} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium shadow-sm">
                        Export Excel
                    </button>
                </div>

                {/* Filter Tanggal & Tombol Riwayat */}
                <div className="flex flex-wrap gap-4 items-end w-full lg:w-auto bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Dari Tanggal</label>
                        <input type="date" className="border p-2 rounded text-sm w-full" value={tglAwal} onChange={(e) => setTglAwal(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Sampai Tanggal</label>
                        <input type="date" className="border p-2 rounded text-sm w-full" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => openGlobalHistory('masuk')} className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 font-medium text-sm shadow-sm">
                            Riwayat Masuk
                        </button>
                        <button onClick={() => openGlobalHistory('keluar')} className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 font-medium text-sm shadow-sm">
                            Riwayat Keluar
                        </button>
                    </div>
                </div>
            </div>

            {loading && <div className="text-center py-8 text-gray-500">Memuat data inventaris...</div>}

            {/* Tabel Utama Per Kategori */}
            {!loading && Object.entries(groupedData).map(([kategori, items]) => (
                <div key={kategori} className="mb-6 bg-white border rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
                        <h2 className="font-bold uppercase text-sm tracking-wide">{kategori}</h2>
                        <span className="bg-gray-700 px-2 py-1 rounded text-xs">{items.length} Item</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left py-2 px-4 font-semibold text-gray-600">Barcode</th>
                                    <th className="text-left py-2 px-4 font-semibold text-gray-600">Nama Produk</th>
                                    <th className="text-center py-2 px-4 font-semibold text-gray-600">Sisa Stok</th>
                                    <th className="text-right py-2 px-4 font-semibold text-gray-600">Harga Beli</th>
                                    <th className="text-right py-2 px-4 font-semibold text-gray-600">Total Beli</th>
                                    <th className="text-right py-2 px-4 font-semibold text-gray-600">Harga Jual</th>
                                    <th className="text-right py-2 px-4 font-semibold text-gray-600">Total Jual</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.barcode} className="border-b hover:bg-gray-50">
                                        <td className="py-2 px-4 font-mono text-gray-500">{item.barcode}</td>
                                        <td className="py-2 px-4 font-medium">{item.nama}</td>
                                        <td className="py-2 px-4 text-center">
                                            <span className={`px-3 py-1 rounded-full font-bold inline-block min-w-[3rem] ${
                                                item.stok === 0 ? 'bg-red-100 text-red-700' : 
                                                item.stok <= 10 ? 'bg-yellow-100 text-yellow-700' : 
                                                'bg-green-100 text-green-700'
                                            }`}>
                                                {item.stok}
                                            </span>
                                        </td>
                                        <td className="py-2 px-4 text-right font-medium text-orange-600">
                                            {formatRupiah(item.harga_modal)}
                                        </td>
                                        <td className="py-2 px-4 text-right font-bold text-orange-700">
                                            {formatRupiah(item.harga_modal * item.stok)}
                                        </td>
                                        <td className="py-2 px-4 text-right font-medium text-emerald-600">
                                            {formatRupiah(item.harga_jual)}
                                        </td>
                                        <td className="py-2 px-4 text-right font-bold text-emerald-700">
                                            {formatRupiah(item.harga_jual * item.stok)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            {/* MODAL RIWAYAT REAL */}
            {historyModal.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className={`px-4 py-3 border-b flex justify-between items-center ${historyModal.type === 'masuk' ? 'bg-green-600' : 'bg-red-600'}`}>
                            <h3 className="text-white font-bold text-lg">
                                Laporan Stok {historyModal.type === 'masuk' ? 'Masuk' : 'Keluar'} 
                                <span className="text-sm font-normal ml-2 bg-black bg-opacity-20 px-2 py-1 rounded">
                                    {tglAwal} s/d {tglAkhir}
                                </span>
                            </h3>
                            <button onClick={() => setHistoryModal({ isOpen: false, type: '' })} className="text-white font-bold text-xl">&times;</button>
                        </div>
                        
                        <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
                            {loadingHistory ? (
                                <div className="text-center py-8 text-gray-500 font-medium">Menarik data dari server...</div>
                            ) : (
                                <div className="bg-white border rounded shadow-sm overflow-hidden">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-100 border-b">
                                            <tr>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Tanggal Waktu</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Barcode</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Nama Produk</th>
                                                <th className="text-center py-3 px-4 font-semibold text-gray-700">Jumlah</th>
                                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Keterangan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyData.length === 0 ? (
                                                <tr><td colSpan="5" className="text-center py-6 text-gray-500">Tidak ada pergerakan stok pada rentang tanggal ini.</td></tr>
                                            ) : (
                                                historyData.map((log) => (
                                                    <tr key={log.id} className="border-b hover:bg-gray-50">
                                                        <td className="py-2 px-4 whitespace-nowrap">
                                                            {new Date(Number(log.tanggal)).toLocaleString('id-ID')}
                                                        </td>
                                                        <td className="py-2 px-4 font-mono text-gray-500">{log.barcode}</td>
                                                        <td className="py-2 px-4 font-medium text-gray-800">{log.produk?.nama || 'Produk Dihapus'}</td>
                                                        <td className="py-2 px-4 text-center font-bold text-lg">
                                                            <span className={historyModal.type === 'masuk' ? 'text-green-600' : 'text-red-600'}>
                                                                {historyModal.type === 'masuk' ? '+' : '-'}{log.jumlah}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-4 text-gray-600">{log.keterangan}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-white text-right">
                            <button onClick={() => setHistoryModal({ isOpen: false, type: '' })} className="px-6 py-2 bg-gray-600 text-white rounded-md font-bold hover:bg-gray-700 transition shadow-sm">
                                Tutup Panel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}