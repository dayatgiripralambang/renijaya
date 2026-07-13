import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function LaporanTransaksi() {
    const [transaksi, setTransaksi] = useState([]);
    const [tglAwal, setTglAwal] = useState('');
    const [tglAkhir, setTglAkhir] = useState('');
    const [loading, setLoading] = useState(false);

    // Konfigurasi Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        fetchTransaksi();
    }, []);

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
            setCurrentPage(1); // Reset ke halaman 1 setiap kali filter diterapkan
        }
        setLoading(false);
    };

    const handleFilter = (e) => {
        e.preventDefault();
        fetchTransaksi();
    };

    // Logika Pemotongan Data (Pagination)
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentData = transaksi.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(transaksi.length / rowsPerPage);

    // Fungsi Navigasi Pagination
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const handleRowsPerPageChange = (e) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    // Fungsi Ekspor
    const exportExcel = () => {
        if (transaksi.length === 0) return alert("Tidak ada data");
        const dataFormat = transaksi.map(item => ({
            "Nomor Invoice": item.nomor_invoice,
            "Tanggal Waktu": new Date(Number(item.tanggal)).toLocaleString('id-ID'),
            "Nama Kasir": item.nama_kasir,
            "Pelanggan": item.nama_pelanggan || "Umum",
            "Total (Rp)": item.total_harga
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataFormat);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");
        XLSX.writeFile(workbook, "Laporan_Transaksi.xlsx");
    };

    const exportPDF = () => {
        if (transaksi.length === 0) return alert("Tidak ada data");
        const doc = new jsPDF();
        doc.text("Laporan Transaksi", 14, 15);
        doc.setFontSize(10);
        doc.text(`Periode: ${tglAwal || 'Awal'} s/d ${tglAkhir || 'Akhir'}`, 14, 22);

        const tableColumn = ["Invoice", "Tanggal", "Kasir", "Pelanggan", "Total (Rp)"];
        const tableRows = transaksi.map(item => [
            item.nomor_invoice,
            new Date(Number(item.tanggal)).toLocaleDateString('id-ID'),
            item.nama_kasir,
            item.nama_pelanggan || "Umum",
            item.total_harga.toLocaleString('id-ID')
        ]);

        doc.autoTable({ head: [tableColumn], body: tableRows, startY: 28 });
        doc.save("Laporan_Transaksi.pdf");
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Laporan Transaksi</h1>

            <div className="flex flex-wrap gap-4 mb-6 items-end">
                <div>
                    <label className="block text-sm font-medium mb-1">Dari Tanggal</label>
                    <input type="date" className="border p-2 rounded" value={tglAwal} onChange={(e) => setTglAwal(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Sampai Tanggal</label>
                    <input type="date" className="border p-2 rounded" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} />
                </div>
                <button onClick={handleFilter} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Terapkan Filter</button>
                <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ml-auto">Export Excel</button>
                <button onClick={exportPDF} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Export PDF</button>
            </div>

            {/* Kontrol Pagination Atas */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                    <span className="mr-2 text-sm text-gray-700">Tampilkan:</span>
                    <select 
                        value={rowsPerPage} 
                        onChange={handleRowsPerPageChange}
                        className="border p-1 rounded text-sm"
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

            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-100 border-b">
                        <tr>
                            <th className="text-left py-3 px-4">Invoice</th>
                            <th className="text-left py-3 px-4">Tanggal</th>
                            <th className="text-left py-3 px-4">Kasir</th>
                            <th className="text-left py-3 px-4">Pelanggan</th>
                            <th className="text-right py-3 px-4">Total</th>
                            <th className="text-center py-3 px-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-4">Memuat data...</td></tr>
                        ) : currentData.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-4">Tidak ada data transaksi.</td></tr>
                        ) : (
                            currentData.map((item) => (
                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                    <td className="py-2 px-4">{item.nomor_invoice}</td>
                                    <td className="py-2 px-4">{new Date(Number(item.tanggal)).toLocaleString('id-ID')}</td>
                                    <td className="py-2 px-4">{item.nama_kasir}</td>
                                    <td className="py-2 px-4">{item.nama_pelanggan || '-'}</td>
                                    <td className="py-2 px-4 text-right font-medium">Rp {item.total_harga.toLocaleString('id-ID')}</td>
                                    <td className="py-2 px-4 text-center">
                                        {/* Tautan Aksi */}
                                        <a 
                                            href={`#detail/${item.nomor_invoice}`} 
                                            onClick={(e) => {
                                                e.preventDefault();
                                                alert(`Membuka detail untuk invoice: ${item.nomor_invoice}`);
                                            }}
                                            className="text-blue-600 hover:text-blue-800 underline font-medium"
                                        >
                                            Detail
                                        </a>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Navigasi Pagination Bawah */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-700">
                        Halaman {currentPage} dari {totalPages}
                    </div>
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => paginate(currentPage - 1)} 
                            disabled={currentPage === 1}
                            className={`px-3 py-1 rounded border ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}
                        >
                            Sebelumnya
                        </button>
                        <button 
                            onClick={() => paginate(currentPage + 1)} 
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}
                        >
                            Selanjutnya
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}