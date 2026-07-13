import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Header Authorization tidak ditemukan.')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error(`Auth Error: ${userError?.message || 'Token tidak valid'}`)

    const { data: userData, error: roleError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (roleError) throw new Error(`Role Error: ${roleError.message}`)
    if (userData.role !== 'superuser' && userData.role !== 'admin') {
      throw new Error('Akses ditolak: Anda bukan Superuser atau Admin.')
    }

    const { targetUserId, newPassword } = await req.json()
    if (!targetUserId || !newPassword) throw new Error('Data payload tidak lengkap.')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    )

    if (updateError) throw new Error(`Admin API Error: ${updateError.message}`)

    return new Response(JSON.stringify({ success: true, message: 'Password berhasil diperbarui' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    // KITA UBAH STATUS MENJADI 200 AGAR REACT BISA MEMBACA PESAN INI
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    })
  }
})