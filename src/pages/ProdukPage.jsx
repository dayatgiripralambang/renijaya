import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import imageCompression from 'browser-image-compression';

export default function ProdukPage() {
  const [produkList, setProdukList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diskonList, setDiskonList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKategori, setSelectedKategori] = useState('');
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const limit = 10;

  // State Sorting
  const [sortColumn, setSortColumn] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  // State Modal & Form
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    barcode: '',
    nama: '',
    kategori: '',
    supplier: '',
    satuan: '',
    stok: 0,
    harga_modal: 0,
    harga_jual: 0,
    gambar: '',
    fileImage: null
  });

  useEffect(() => {
    const fetchKategori = async () => {
      const { data } = await supabase
        .from('kategori')
        .select('nama_kategori')
        .or('is_deleted.eq.false,is_deleted.is.null');
      if (data) setKategoriList(data);
    };

    const fetchSupplier = async () => {
      const { data, error } = await supabase
        .from('supplier') // Pastikan nama tabel di Supabase adalah 'supplier'
        .select('nama_supplier') // Pastikan nama kolom adalah 'nama_supplier'
        .or('is_deleted.eq.false,is_deleted.is.null'); // Abaikan data yang sudah dihapus sementara

      if (error) {
        console.error("Error fetch supplier:", error);
      } else if (data) {
        setSupplierList(data);
      }
    };

    fetchKategori();
    fetchSupplier(); // Pemanggilan untuk mengisi dropdown supplier
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProduk();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedKategori, page, sortColumn, sortDirection]);
  useEffect(() => {
  const fetchActiveDiskon = async () => {
    const { data } = await supabase
      .from('diskon')
      .select('*')
      .eq('is_aktif', true);
    if (data) setDiskonList(data);
  };
  fetchActiveDiskon();
}, []);

  const fetchSupplier = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier')
        .select('*'); // Ambil semua kolom untuk debugging

      if (error) throw error;

      console.log("Data Supplier dari Supabase:", data); // CEK CONSOLE BROWSER
      setSupplierList(data || []);
    } catch (error) {
      console.error("Gagal mengambil data supplier:", error.message);
    }
  };

  const fetchProduk = async () => {
    setLoading(true);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('produk')
      .select('*', { count: 'exact' })
      // Filter produk yang belum dihapus
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order(sortColumn, { ascending: sortDirection === 'asc' })
      .range(from, to);

    if (searchTerm) {
      query = query.ilike('nama', `%${searchTerm}%`);
    }

    if (selectedKategori) {
      query = query.eq('kategori', selectedKategori);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Error Fetch Produk:", error.message);
    } else {
      const dataDenganGambarKecil = (data || []).map((item) => {
        if (item.gambar && !item.gambar.startsWith('http')) {
          const { data: publicUrlData } = supabase
            .storage
            .from('produk_images')
            .getPublicUrl(item.gambar, {
              transform: { width: 100, height: 100, resize: 'cover' }
            });
          return { ...item, gambar_optimized: publicUrlData.publicUrl };
        }
        return { ...item, gambar_optimized: item.gambar };
      });

      setProdukList(dataDenganGambarKecil);
      setTotalData(count || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
  const fetchActiveDiskon = async () => {
    const { data } = await supabase
      .from('diskon')
      .select('*')
      .eq('is_aktif', true);
    if (data) setDiskonList(data);
  };
  fetchActiveDiskon();
}, []);

  // --- LOGIKA UPLOAD & KOMPRESI ---
  const handleUploadGambar = async (fileAsli) => {
    const options = {
      maxSizeMB: 0.1, // Maksimal 100KB
      maxWidthOrHeight: 400,
      useWebWorker: true,
      fileType: 'image/webp'
    };

    try {
      const compressedFile = await imageCompression(fileAsli, options);
      const namaFile = `${Date.now()}_${compressedFile.name.replace(/\.[^/.]+$/, "")}.webp`; // Paksa ekstensi .webp

      const { error } = await supabase.storage
        .from('produk_images')
        .upload(namaFile, compressedFile, { cacheControl: '3600', upsert: false });

      if (error) throw error;
      return namaFile;
    } catch (error) {
      console.error("Gagal kompresi/upload:", error);
      return null;
    }
  };

  // --- HANDLER TOMBOL ---
  const handleAddClick = () => {
    setFormData({ barcode: '', nama: '', kategori: '', stok: 0, harga_jual: 0, gambar: '', fileImage: null });
    setIsEdit(false);
    setModalOpen(true);
  };

const handleEditClick = (item) => {
    setFormData({
      barcode: item.barcode,
      nama: item.nama,
      kategori: item.kategori,
      stok: item.stok,
      harga_jual: item.harga_jual,
      
      // TAMBAHKAN 3 BARIS INI
      supplier: item.supplier || '',
      satuan: item.satuan || '',
      harga_modal: item.harga_modal || 0,
      
      gambar: item.gambar,
      gambarPreview: item.gambar_optimized, 
      fileImage: null
    });
    setIsEdit(true);
    setModalOpen(true);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus produk ${item.nama}? Data akan diarsipkan.`)) return;

    // Lakukan Soft Delete
    const { error } = await supabase
      .from('produk')
      .update({ is_deleted: true }) // Ubah flag menjadi true
      .eq('barcode', item.barcode);

    if (error) {
      alert(`Gagal menghapus data: ${error.message}`);
    } else {
      // Data akan hilang dari list karena fetchProduk akan memfilter is_deleted: false
      fetchProduk();
    }
  };

  // --- HANDLER SUBMIT FORM ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    let finalNamaGambar = formData.gambar;

    // Jika user memilih file gambar baru
    if (formData.fileImage) {
      const uploadedFilename = await handleUploadGambar(formData.fileImage);
      if (uploadedFilename) {
        finalNamaGambar = uploadedFilename;

        // Jika ini edit, hapus gambar lama dari storage untuk menghemat ruang
        if (isEdit && formData.gambar && !formData.gambar.startsWith('http')) {
          await supabase.storage.from('produk_images').remove([formData.gambar]);
        }
      } else {
        alert("Gagal memproses gambar. Penyimpanan dibatalkan.");
        setIsSubmitting(false);
        return;
      }
    }

    // PERBAIKAN: Tambahkan supplier dan harga_modal ke dalam payload
    const payload = {
      barcode: formData.barcode,
      nama: formData.nama,
      kategori: formData.kategori,
      supplier: formData.supplier,
      satuan: formData.satuan,
      stok: formData.stok,
      harga_modal: formData.harga_modal,
      harga_jual: formData.harga_jual,
      gambar: finalNamaGambar
    };

    let dbError = null;

    if (isEdit) {
      const { error } = await supabase.from('produk').update(payload).eq('barcode', formData.barcode);
      dbError = error;
    } else {
      const { error } = await supabase.from('produk').insert([payload]);
      dbError = error;
    }

    setIsSubmitting(false);

    if (dbError) {
      // PostgreSQL error code 23505 menandakan Unique Violation (Duplikat Data)
      if (dbError.code === '23505' || dbError.message.includes('duplicate key')) {
        alert("Gagal menyimpan: Barcode tersebut sudah terdaftar pada produk lain. Silakan gunakan barcode yang berbeda.");
      } else {
        alert(`Gagal menyimpan: Terjadi kesalahan (${dbError.message})`);
      }
    } else {
      setModalOpen(false);
      fetchProduk();
    }
  };

  // --- HANDLER SORTING ---
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (column) => {
    if (sortColumn !== column) return <span className="text-gray-400 ml-1 text-xs">⇅</span>;
    return sortDirection === 'asc' ? <span className="ml-1 text-green-600 text-xs">▲</span> : <span className="ml-1 text-green-600 text-xs">▼</span>;
  };

  const totalPages = Math.ceil(totalData / limit);
  // Fungsi untuk menghitung harga setelah diskon
const hitungHarga = (produk) => {
    // Cari diskon yang cocok
    const diskon = diskonList.find((d) => {
      let match = false;
      if (d.tipe === 'Kategori') match = d.target === produk.kategori;
      else if (d.tipe === 'Supplier') match = d.target === produk.supplier;
      else if (d.tipe === 'Produk Spesifik') match = d.target.includes(`(${produk.barcode})`);
      else if (d.tipe === 'Transaksi') match = true;
      return match;
    });

    if (!diskon) return { hargaAsli: produk.harga_jual, hargaAkhir: null };

    // Sanitasi jenis diskon agar tidak peduli huruf besar/kecil atau spasi
    const jenis = (diskon.jenis || '').toLowerCase().trim();
    const nominal = Number(diskon.nominal) || 0;
    const hargaAsli = Number(produk.harga_jual) || 0;
    
    let hargaAkhir = hargaAsli;

    // Cek dengan pencocokan string yang lebih longgar
    if (jenis.includes('persen')) {
      hargaAkhir = hargaAsli - (hargaAsli * (nominal / 100));
    } else if (jenis.includes('nominal') || jenis.includes('rp')) {
      hargaAkhir = hargaAsli - nominal;
    }

    // Debugging: Buka console browser untuk memastikan perhitungan berjalan
    console.log(`Debug Diskon: ${produk.nama} | Jenis: ${jenis} | Asli: ${hargaAsli} | Akhir: ${hargaAkhir}`);

    return { hargaAsli, hargaAkhir: Math.max(0, hargaAkhir) };
  };
  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold">Manajemen Produk</h2>
        <button
          onClick={handleAddClick}
          className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition-colors"
        >
          + Tambah Produk
        </button>
      </div>

      <div className="mb-4 flex flex-col md:flex-row gap-4 bg-white p-4 rounded shadow border">
        <input
          type="text"
          placeholder="Cari nama atau barcode..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 outline-none w-full md:w-1/2"
        />
        <select
          value={selectedKategori}
          onChange={(e) => { setSelectedKategori(e.target.value); setPage(1); }}
          className="border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 outline-none w-full md:w-1/4"
        >
          <option value="">Semua Kategori</option>
          {kategoriList.map((kat, index) => (
            <option key={index} value={kat.nama_kategori}>{kat.nama_kategori}</option>
          ))}
        </select>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-3 font-semibold text-center">Gambar</th>
              <th className="p-3 font-semibold cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('barcode')}>
                Barcode {renderSortIcon('barcode')}
              </th>
              <th className="p-3 font-semibold cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('nama')}>
                Nama {renderSortIcon('nama')}
              </th>
              <th className="p-3 font-semibold cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('kategori')}>
                Kategori {renderSortIcon('kategori')}
              </th>
              <th className="p-3 font-semibold text-right cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('stok')}>
                Stok {renderSortIcon('stok')}
              </th>
              <th className="p-3 font-semibold text-right cursor-pointer hover:bg-gray-200 select-none" onClick={() => handleSort('harga_jual')}>
                Harga {renderSortIcon('harga_jual')}
              </th>
              <th className="p-3 text-center font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan="7" className="p-6 text-center text-gray-500">Memuat data...</td>
              </tr>
            ) : produkList.length > 0 ? (
              produkList.map((item) => (
                <tr key={item.barcode} className="hover:bg-gray-50">
                  <td className="p-3 text-center">
                    {/* Perbaikan: Menggunakan gambar_optimized */}
                    {item.gambar_optimized ? (
                      <img
                        src={item.gambar_optimized}
                        alt={item.nama}
                        className="w-12 h-12 object-cover rounded mx-auto border bg-gray-100"
                        loading="lazy"
                        disabled="async"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = '<div class="w-12 h-12 bg-gray-200 flex items-center justify-center rounded mx-auto text-xs text-gray-500 border">Error</div>';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 flex items-center justify-center rounded mx-auto text-xs text-gray-500 border">Kosong</div>
                    )}
                  </td>
                  <td className="p-3">{item.barcode}</td>
                  <td className="p-3 font-medium">{item.nama}</td>
                  <td className="p-3">{item.kategori}</td>
                  <td className="p-3 text-right">{item.stok}</td>
<td className="p-3 text-right">
  {(() => {
    const { hargaAsli, hargaAkhir } = hitungHarga(item);
    
    if (hargaAkhir !== null && hargaAkhir < hargaAsli) {
      return (
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-500 line-through">
            Rp {hargaAsli.toLocaleString('id-ID')}
          </span>
          <span className="text-sm font-bold text-red-600">
            Rp {hargaAkhir.toLocaleString('id-ID')}
          </span>
        </div>
      );
    }
    return <span>Rp {hargaAsli.toLocaleString('id-ID')}</span>;
  })()}
</td>
                  <td className="p-3 flex justify-center gap-4 items-center h-full mt-2">
                    <button onClick={() => handleEditClick(item)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                    <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800 font-medium">Hapus</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="p-6 text-center text-gray-500">Produk tidak ditemukan.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col md:flex-row justify-between items-center bg-white p-3 rounded shadow border gap-4">
        <span className="text-sm text-gray-600">
          Menampilkan {totalData === 0 ? 0 : (page - 1) * limit + 1} - {Math.min(page * limit, totalData)} dari {totalData} data
        </span>
        <div className="flex gap-2">
          <button onClick={() => setPage(page - 1)} disabled={page === 1 || loading} className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-300">Sebelumnya</button>
          <button onClick={() => setPage(page + 1)} disabled={page === totalPages || totalPages === 0 || loading} className="px-3 py-1 bg-gray-200 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-300">Selanjutnya</button>
        </div>
      </div>

      {/* --- MODAL FORM --- */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          {/* Ubah max-w-md menjadi max-w-lg agar layout kolom lebih leluasa */}
          <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-xl my-8">
            <h2 className="font-bold text-lg mb-4">{isEdit ? 'Edit Produk' : 'Tambah Produk'}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Baris 1: Barcode & Nama Produk */}
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="text-sm text-gray-600 mb-1 block">Barcode</label>
                  <input
                    type="text"
                    required
                    disabled={isEdit}
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className={`w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none ${isEdit ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                    placeholder="Misal: 89912345678"
                  />
                </div>
                <div className="w-1/2">
                  <label className="text-sm text-gray-600 mb-1 block">Nama Produk</label>
                  <input
                    type="text"
                    required
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>

              {/* Baris 2: Kategori & Supplier */}
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="text-sm text-gray-600 mb-1 block">Kategori</label>
                  <select
                    required
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">Pilih Kategori</option>
                    {kategoriList.map((kat, idx) => (
                      <option key={idx} value={kat.nama_kategori}>{kat.nama_kategori}</option>
                    ))}
                  </select>
                </div>
                <div className="w-1/2">
                  <label className="text-sm text-gray-600 mb-1 block">Supplier</label>
                  <select
                    required
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">Pilih Supplier</option>
                    {supplierList?.map((sup, idx) => (
                      <option key={idx} value={sup.nama_supplier}>{sup.nama_supplier}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stok, Satuan, Harga Modal, Harga Jual */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Stok</label>
                  <input
                    type="number" required min="0"
                    value={formData.stok}
                    onChange={(e) => setFormData({ ...formData, stok: parseInt(e.target.value) || 0 })}
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>

                {/* INI KOLOM SATUAN YANG BARU */}
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Satuan</label>
                  <input
                    type="text" required
                    value={formData.satuan}
                    onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Misal: Pcs, Cup"
                  />
                </div>

                    {/* Input Harga Modal */}
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Harga Modal</label>
                      <input
                        type="text" required
                        value={formData.harga_modal ? new Intl.NumberFormat('id-ID').format(formData.harga_modal) : ''}
                        onChange={(e) => {
                          // Menghapus semua karakter selain angka (seperti titik)
                          const rawValue = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, harga_modal: parseInt(rawValue) || 0 });
                        }}
                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>

                    {/* Input Harga Jual */}
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Harga Jual</label>
                      <input
                        type="text" required
                        value={formData.harga_jual ? new Intl.NumberFormat('id-ID').format(formData.harga_jual) : ''}
                        onChange={(e) => {
                          // Menghapus semua karakter selain angka (seperti titik)
                          const rawValue = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, harga_jual: parseInt(rawValue) || 0 });
                        }}
                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
              </div>

              {/* Baris 4: Gambar */}
              <div>
                <label className="text-sm text-gray-600 mb-1 block">
                  Gambar Produk {isEdit && '(Opsional: Pilih untuk mengganti)'}
                </label>

                {(formData.fileImage || formData.gambarPreview) && (
                  <div className="mb-2">
                    <img
                      src={formData.fileImage ? URL.createObjectURL(formData.fileImage) : formData.gambarPreview}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded border bg-gray-100"
                    />
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, fileImage: e.target.files[0] })}
                  className="w-full border p-2 rounded text-sm bg-white"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}