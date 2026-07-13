import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const headers = { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { targetUserId } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Set flag is_deleted = true di tabel public.users
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ is_deleted: true })
      .eq('id', targetUserId)

    if (dbError) throw dbError

    // 2. Blokir user di level Supabase Auth agar token session langsung hangus
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      ban_duration: '876000h' // Banned 100 tahun
    })

    return new Response(JSON.stringify({ success: true }), { headers, status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers, status: 200 })
  }
})