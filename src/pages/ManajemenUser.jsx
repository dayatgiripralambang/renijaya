import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ManajemenUser() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); 
  const [formData, setFormData] = useState({
    id: '',
    email: '',
    password: '',
    nama: '',
    role: 'kasir'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_deleted', false)      // WAJIB: Hanya ambil yang belum dihapus
      .neq('role', 'superuser')    // Sembunyikan superuser
      .order('created_at', { ascending: false });

    if (error) {
      showMessage('Gagal memuat data pengguna.', 'error');
    } else {
      setUsers(data);
    }
    setLoading(false);
  };

  const openModal = (mode, user = null) => {
    setModalMode(mode);
    if (mode === 'edit' && user) {
      setFormData({
        id: user.id,
        email: user.email,
        password: '', // Dikosongkan, hanya diisi jika ingin update password
        nama: user.nama || '',
        role: user.role || 'kasir'
      });
    } else {
      setFormData({ id: '', email: '', password: '', nama: '', role: 'kasir' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ id: '', email: '', password: '', nama: '', role: 'kasir' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1. Cek apakah email sudah terdaftar di database
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', formData.email)
      .maybeSingle();

    // LOGIKA RESTORE (Jika user pernah ada dan di-soft delete)
    if (existingUser && existingUser.is_deleted) {
      const { error: restoreError } = await supabase
        .from('users')
        .update({ 
          nama: formData.nama, 
          role: formData.role, 
          is_deleted: false 
        })
        .eq('id', existingUser.id);

      if (restoreError) {
        showMessage('Gagal mengaktifkan kembali pengguna.', 'error');
      } else {
        if (formData.password.trim() !== '') {
            await supabase.functions.invoke('update-user-password', {
                body: { targetUserId: existingUser.id, newPassword: formData.password }
            });
        }
        showMessage('Pengguna berhasil diaktifkan kembali.');
        fetchUsers();
        closeModal();
      }
      setLoading(false);
      return;
    }

    // LOGIKA CREATE BARU
    if (modalMode === 'create') {
      if (existingUser && !existingUser.is_deleted) {
        showMessage('Email sudah terdaftar dan aktif.', 'error');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        showMessage(`Gagal: ${authError.message}`, 'error');
        setLoading(false);
        return;
      }

      if (authData.user) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ nama: formData.nama, role: formData.role, is_deleted: false })
          .eq('id', authData.user.id);
        
        if (updateError) {
          showMessage(`Gagal menyimpan detail pengguna: ${updateError.message}`, 'error');
        } else {
          showMessage('Pengguna baru berhasil ditambahkan.');
          fetchUsers();
          closeModal();
        }
      }
    } 
    // LOGIKA EDIT
    else if (modalMode === 'edit') {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          nama: formData.nama,
          role: formData.role
        })
        .eq('id', formData.id);

      if (updateError) {
        showMessage(`Gagal mengupdate pengguna: ${updateError.message}`, 'error');
      } else {
        if (formData.password.trim() !== '') {
          const { error: pwError } = await supabase.functions.invoke('update-user-password', {
            body: { targetUserId: formData.id, newPassword: formData.password }
          });
          
          if (pwError) {
             showMessage('Detail tersimpan, tetapi gagal mengubah password.', 'error');
             setLoading(false);
             return;
          }
        }
        showMessage('Pengguna berhasil diperbarui.');
        fetchUsers();
        closeModal();
      }
    }
    
    setLoading(false);
  };

  const handleDelete = async (id, email) => {
    const confirmDelete = window.confirm(`PERINGATAN!\n\nApakah Anda yakin ingin menghapus akses ${email}? Akun tidak bisa login lagi.`);
    if (!confirmDelete) return;

    setLoading(true);

    // Soft Delete: Hanya ubah flag is_deleted menjadi true
    const { error } = await supabase
      .from('users')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      showMessage(`Gagal menghapus pengguna: ${error.message}`, 'error');
    } else {
      showMessage('Pengguna berhasil dihapus.');
      fetchUsers(); // Refresh daftar
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Manajemen Pengguna</h1>
        <button 
          onClick={() => openModal('create')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow transition"
        >
          + Tambah Pengguna
        </button>
      </div>

      {message.text && (
        <div className={`p-4 mb-4 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="p-4 border-b border-gray-700">Email</th>
              <th className="p-4 border-b border-gray-700">Nama</th>
              <th className="p-4 border-b border-gray-700">Role</th>
              <th className="p-4 border-b border-gray-700 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-4 text-center">Memuat data...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-4 text-center">Tidak ada data pengguna.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 border-b">
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">{user.nama || '-'}</td>
                  <td className="p-4 capitalize">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'superuser' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => openModal('edit', user)}
                      className="text-blue-600 hover:text-blue-800 font-medium mr-3"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(user.id, user.email)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">
              {modalMode === 'create' ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  disabled={modalMode === 'edit'}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {modalMode === 'create' ? 'Password / PIN' : 'Password / PIN Baru'}
                </label>
                <input
                  type={formData.role === 'kasir' || formData.role === 'admin' ? "text" : "password"}
                  required={modalMode === 'create'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={modalMode === 'edit' ? 'Kosongkan jika tidak diubah' : 'Minimal 6 digit'}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {(formData.role === 'kasir' || formData.role === 'admin') && (
                  <p className="text-xs text-orange-500 mt-1">Harus berupa angka (Minimal 6 digit)</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Hak Akses (Role)</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="kasir">Kasir</option>
                  <option value="admin">Admin</option>
                  {/* Opsi superuser dihapus */}
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}