import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function KategoriPage() {
  const [kategoriList, setKategoriList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, nama_kategori: '' });
  const [isEdit, setIsEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchKategori();
  }, []);

  const fetchKategori = async () => {
    const { data, error } = await supabase
      .from('kategori')
      .select('*')
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error Fetch Kategori:", error.message);
    } else {
      setKategoriList(data || []);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    let supabaseError = null;

    if (isEdit) {
      const { error } = await supabase
        .from('kategori')
        .update({ nama_kategori: formData.nama_kategori })
        .eq('id', formData.id);
      supabaseError = error;
    } else {
      const { error } = await supabase
        .from('kategori')
        .insert([{
          nama_kategori: formData.nama_kategori
        }]);
      supabaseError = error;
    }

    setIsLoading(false);

    if (supabaseError) {
      alert(`Gagal menyimpan data: ${supabaseError.message}`);
    } else {
      setModalOpen(false);
      fetchKategori();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus kategori ini?')) return;

    const { error } = await supabase
      .from('kategori')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      alert(`Gagal menghapus data: ${error.message}`);
    } else {
      fetchKategori();
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-bold">Data Kategori</h2>
        <button
          onClick={() => { setFormData({ id: null, nama_kategori: '' }); setIsEdit(false); setModalOpen(true); }}
          className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition-colors"
        >
          + Tambah Kategori
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-3 font-semibold">Nama Kategori</th>
              <th className="p-3 text-center font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {kategoriList.length > 0 ? (
              kategoriList.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-3">{item.nama_kategori}</td>
                  <td className="p-3 flex justify-center gap-4">
                    <button
                      onClick={() => { setFormData(item); setIsEdit(true); setModalOpen(true); }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" className="p-4 text-center text-gray-500">
                  Tidak ada data kategori.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-lg mb-4">{isEdit ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
            <form onSubmit={handleSubmit}>
              <input
                className="w-full border border-gray-300 p-2 mb-4 rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                placeholder="Nama Kategori"
                value={formData.nama_kategori}
                onChange={(e) => setFormData({ ...formData, nama_kategori: e.target.value })}
                required
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  disabled={isLoading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}