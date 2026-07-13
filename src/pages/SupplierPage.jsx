import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function SupplierPage() {
  const [supplierList, setSupplierList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({ nama_supplier: '', kontak: '', alamat: '' });
  const [editId, setEditId] = useState(null);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => { 
    fetchSupplier(); 
  }, []);

  const fetchSupplier = async () => {
    const { data, error } = await supabase
      .from('supplier')
      .select('*')
      .eq('is_deleted', false)
      .order('nama_supplier');
    
    if (error) console.error("Error Fetch Supplier:", error.message);
    else setSupplierList(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      nama_supplier: formData.nama_supplier,
      kontak: formData.kontak,
      alamat: formData.alamat
    };

    if (isEdit && editId) {
      await supabase.from('supplier').update(payload).eq('id', editId);
    } else {
      await supabase.from('supplier').insert([payload]);
    }
    
    setModalOpen(false);
    fetchSupplier();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus supplier ini?')) return;
    await supabase.from('supplier').update({ is_deleted: true }).eq('id', id);
    fetchSupplier();
  };

  const resetForm = () => {
    setFormData({ nama_supplier: '', kontak: '', alamat: '' });
    setEditId(null);
    setIsEdit(false);
  };

  const handleEditClick = (item) => {
    setFormData({
      nama_supplier: item.nama_supplier,
      kontak: item.kontak,
      alamat: item.alamat
    });
    setEditId(item.id);
    setIsEdit(true);
    setModalOpen(true);
  };

  return (
    <div className="p-4">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-bold">Data Supplier</h2>
        <button 
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700"
        >
          + Tambah Supplier
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-3">Nama Supplier</th>
              <th className="p-3">Kontak</th>
              <th className="p-3">Alamat</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {supplierList.map((item) => (
              <tr key={item.id}>
                <td className="p-3">{item.nama_supplier}</td>
                <td className="p-3">{item.kontak || '-'}</td>
                <td className="p-3">{item.alamat || '-'}</td>
                <td className="p-3 flex justify-center gap-2">
                  <button onClick={() => handleEditClick(item)} className="text-blue-600">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="text-red-600">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm">
            <h2 className="font-bold mb-4">{isEdit ? 'Edit Supplier' : 'Tambah Supplier'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-2">
                <label className="block text-sm font-medium">Nama Supplier</label>
                <input 
                  className="w-full border p-2 rounded" 
                  value={formData.nama_supplier} onChange={(e) => setFormData({...formData, nama_supplier: e.target.value})} required
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium">Kontak</label>
                <input 
                  className="w-full border p-2 rounded" 
                  value={formData.kontak || ''} onChange={(e) => setFormData({...formData, kontak: e.target.value})} 
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium">Alamat</label>
                <textarea 
                  className="w-full border p-2 rounded" 
                  value={formData.alamat || ''} onChange={(e) => setFormData({...formData, alamat: e.target.value})} 
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}