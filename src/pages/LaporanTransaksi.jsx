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

export default function LaporanTransaksi() {
    const [transaksi, setTransaksi] = useState([]);
    const [tglAwal, setTglAwal] = useState('');
    const [tglAkhir, setTglAkhir] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingExport, setLoadingExport] = useState(false);
    
    // State Profil Toko Dinamis
    const [profilToko, setProfilToko] = useState({ nama: 'NAMA TOKO', alamat: 'Alamat Toko' });

    // Konfigurasi Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // State Modal Detail
   const [detailModal, setDetailModal] = useState({ isOpen: false, transaction: null, data: [], loading: false });

    useEffect(() => {
        fetchProfil();
        fetchTransaksi();
    }, []);

    // 1. Tarik Profil Toko
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

    // 2. Tarik Data Transaksi
    const fetchTransaksi = async () => {
        setLoading(true);
        let query = supabase
            .from('transaksi')
            .select('*')
            .eq('is_deleted', false)
            .order('tanggal', { ascending: false });

        if (tglAwal) {
            const awalMs = new Date(`${tglAwal}T00:00:00`).getTime();
            query = query.gte('tanggal', awalMs); 
        }
        if (tglAkhir) {
            const akhirMs = new Date(`${tglAkhir}T23:59:59.999`).getTime();
            query = query.lte('tanggal', akhirMs);
        }

        const { data, error } = await query;
        
        if (error) {
            console.error('Gagal menarik data:', error.message);
        } else {
            setTransaksi(data || []);
            setCurrentPage(1);
        }
        setLoading(false);
    };

    const handleFilter = (e) => {
        e.preventDefault();
        fetchTransaksi();
    };

    // 3. Modal Rincian
const openDetail = async (transaksiItem) => {
        setDetailModal({ isOpen: true, transaction: transaksiItem, data: [], loading: true });
        
        const { data, error } = await supabase
            .from('detail_transaksi')
            .select('nama_produk, harga_jual, jumlah')
            .eq('transaksi_id', transaksiItem.id);
            
        if (error) {
            console.error('Gagal menarik rincian:', error);
        } else {
            setDetailModal({ isOpen: true, transaction: transaksiItem, data: data || [], loading: false });
        }
    };

    // 4. Tarik Detail untuk Ekspor (Memperbaiki Harga Modal)
const fetchAllDetailsForExport = async () => {
        const { data: dataProduk } = await supabase.from('produk').select('nama, harga_modal');
        const mapModal = {};
        if (dataProduk) {
            dataProduk.forEach(p => {
                mapModal[p.nama] = p.harga_modal || 0;
            });
        }

        // Ambil ID Transaksi (UUID), bukan nomor invoice
        const transactionIds = transaksi.map(t => t.id);
        let allDetails = [];
        const chunkSize = 100;
        const promises = [];
        
        for (let i = 0; i < transactionIds.length; i += chunkSize) {
            const chunk = transactionIds.slice(i, i + chunkSize);
            promises.push(
                supabase.from('detail_transaksi')
                .select('transaksi_id, nama_produk, jumlah')
                .in('transaksi_id', chunk)
            );
        }
        
        const results = await Promise.all(promises);
        results.forEach(res => {
            if (res.data) allDetails = [...allDetails, ...res.data];
        });

        const detailsMap = {};
        allDetails.forEach(d => {
            if (!detailsMap[d.transaksi_id]) detailsMap[d.transaksi_id] = [];
            d.harga_modal_satuan = mapModal[d.nama_produk] || 0; 
            detailsMap[d.transaksi_id].push(d);
        });
        
        return detailsMap;
    };

    // 5. Ekspor Excel
    const exportExcel = async () => {
        if (transaksi.length === 0) return alert("Tidak ada data");
        setLoadingExport(true);
        
        try {
            const detailsMap = await fetchAllDetailsForExport();
            let grandTotalModal = 0;
            let grandTotalJual = 0;
            let grandTotalLaba = 0;

            const rows = transaksi.map(t => {
                const trDetails = detailsMap[t.id] || [];
                const modal = trDetails.reduce((sum, d) => sum + (d.harga_modal_satuan * d.jumlah), 0);
                const jual = t.total_harga;
                const laba = jual - modal;

                grandTotalModal += modal;
                grandTotalJual += jual;
                grandTotalLaba += laba;

                return [
                    t.nomor_invoice,
                    new Date(Number(t.tanggal)).toLocaleString('id-ID'),
                    t.nama_kasir,
                    t.nama_pelanggan || "Umum",
                    modal,
                    jual,
                    laba
                ];
            });

            rows.push(["", "", "", "TOTAL KESELURUHAN", grandTotalModal, grandTotalJual, grandTotalLaba]);

            const wsData = [
                [profilToko.nama.toUpperCase()],
                [profilToko.alamat],
                [""],
                ["LAPORAN TRANSAKSI PENJUALAN"],
                [`Periode: ${tglAwal ? tglAwal : 'Awal'} s/d ${tglAkhir ? tglAkhir : 'Akhir'}`],
                [`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`],
                [""],
                ["Nomor Invoice", "Tanggal Waktu", "Nama Kasir", "Pelanggan", "Total Modal (Rp)", "Total Jual (Rp)", "Laba Bersih (Rp)"],
                ...rows
            ];

            const worksheet = XLSX.utils.aoa_to_sheet(wsData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Transaksi");
            XLSX.writeFile(workbook, `Laporan_Transaksi_${new Date().getTime()}.xlsx`);
        } catch (error) {
            alert("Terjadi kesalahan saat memproses data ekspor.");
            console.error(error);
        }
        setLoadingExport(false);
    };

    // 6. Ekspor PDF
    const exportPDF = async () => {
        if (transaksi.length === 0) return alert("Tidak ada data");
        
        const pdfWindow = window.open('', '_blank');
        if (!pdfWindow) {
            alert("Harap izinkan Pop-up browser Anda untuk membuka PDF.");
            return;
        }
        
        pdfWindow.document.write('<p style="font-family: sans-serif; padding: 20px;">Memproses laporan PDF, mohon tunggu...</p>');
        setLoadingExport(true);
        
        try {
            const detailsMap = await fetchAllDetailsForExport();
            const doc = new jsPDF('landscape'); 
            const pageWidth = doc.internal.pageSize.getWidth();
            
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text(profilToko.nama.toUpperCase(), pageWidth / 2, 16, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(profilToko.alamat, pageWidth / 2, 23, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("LAPORAN TRANSAKSI PENJUALAN", pageWidth / 2, 33, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Periode: ${tglAwal || 'Semua Waktu'} s/d ${tglAkhir || 'Semua Waktu'}`, 14, 43);
            doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 48);

            let grandTotalModal = 0;
            let grandTotalJual = 0;
            let grandTotalLaba = 0;

            const tableColumn = ["Invoice", "Tanggal", "Kasir", "Pelanggan", "Total Modal", "Total Jual", "Laba Bersih"];
            const tableRows = transaksi.map(t => {
                const trDetails = detailsMap[t.id] || [];
                const modal = trDetails.reduce((sum, d) => sum + (d.harga_modal_satuan * d.jumlah), 0);
                const jual = t.total_harga;
                const laba = jual - modal;

                grandTotalModal += modal;
                grandTotalJual += jual;
                grandTotalLaba += laba;

                return [
                    t.nomor_invoice,
                    new Date(Number(t.tanggal)).toLocaleString('id-ID'),
                    t.nama_kasir,
                    t.nama_pelanggan || "Umum",
                    formatRupiah(modal),
                    formatRupiah(jual),
                    formatRupiah(laba)
                ];
            });

            autoTable(doc, { 
                head: [tableColumn], 
                body: tableRows, 
                startY: 53, 
                foot: [["", "", "", "TOTAL KESELURUHAN", formatRupiah(grandTotalModal), formatRupiah(grandTotalJual), formatRupiah(grandTotalLaba)]],
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
        setLoadingExport(false);
    };

    // Logika Pemotongan Data (Pagination)
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentData = transaksi.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(transaksi.length / rowsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const handleRowsPerPageChange = (e) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    return (
        <div className="p-6 relative">
            <h1 className="text-2xl font-bold mb-6">Laporan Transaksi</h1>

            <div className="flex flex-wrap gap-4 mb-6 items-end">
                <div>
                    <label className="block text-sm font-medium mb-1">Dari Tanggal</label>
                    <input type="date" className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={tglAwal} onChange={(e) => setTglAwal(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Sampai Tanggal</label>
                    <input type="date" className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} />
                </div>
                <button onClick={handleFilter} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow-sm font-medium">Terapkan Filter</button>
                
                <div className="ml-auto flex gap-2">
                    <button onClick={exportExcel} disabled={loadingExport} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow-sm font-medium disabled:opacity-50">
                        {loadingExport ? 'Memproses...' : 'Export Excel'}
                    </button>
                    <button onClick={exportPDF} disabled={loadingExport} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 shadow-sm font-medium disabled:opacity-50">
                        {loadingExport ? 'Memproses...' : 'Lihat PDF'}
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                    <span className="mr-2 text-sm text-gray-700">Tampilkan:</span>
                    <select 
                        value={rowsPerPage} 
                        onChange={handleRowsPerPageChange}
                        className="border border-gray-300 p-1 rounded text-sm outline-none"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                    <span className="ml-2 text-sm text-gray-700">baris</span>
                </div>
                <div className="text-sm text-gray-700">
                    Total: <span className="font-bold">{transaksi.length}</span> transaksi
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg shadow-sm">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-800 text-white border-b">
                        <tr>
                            <th className="text-left py-3 px-4 font-semibold">Invoice</th>
                            <th className="text-left py-3 px-4 font-semibold">Tanggal</th>
                            <th className="text-left py-3 px-4 font-semibold">Kasir</th>
                            <th className="text-left py-3 px-4 font-semibold">Pelanggan</th>
                            <th className="text-right py-3 px-4 font-semibold">Total</th>
                            <th className="text-center py-3 px-4 font-semibold">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-8 text-gray-500">Memuat data...</td></tr>
                        ) : currentData.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-8 text-gray-500">Tidak ada data transaksi pada periode ini.</td></tr>
                        ) : (
                            currentData.map((item) => (
                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                    <td className="py-2 px-4 font-mono text-gray-600">{item.nomor_invoice}</td>
                                    <td className="py-2 px-4 whitespace-nowrap">{new Date(Number(item.tanggal)).toLocaleString('id-ID')}</td>
                                    <td className="py-2 px-4">{item.nama_kasir}</td>
                                    <td className="py-2 px-4">{item.nama_pelanggan || '-'}</td>
                                    <td className="py-2 px-4 text-right font-bold text-emerald-600">{formatRupiah(item.total_harga)}</td>
                                    <td className="py-2 px-4 text-center">
<button 
    onClick={() => openDetail(item)}
    className="text-blue-600 hover:text-blue-800 font-bold px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-full transition"
>
    Rincian
</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-700 font-medium">
                        Halaman {currentPage} dari {totalPages}
                    </div>
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => paginate(currentPage - 1)} 
                            disabled={currentPage === 1}
                            className={`px-4 py-2 rounded-md font-medium border ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                        >
                            Sebelumnya
                        </button>
                        <button 
                            onClick={() => paginate(currentPage + 1)} 
                            disabled={currentPage === totalPages}
                            className={`px-4 py-2 rounded-md font-medium border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                        >
                            Selanjutnya
                        </button>
                    </div>
                </div>
            )}

{detailModal.isOpen && detailModal.transaction && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                        
                        {/* Header Kontrol Modal */}
                        <div className="px-4 py-3 border-b bg-gray-800 text-white flex justify-between items-center">
                            <h3 className="font-bold text-sm">DETAIL TRANSAKSI</h3>
                            <button onClick={() => setDetailModal({ isOpen: false, transaction: null, data: [], loading: false })} className="text-gray-300 hover:text-white font-bold text-xl leading-none">&times;</button>
                        </div>
                        
                        {/* Kertas Nota (Scrollable) */}
                        <div className="p-6 overflow-y-auto flex-1 bg-[#fefefe] text-gray-800 font-mono text-sm">
                            
                            {/* Identitas Toko */}
                            <div className="text-center mb-4">
                                <h2 className="font-bold text-lg">{profilToko.nama.toUpperCase()}</h2>
                                <p className="text-xs mt-1">{profilToko.alamat}</p>
                            </div>

                            <div className="border-t border-dashed border-gray-400 my-3"></div>

                            {/* Metadata Transaksi */}
                            <div className="text-xs mb-3 space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">No. Inv</span> 
                                    <span>{detailModal.transaction.nomor_invoice}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tanggal</span> 
                                    <span>{new Date(Number(detailModal.transaction.tanggal)).toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Kasir</span> 
                                    <span>{detailModal.transaction.nama_kasir}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Pelanggan</span> 
                                    <span>{detailModal.transaction.nama_pelanggan || 'Umum'}</span>
                                </div>
                            </div>

                            <div className="border-t border-dashed border-gray-400 my-3"></div>

                            {/* Daftar Item */}
                            {detailModal.loading ? (
                                <div className="text-center py-6 text-gray-500 text-xs">Menarik data item...</div>
                            ) : detailModal.data.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-xs">Item tidak ditemukan.</div>
                            ) : (
                                <div className="mb-3">
                                    {detailModal.data.map((item, idx) => (
                                        <div key={idx} className="mb-2 text-xs">
                                            <div className="font-bold">{item.nama_produk}</div>
                                            <div className="flex justify-between text-gray-600 mt-1">
                                                <span>{item.jumlah} x {formatRupiah(item.harga_jual)}</span>
                                                <span className="text-gray-900 font-bold">{formatRupiah(item.harga_jual * item.jumlah)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="border-t border-dashed border-gray-400 my-3"></div>

                            {/* Rangkuman Pembayaran */}
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between font-bold text-sm">
                                    <span>TOTAL</span>
                                    <span>{formatRupiah(detailModal.transaction.total_harga)}</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span>Tunai</span>
                                    <span>{formatRupiah(detailModal.transaction.nominal_bayar)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Kembali</span>
                                    <span>{formatRupiah(detailModal.transaction.nominal_kembali)}</span>
                                </div>
                            </div>

                            <div className="border-t border-dashed border-gray-400 my-4"></div>

                        </div>

                        {/* Tombol Aksi Bawah */}
                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button onClick={() => setDetailModal({ isOpen: false, transaction: null, data: [], loading: false })} className="px-6 py-2 bg-gray-600 text-white rounded-md font-bold hover:bg-gray-700 transition shadow-sm text-sm">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}