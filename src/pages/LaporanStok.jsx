import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Fungsi format angka ke Rupiah
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka || 0);
};

export default function LaporanStok() {
    // Fungsi Tanggal
    const getTodayDate = () => {
        const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [tglAwal, setTglAwal] = useState(getTodayDate());
    const [tglAkhir, setTglAkhir] = useState(getTodayDate());

    // State Utama
    const [profilToko, setProfilToko] = useState({ nama: 'NAMA TOKO', alamat: 'Alamat Toko' });
    const [produk, setProduk] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('semua');
    const [loading, setLoading] = useState(false);

    // State Modal Riwayat
    const [historyModal, setHistoryModal] = useState({ isOpen: false, type: '' });
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Tarik profil toko di awal
    useEffect(() => {
        fetchProfil();
    }, []);

    // Tarik data stok setiap filter status berubah
    useEffect(() => {
        fetchStok();
    }, [statusFilter]);

    const fetchProfil = async () => {
        const { data, error } = await supabase
            .from('profil_toko') 
            .select('nama_toko, alamat_toko')
            .limit(1)
            .single();
            
        if (!error && data) {
            setProfilToko({
                nama: data.nama_toko || 'NAMA TOKO',
                alamat: data.alamat_toko || 'Alamat Toko'
            });
        }
    };

    const fetchStok = async () => {
        setLoading(true);
        let query = supabase
            .from('produk')
            .select('*')
            .neq('is_deleted', true)
            .order('nama', { ascending: true });

        if (statusFilter === 'habis') {
            query = query.eq('stok', 0);
        } else if (statusFilter === 'menipis') {
            query = query.gt('stok', 0).lte('stok', 10);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Gagal menarik data produk:', error.message);
        } else {
            setProduk(data || []);
        }
        setLoading(false);
    };

    const openGlobalHistory = async (type) => {
        if (!tglAwal || !tglAkhir) {
            alert("Silakan pilih 'Dari Tanggal' dan 'Sampai Tanggal' terlebih dahulu.");
            return;
        }

        setHistoryModal({ isOpen: true, type });
        setLoadingHistory(true);

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

    // Filter Klien & Pengelompokan
    const filteredProduk = produk.filter(item => 
        item.nama?.toLowerCase().includes(search.toLowerCase()) ||
        item.barcode?.toLowerCase().includes(search.toLowerCase())
    );

    const groupedData = filteredProduk.reduce((acc, item) => {
        const kategori = item.kategori || "Tanpa Kategori";
        if (!acc[kategori]) acc[kategori] = [];
        acc[kategori].push(item);
        return acc;
    }, {});

    // FORMAT EXCEL TINGKAT LANJUT
const exportExcel = () => {
        if (filteredProduk.length === 0) return alert("Tidak ada data yang bisa diekspor.");
        
        let grandTotalBeli = 0;
        let grandTotalJual = 0;
        let grandTotalStok = 0;
        let grandTotalLaba = 0; // Deklarasi Grand Total Laba

        const rows = filteredProduk.map(item => {
            const totalBeli = (item.harga_modal || 0) * item.stok;
            const totalJual = (item.harga_jual || 0) * item.stok;
            const totalLaba = totalJual - totalBeli;
            
            grandTotalBeli += totalBeli;
            grandTotalJual += totalJual;
            grandTotalStok += item.stok;
            grandTotalLaba += totalLaba;

            return [
                item.kategori || "Tanpa Kategori",
                item.barcode,
                item.nama,
                item.stok,
                item.harga_modal,
                totalBeli,
                item.harga_jual,
                totalJual,
                totalLaba // Masukkan Laba ke baris
            ];
        });

        // Baris Footer: Pastikan posisi index kolom sesuai dengan header
        rows.push(["", "", "TOTAL KESELURUHAN", grandTotalStok, "", grandTotalBeli, "", grandTotalJual, grandTotalLaba]);

        const labelStatus = statusFilter === 'semua' ? 'Semua Produk' : statusFilter === 'menipis' ? 'Stok Menipis (<=10)' : 'Stok Habis (0)';

        const wsData = [
            [profilToko.nama.toUpperCase()],
            [profilToko.alamat],
            [""],
            ["LAPORAN STOK & INVENTARIS BARANG"],
            [`Filter Tampilan: ${labelStatus}`],
            [`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`],
            [""],
            // Header: Tambahkan "Total Laba (Rp)" di akhir
            ["Kategori", "Barcode", "Nama Produk", "Sisa Stok", "Harga Beli (Rp)", "Total Beli (Rp)", "Harga Jual (Rp)", "Total Jual (Rp)", "Total Laba (Rp)"],
            ...rows
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(wsData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Stok");
        XLSX.writeFile(workbook, `Laporan_Stok_${new Date().getTime()}.xlsx`);
    };

    // FORMAT PDF TINGKAT LANJUT
const exportPDF = () => {
        if (filteredProduk.length === 0) return alert("Tidak ada data yang bisa diekspor.");
        
        const pdfWindow = window.open('', '_blank');
        if (!pdfWindow) {
            alert("Harap izinkan Pop-up browser Anda untuk membuka PDF.");
            return;
        }
        
        pdfWindow.document.write('<p style="font-family: sans-serif; padding: 20px;">Memproses laporan PDF, mohon tunggu...</p>');
        
        try {
            const doc = new jsPDF('landscape'); 
            const pageWidth = doc.internal.pageSize.getWidth();
            
            // Header Toko
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text(profilToko.nama.toUpperCase(), pageWidth / 2, 16, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(profilToko.alamat, pageWidth / 2, 23, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("LAPORAN STOK & INVENTARIS BARANG", pageWidth / 2, 33, { align: 'center' });
            
            // Sub-header
            const labelStatus = statusFilter === 'semua' ? 'Semua Produk' : statusFilter === 'menipis' ? 'Stok Menipis (<=10)' : 'Stok Habis (0)';
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Filter Tampilan: ${labelStatus}`, 14, 43);
            doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 48);

            let grandTotalBeli = 0;
            let grandTotalJual = 0;
            let grandTotalStok = 0;
            let grandTotalLaba = 0; // Deklarasi Grand Total Laba

            // Tambahkan "Total Laba" di Header PDF
            const tableColumn = ["Kategori", "Barcode", "Nama Produk", "Stok", "Harga Beli", "Total Beli", "Harga Jual", "Total Jual", "Total Laba"];
            
            const tableRows = filteredProduk.map(item => {
                const totalBeli = (item.harga_modal || 0) * item.stok;
                const totalJual = (item.harga_jual || 0) * item.stok;
                const totalLaba = totalJual - totalBeli;
                
                grandTotalBeli += totalBeli;
                grandTotalJual += totalJual;
                grandTotalStok += item.stok;
                grandTotalLaba += totalLaba;

                return [
                    item.kategori || "Tanpa Kategori",
                    item.barcode,
                    item.nama,
                    item.stok,
                    formatRupiah(item.harga_modal),
                    formatRupiah(totalBeli),
                    formatRupiah(item.harga_jual),
                    formatRupiah(totalJual),
                    formatRupiah(totalLaba) // Masukkan laba ke baris PDF
                ];
            });

            autoTable(doc, { 
                head: [tableColumn], 
                body: tableRows, 
                startY: 53, 
                // Footer: Tambahkan perhitungan grandTotalLaba
                foot: [["", "", "TOTAL KESELURUHAN", grandTotalStok, "", formatRupiah(grandTotalBeli), "", formatRupiah(grandTotalJual), formatRupiah(grandTotalLaba)]],
                theme: 'striped',
                headStyles: { fillColor: [31, 41, 55] },
                footStyles: { fillColor: [229, 231, 235], textColor: [17, 24, 39], fontStyle: 'bold' }
            });

            const pdfBlobUrl = doc.output('bloburl');
            pdfWindow.location.href = pdfBlobUrl;
            
        } catch (error) {
            pdfWindow.close();
            alert("Terjadi kesalahan saat membuat PDF: " + error.message);
            console.error(error);
        }
    };

    return (
        <div className="p-6 relative">
            <h1 className="text-2xl font-bold mb-6">Laporan Stok & Inventaris</h1>

            {/* Panel Kontrol & Filter */}

            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Bagian Kiri: Pencarian, Status, & Export (2 Kolom) */}
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Cari Produk</label>
                        <input 
                            type="text" 
                            placeholder="Nama/Barcode..."
                            className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Status Stok</label>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-gray-300 p-2 rounded-md bg-white w-full focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="semua">Semua</option>
                            <option value="menipis">Menipis (≤10)</option>
                            <option value="habis">Habis (0)</option>
                        </select>
                    </div>
                    {/* Tombol Export di posisi tengah agar tidak berdesakan */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-2">
                        <button onClick={exportExcel} className="bg-green-600 text-white w-full px-4 py-2 rounded-md hover:bg-green-700 transition font-medium shadow-sm">
                            Export Excel
                        </button>
                        <button onClick={exportPDF} className="bg-red-600 text-white w-full px-4 py-2 rounded-md hover:bg-red-700 transition font-medium shadow-sm">
                            Export PDF
                        </button>
                    </div>
                </div>

                {/* Bagian Kanan: Filter Tanggal & Tombol Riwayat */}
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Dari</label>
                            <input type="date" className="border p-2 rounded text-sm w-full outline-none" value={tglAwal} onChange={(e) => setTglAwal(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Sampai</label>
                            <input type="date" className="border p-2 rounded text-sm w-full outline-none" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} />
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2">
                        <button onClick={() => openGlobalHistory('masuk')} className="bg-blue-600 text-white px-2 py-2 rounded-md hover:bg-blue-700 font-medium text-xs shadow-sm">
                            Riwayat Masuk
                        </button>
                        <button onClick={() => openGlobalHistory('keluar')} className="bg-orange-600 text-white px-2 py-2 rounded-md hover:bg-orange-700 font-medium text-xs shadow-sm">
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
                                    {/* TAMBAHAN HEADER BARU */}
                                    <th className="text-right py-2 px-4 font-semibold text-blue-700">Total Laba</th>
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
                                        <td className="py-2 px-4 text-right font-bold text-blue-600">
                                            {formatRupiah((item.harga_jual * item.stok) - (item.harga_modal * item.stok))}
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
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className={`px-6 py-4 border-b flex justify-between items-center ${historyModal.type === 'masuk' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                            <h3 className="text-white font-bold text-lg">
                                Riwayat Stok {historyModal.type === 'masuk' ? 'Masuk' : 'Keluar'} 
                                <span className="text-sm font-normal ml-3 bg-black bg-opacity-20 px-3 py-1 rounded-full">
                                    {tglAwal} s/d {tglAkhir}
                                </span>
                            </h3>
                            <button onClick={() => setHistoryModal({ isOpen: false, type: '' })} className="text-white hover:text-gray-200 font-bold text-2xl leading-none">&times;</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
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
                                                            <span className={historyModal.type === 'masuk' ? 'text-blue-600' : 'text-orange-600'}>
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
                        <div className="p-4 border-t bg-white flex justify-end">
                            <button onClick={() => setHistoryModal({ isOpen: false, type: '' })} className="px-6 py-2 bg-gray-800 text-white rounded-md font-bold hover:bg-gray-900 transition shadow-sm">
                                Tutup Panel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}