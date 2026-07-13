import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function LaporanKas() {
    // Zona Waktu GMT+7 (WIB)
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const [searchMutasi, setSearchMutasi] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const startOfMonth = `${year}-${month}-01`;
    const todayDate = `${year}-${month}-${day}`;

    // State Filter Tanggal (Meniru setTanggalBulanIni Android)
    const [tglAwal, setTglAwal] = useState(startOfMonth);
    const [tglAkhir, setTglAkhir] = useState(todayDate);

    // State Data Keuangan
    const [totalSaldoAktual, setTotalSaldoAktual] = useState(0);
    const [dataMutasi, setDataMutasi] = useState([]);
    const [summaryMutasi, setSummaryMutasi] = useState({ masuk: 0, keluar: 0 });
    const [loading, setLoading] = useState(false);

    // State Modal
    const [modalRincian, setModalRincian] = useState({ isOpen: false, tipe: '' }); 
    const [modalTarik, setModalTarik] = useState(false);
    const [formTarik, setFormTarik] = useState({ jumlah: '', keterangan: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchKas();
    }, [tglAwal, tglAkhir]);

    const fetchKas = async () => {
        setLoading(true);

        // 1. Ambil Total Saldo (Semua Waktu)
        const { data: allData, error: errAll } = await supabase
            .from('kas')
            .select('tipe, jumlah')
            .neq('is_deleted', true);

        if (!errAll && allData) {
            let total = 0;
            allData.forEach(item => {
                const tipe = item.tipe.toUpperCase();
                if (tipe === 'MASUK') total += item.jumlah;
                if (tipe === 'KELUAR') total -= item.jumlah;
            });
            setTotalSaldoAktual(total);
        }

        // 2. Ambil Mutasi Sesuai Rentang Waktu (GMT+7)
        const awalMs = new Date(`${tglAwal}T00:00:00+07:00`).getTime(); 
        const akhirMs = new Date(`${tglAkhir}T23:59:59.999+07:00`).getTime();

        const { data: rangeData, error: errRange } = await supabase
            .from('kas')
            .select('*')
            .neq('is_deleted', true)
            .gte('tanggal', awalMs)
            .lte('tanggal', akhirMs)
            .order('tanggal', { ascending: false });

        if (!errRange) {
            setDataMutasi(rangeData || []);
            
            let mutasiMasuk = 0;
            let mutasiKeluar = 0;
            (rangeData || []).forEach(item => {
                const tipe = item.tipe.toUpperCase();
                if (tipe === 'MASUK') mutasiMasuk += item.jumlah;
                if (tipe === 'KELUAR') mutasiKeluar += item.jumlah;
            });
            setSummaryMutasi({ masuk: mutasiMasuk, keluar: mutasiKeluar });
        }
        
        setLoading(false);
    };

    // Eksekusi Tarik Saldo (Meniru eksekusiTarikSaldo Android)
    const handleTarikSaldo = async (e) => {
        e.preventDefault();
        const jumlahTarik = Number(formTarik.jumlah);

        if (jumlahTarik <= 0) return alert('Masukkan nominal yang valid');
        if (jumlahTarik > totalSaldoAktual) return alert('Saldo tidak mencukupi');

        setIsSubmitting(true);
        
        const epochNowMs = new Date().getTime();

        const { error } = await supabase
            .from('kas')
            .insert([{
                id: crypto.randomUUID(),
                tanggal: epochNowMs,
                tipe: 'KELUAR',
                kategori: 'TARIK SALDO',
                jumlah: jumlahTarik,
                keterangan: formTarik.keterangan || 'Penarikan Saldo Kas'
            }]);

        if (error) {
            alert('Gagal menarik saldo: ' + error.message);
        } else {
            setModalTarik(false);
            setFormTarik({ jumlah: '', keterangan: '' });
            fetchKas();
        }
        setIsSubmitting(false);
    };

    const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

// --- TAMBAHKAN KODE INI SEBELUM RETURN ---
    const filteredDataMutasi = dataMutasi.filter((item) => {
        // 1. Filter tipe (Masuk/Keluar)
        if (item.tipe.toUpperCase() !== modalRincian.tipe) return false;

        // 2. Filter pencarian
        if (searchMutasi) {
            const keyword = searchMutasi.toLowerCase();
            const matchKategori = item.kategori?.toLowerCase().includes(keyword);
            const matchKeterangan = item.keterangan?.toLowerCase().includes(keyword);
            if (!matchKategori && !matchKeterangan) return false;
        }

        // 3. Filter rentang tanggal
        const itemTime = Number(item.tanggal);
        if (startDate) {
            const start = new Date(startDate).setHours(0, 0, 0, 0);
            if (itemTime < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate).setHours(23, 59, 59, 999);
            if (itemTime > end) return false;
        }

        return true;
    });

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Laporan Kas Keuangan</h1>
                <button 
                    onClick={() => setModalTarik(true)}
                    disabled={totalSaldoAktual <= 0}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                    + Tarik Saldo
                </button>
            </div>

            {/* Filter Rentang Tanggal */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex gap-4 items-end">
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Dari Tanggal</label>
                    <input type="date" className="border p-2 rounded text-sm w-40 outline-none focus:border-blue-500" value={tglAwal} onChange={(e) => setTglAwal(e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Sampai Tanggal</label>
                    <input type="date" className="border p-2 rounded text-sm w-40 outline-none focus:border-blue-500" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 text-gray-500 animate-pulse font-medium">Memuat data kas...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Saldo Akhir */}
                    <div className="bg-gray-800 rounded-xl p-6 shadow-lg text-white">
                        <div className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Total Saldo (All-Time)</div>
                        <div className={`text-3xl font-black truncate ${totalSaldoAktual < 0 ? 'text-red-400' : 'text-white'}`}>
                            {formatRp(totalSaldoAktual)}
                        </div>
                    </div>

                    {/* Pemasukan */}
                    <div 
                        onClick={() => setModalRincian({ isOpen: true, tipe: 'MASUK' })}
                        className="bg-white border-l-4 border-green-500 rounded-xl p-6 shadow-sm hover:shadow-md transition cursor-pointer group"
                    >
                        <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2 group-hover:text-green-600 transition">Pemasukan (Periode)</div>
                        <div className="text-2xl font-black text-gray-800 truncate">{formatRp(summaryMutasi.masuk)}</div>
                        <div className="text-xs text-gray-400 mt-2 flex justify-between">
                            <span>{tglAwal} s/d {tglAkhir}</span>
                            <span className="text-green-500 font-bold">Detail &rarr;</span>
                        </div>
                    </div>

                    {/* Pengeluaran */}
                    <div 
                        onClick={() => setModalRincian({ isOpen: true, tipe: 'KELUAR' })}
                        className="bg-white border-l-4 border-red-500 rounded-xl p-6 shadow-sm hover:shadow-md transition cursor-pointer group"
                    >
                        <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2 group-hover:text-red-600 transition">Pengeluaran (Periode)</div>
                        <div className="text-2xl font-black text-gray-800 truncate">{formatRp(summaryMutasi.keluar)}</div>
                        <div className="text-xs text-gray-400 mt-2 flex justify-between">
                            <span>{tglAwal} s/d {tglAkhir}</span>
                            <span className="text-red-500 font-bold">Detail &rarr;</span>
                        </div>
                    </div>
                </div>
            )}

{/* MODAL RINCIAN KAS */}
            {modalRincian.isOpen && (
               <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className={`px-6 py-4 border-b flex justify-between items-center ${modalRincian.tipe === 'MASUK' ? 'bg-green-600' : 'bg-red-600'}`}>
                            <h3 className="text-white font-bold text-lg uppercase tracking-wider">
                                Detail {modalRincian.tipe === 'MASUK' ? 'Pemasukan' : 'Pengeluaran'} Kas
                            </h3>
                            <button 
                                onClick={() => {
                                    setModalRincian({ isOpen: false, tipe: '' });
                                    setSearchMutasi('');
                                    setStartDate('');
                                    setEndDate('');
                                }} 
                                className="text-white font-black text-2xl hover:text-gray-200"
                            >
                                &times;
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                            {/* --- FORM FILTER DATA --- */}
                            <div className="flex flex-col md:flex-row gap-4 mb-4 items-end bg-white p-4 rounded-lg border shadow-sm">
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Pencarian</label>
                                    <input 
                                        type="text" 
                                        placeholder="Cari kategori atau keterangan..."
                                        value={searchMutasi}
                                        onChange={(e) => setSearchMutasi(e.target.value)}
                                        className="w-full border rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="w-full md:w-auto">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Dari Tanggal</label>
                                    <input 
                                        type="date" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full border rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="w-full md:w-auto">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Sampai Tanggal</label>
                                    <input 
                                        type="date" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full border rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                {(searchMutasi || startDate || endDate) && (
                                    <button 
                                        onClick={() => { setSearchMutasi(''); setStartDate(''); setEndDate(''); }}
                                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm font-semibold transition-colors"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>

                            {/* --- TABEL DATA --- */}
                            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-100 border-b">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Tanggal</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Kategori</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Keterangan</th>
                                            <th className="text-right py-3 px-4 font-semibold text-gray-700">Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDataMutasi.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center py-8 text-gray-500">Tidak ada data yang sesuai filter.</td></tr>
                                        ) : (
                                            filteredDataMutasi.map((item) => (
                                                <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                                                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                                                        {new Date(Number(item.tanggal)).toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="py-3 px-4 font-bold text-gray-700">{item.kategori}</td>
                                                    <td className="py-3 px-4 text-gray-600">{item.keterangan}</td>
                                                    <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${modalRincian.tipe === 'MASUK' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatRp(item.jumlah)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TARIK SALDO */}
            {modalTarik && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-blue-600 px-6 py-4 border-b flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg">Tarik Saldo Kas</h3>
                            <button onClick={() => setModalTarik(false)} className="text-white font-black text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleTarikSaldo} className="p-6 bg-gray-50">
                            <div className="mb-4">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Total Saldo Tersedia</label>
                                <div className="text-2xl font-black text-gray-800">{formatRp(totalSaldoAktual)}</div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Jumlah Penarikan (Rp)</label>
                                <input 
                                    type="number" 
                                    required min="1" max={totalSaldoAktual}
                                    className="w-full border-2 border-gray-300 p-3 rounded-lg text-lg font-bold focus:border-blue-500 outline-none"
                                    value={formTarik.jumlah}
                                    onChange={(e) => setFormTarik({...formTarik, jumlah: e.target.value})}
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Keterangan / Tujuan</label>
                                <textarea 
                                    required rows="2"
                                    className="w-full border-2 border-gray-300 p-3 rounded-lg text-sm focus:border-blue-500 outline-none"
                                    value={formTarik.keterangan}
                                    onChange={(e) => setFormTarik({...formTarik, keterangan: e.target.value})}
                                    placeholder="Contoh: Setor ke Bank"
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setModalTarik(false)} className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">
                                    {isSubmitting ? 'Proses...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}