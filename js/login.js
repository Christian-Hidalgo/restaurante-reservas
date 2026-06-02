import { supabase } from './supabase.js'

    // --- Redirige si ya hay sesión activa ---
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data: perfil } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', session.user.id)
        .single()
      window.location.href = perfil?.rol === 'admin' ? 'admin.html' : 'dashboard.html'
    }

    const emailInput    = document.getElementById('email')
    const passwordInput = document.getElementById('password')
    const btnLogin      = document.getElementById('btn-login')
    const alerta        = document.getElementById('alerta')

    // --- Mostrar / ocultar contraseña ---
    document.getElementById('toggle-pass').addEventListener('click', () => {
      const visible = passwordInput.type === 'text'
      passwordInput.type  = visible ? 'password' : 'text'
      document.getElementById('toggle-pass').style.color = visible ? '#3a3530' : '#c9a84c'
    })

    // --- Validación ---
    function mostrarError(id, mostrar) {
      document.getElementById('error-' + id).classList.toggle('visible', mostrar)
      document.getElementById(id).classList.toggle('error', mostrar)
      return mostrar
    }

    function validar() {
      let hayError = false
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailInput.value.trim()))
        hayError = mostrarError('email', true)    || hayError
      else mostrarError('email', false)

      if (passwordInput.value.length < 1)
        hayError = mostrarError('password', true) || hayError
      else mostrarError('password', false)

      return !hayError
    }

    emailInput.addEventListener('blur', () =>
      mostrarError('email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())))
    passwordInput.addEventListener('blur', () =>
      mostrarError('password', passwordInput.value.length < 1))

    // --- Login ---
    btnLogin.addEventListener('click', async () => {
      if (!validar()) return

      btnLogin.disabled    = true
      btnLogin.textContent = 'Entrando...'
      alerta.className     = 'alerta'

      const { data, error } = await supabase.auth.signInWithPassword({
        email:    emailInput.value.trim(),
        password: passwordInput.value,
      })

      if (error) {
        alerta.className   = 'alerta error'
        alerta.textContent = 'Correo o contraseña incorrectos.'
        btnLogin.disabled    = false
        btnLogin.textContent = 'Iniciar sesión'
        return
      }

      // Obtener el rol del usuario para redirigir al sitio correcto
      const { data: perfil } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', data.user.id)
        .single()

      alerta.className   = 'alerta exito'
      alerta.textContent = '¡Bienvenido! Redirigiendo...'

      setTimeout(() => {
        window.location.href = perfil?.rol === 'admin' ? 'admin.html' : 'dashboard.html'
      }, 1000)
    })

    // --- Login con Enter ---
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnLogin.click()
    })
  