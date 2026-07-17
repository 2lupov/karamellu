import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!botToken) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { code } = await req.json()

    if (!code || code.length !== 6) {
      return new Response(
        JSON.stringify({ error: 'Невірний формат коду' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the code
    const { data: authCode, error: codeError } = await supabase
      .from('telegram_auth_codes')
      .select('*')
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (codeError || !authCode) {
      return new Response(
        JSON.stringify({ error: 'Невірний або прострочений код' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark code as used
    await supabase
      .from('telegram_auth_codes')
      .update({ used: true })
      .eq('id', authCode.id)

    const telegramUserId = authCode.telegram_user_id
    const telegramUsername = authCode.telegram_username || ''
    const telegramFirstName = authCode.telegram_first_name || ''
    const email = `tg_${telegramUserId}@telegram.karamellu.local`

    // Check if telegram user already linked
    const { data: existingLink } = await supabase
      .from('telegram_users')
      .select('user_id')
      .eq('telegram_user_id', telegramUserId)
      .single()

    let userId: string

    if (existingLink) {
      userId = existingLink.user_id
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: telegramFirstName,
          telegram_username: telegramUsername,
          telegram_user_id: telegramUserId,
          auth_provider: 'telegram',
        },
      })

      if (createError || !newUser.user) {
        console.error('Failed to create user:', createError)
        return new Response(
          JSON.stringify({ error: 'Не вдалося створити акаунт' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      userId = newUser.user.id

      // Link telegram user
      await supabase.from('telegram_users').insert({
        user_id: userId,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername,
        telegram_first_name: telegramFirstName,
      })
    }

    // Generate a magic link and extract the session token
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError || !linkData) {
      console.error('Failed to generate link:', linkError)
      return new Response(
        JSON.stringify({ error: 'Помилка створення сесії' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract hashed_token from the generated link properties
    const hashedToken = linkData.properties?.hashed_token
    if (!hashedToken) {
      console.error('No hashed_token in link data')
      return new Response(
        JSON.stringify({ error: 'Помилка створення сесії' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the OTP to get a real session
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const { data: verifyData, error: verifyError } = await anonClient.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    })

    if (verifyError || !verifyData.session) {
      console.error('Failed to verify OTP:', verifyError)
      return new Response(
        JSON.stringify({ error: 'Помилка авторизації' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        session: verifyData.session,
        user: verifyData.user,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Verify error:', error)
    return new Response(
      JSON.stringify({ error: 'Внутрішня помилка сервера' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
