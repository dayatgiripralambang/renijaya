import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Diskon() {
  const [diskonList, setDiskonList] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // State untuk Data Pilihan Target
  const [kategoriList, setKategoriList] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  const [produkList, setProdukList] = useState([]);
  
  // State Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [formData, setFormData] = useState({
    nama_promo: '',
    tipe: 'Transaksi',
    target: 'SEMUA TRANSAKSI',   
    jenis: 'Persentase (%)', 
    nominal: 0,
    is_aktif: true
  });

  useEffect(() => {
    fetchDiskon();
    fetchOptionsData(); // Ambil list kategori, supplier, produk
  }, []);

  const fetchDiskon = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('diskon')
      .select('*')
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('created_at', { ascending: false });

    if (!error && data) setDiskonList(data);
    setLoading(false);
  };

  const fetchOptionsData = async () => {
    // Fetch Kategori
    const { data: katData } = await supabase.from('kategori').select('nama_kategori').or('is_deleted.eq.false,is_deleted.is.null');
    if (katData) setKategoriList(katData);

    // Fetch Supplier
    const { data: supData } = await supabase.from('supplier').select('nama_supplier').or('is_deleted.eq.false,is_deleted.is.null');
    if (supData) setSupplierList(supData);

    // Fetch Produk
    const { data: prodData } = await supabase.from('produk').select('barcode, nama').or('is_deleted.eq.false,is_deleted.is.null');
    if (prodData) setProdukList(prodData);
  };

  const handleSimpan = async (e) => {
    e.preventDefault();
    if (formData.nominal <= 0) return alert("Nominal diskon harus lebih dari 0");
    if (!formData.target) return alert("Target spesifik harus dipilih!");

    const payload = {
      nama_promo: formData.nama_promo,
      tipe: formData.tipe,
      target: formData.target,
      jenis: formData.jenis,
      nominal: formData.nominal,
      is_aktif: formData.is_aktif
    };

    if (isEdit) {
      const { error } = await supabase.from('diskon').update(payload).eq('id', editId);
      if (error) alert(`Gagal update: ${error.message}`);
    } else {
      const { error } = await supabase.from('diskon').insert([payload]);
      if (error) alert(`Gagal simpan: ${error.message}`);
    }

    setModalOpen(false);
    fetchDiskon();
  };

  const handleEdit = (item) => {
    setIsEdit(true);
    setEditId(item.id);
    setFormData({
      nama_promo: item.nama_promo,
      tipe: item.tipe,
      target: item.target,
      jenis: item.jenis,
      nominal: item.nominal,
      is_aktif: item.is_aktif
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus diskon ini?")) return;
    const { error } = await supabase.from('diskon').update({ is_deleted: true }).eq('id', id);
    if (!error) fetchDiskon();
  };

  const toggleAktif = async (id, currentStatus) => {
    const { error } = await supabase.from('diskon').update({ is_aktif: !currentStatus }).eq('id', id);
    if (!error) fetchDiskon();
  };

  // Dinamis Handle saat tipe berubah
const handleTipeChange = (e) => {
    const newTipe = e.target.value;
    setFormData(prev => ({ 
        ...prev, 
        tipe: newTipe, 
        target: newTipe === 'Transaksi' ? 'SEMUA TRANSAKSI' : '' 
    }));
};

  const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Setting Diskon & Promo</h1>
        <button 
          onClick={() => {
            setIsEdit(false);
            setFormData({ nama_promo: '', tipe: 'Transaksi', target: 'SEMUA', jenis: 'PERSEN', nominal: 0, is_aktif: true });
            setModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-md"
        >
          + Tambah Diskon
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Nama Promo</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Tipe / Target</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Potongan</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center py-8 text-gray-500">Memuat data...</td></tr>
            ) : diskonList.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-8 text-gray-500">Belum ada data diskon.</td></tr>
            ) : (
              diskonList.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-bold text-gray-800">{item.nama_promo}</td>
                  <td className="py-3 px-4">
                    <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-bold mr-2">{item.tipe}</span>
                    <span className="text-gray-600 font-medium">{item.target}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-blue-600">
                    {item.jenis === 'PERSEN' ? `${item.nominal}%` : formatRp(item.nominal)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button 
                      onClick={() => toggleAktif(item.id, item.is_aktif)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition ${item.is_aktif ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {item.is_aktif ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => handleEdit(item)} className="text-blue-500 hover:text-blue-700 mr-3 font-semibold">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL FORM DISKON */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">{isEdit ? 'Edit Diskon' : 'Tambah Diskon Baru'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-white font-black text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSimpan} className="p-6">
              <div className="mb-4">
                <label className="text-sm text-gray-600 font-bold mb-1 block">Nama Promo / Deskripsi</label>
                <input 
                  type="text" required
                  value={formData.nama_promo} 
                  onChange={(e) => setFormData({...formData, nama_promo: e.target.value})}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="Misal: Promo Akhir Tahun"
                />
              </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
<div>
  <label className="text-sm text-gray-600 font-bold mb-1 block">Tipe Target</label>
  <select 
    value={formData.tipe} 
    onChange={handleTipeChange}
    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
  >
    <option value="Transaksi">Transaksi</option>
    <option value="Kategori">Kategori</option>
    <option value="Supplier">Supplier</option>
    <option value="Produk Spesifik">Produk Spesifik</option>
  </select>
</div>

                        {/* LOGIKA DROPDOWN TARGET DINAMIS */}
                        <div>
                        <label className="text-sm text-gray-600 font-bold mb-1 block">Pilih Target Spesifik</label>
                        
                        {/* Kondisi untuk Transaksi */}
                        {formData.tipe === 'Transaksi' && (
                            <input 
                            type="text" 
                            readOnly 
                            value="SEMUA TRANSAKSI" 
                            className="w-full border p-2 rounded bg-gray-100 text-gray-500 outline-none cursor-not-allowed font-bold"
                            />
                        )}

  {/* Kondisi untuk Kategori */}
  {formData.tipe === 'Kategori' && (
    <select required value={formData.target} onChange={(e) => setFormData({...formData, target: e.target.value})} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
      <option value="">-- Pilih Kategori --</option>
      {kategoriList.map((k, i) => <option key={i} value={k.nama_kategori}>{k.nama_kategori}</option>)}
    </select>
  )}

  {/* Kondisi untuk Supplier */}
  {formData.tipe === 'Supplier' && (
    <select required value={formData.target} onChange={(e) => setFormData({...formData, target: e.target.value})} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
      <option value="">-- Pilih Supplier --</option>
      {supplierList.map((s, i) => <option key={i} value={s.nama_supplier}>{s.nama_supplier}</option>)}
    </select>
  )}

  {/* Kondisi untuk Produk Spesifik */}
  {formData.tipe === 'Produk Spesifik' && (
    <select required value={formData.target} onChange={(e) => setFormData({...formData, target: e.target.value})} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
      <option value="">-- Pilih Produk --</option>
      {produkList.map((p, i) => (
        <option key={i} value={`${p.nama} (${p.barcode})`}>
          {p.nama} ({p.barcode})
        </option>
      ))}
    </select>
  )}
</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                        <label className="text-sm text-gray-600 font-bold mb-1 block">Jenis Potongan</label>
                        <select 
                            value={formData.jenis} 
                            onChange={(e) => setFormData({...formData, jenis: e.target.value})}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {/* Pastikan value SAMA PERSIS dengan format Android */}
                            <option value="Persentase (%)">Persentase (%)</option>
                            <option value="Nominal (Rp)">Nominal (Rp)</option>
                        </select>
                        </div>
                        <div>
                        <label className="text-sm text-gray-600 font-bold mb-1 block">
                            Besaran {formData.jenis === 'PERSEN' ? '(%)' : '(Rp)'}
                        </label>
                        <input 
                            type="text" required
                            value={formData.jenis === 'NOMINAL' && formData.nominal ? new Intl.NumberFormat('id-ID').format(formData.nominal) : formData.nominal || ''}
                            onChange={(e) => {
                            const rawValue = e.target.value.replace(/\D/g, '');
                            let val = parseInt(rawValue) || 0;
                            if (formData.jenis === 'PERSEN' && val > 100) val = 100; // Mencegah diskon lebih dari 100%
                            setFormData({...formData, nominal: val});
                            }}
                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        </div>
                    </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300">Batal</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}