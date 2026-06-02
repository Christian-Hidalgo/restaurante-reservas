    import { supabase } from './supabase.js'

    const nombreInput    = document.getElementById('nombre')
    const emailInput     = document.getElementById('email')
    const passwordInput  = document.getElementById('password')
    const confirmarInput = document.getElementById('confirmar')
    const btnRegistro    = document.getElementById('btn-registro')
    const alerta         = document.getElementById('alerta')

    // --- Redirige si ya hay sesión activa ---
    const { data: { session } } = await supabase.auth.getSession()
    if (session) window.location.href = 'dashboard.html'

    // --- Mostrar / ocultar contraseña ---
    function toggleVisibilidad(inputId, btnId) {
      const input = document.getElementById(inputId)
      const btn   = document.getElementById(btnId)
      btn.addEventListener('click', () => {
        const visible = input.type === 'text'
        input.type = visible ? 'password' : 'text'
        btn.style.color = visible ? '#3a3530' : '#c9a84c'
      })
    }

    toggleVisibilidad('password', 'toggle-pass')
    toggleVisibilidad('confirmar', 'toggle-confirmar')

    // --- Indicador de fortaleza de contraseña ---
    const barras  = [document.getElementById('b1'), document.getElementById('b2'), document.getElementById('b3'), document.getElementById('b4')]
    const textoF  = document.getElementById('fortaleza-texto')
    const colores = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60']
    const textos  = ['Muy débil', 'Débil', 'Aceptable', 'Segura']

    passwordInput.addEventListener('input', () => {
      const val    = passwordInput.value
      let nivel    = 0
      if (val.length >= 6)                         nivel++
      if (val.length >= 10)                        nivel++
      if (/[A-Z]/.test(val) && /[0-9]/.test(val)) nivel++
      if (/[^A-Za-z0-9]/.test(val))               nivel++

      barras.forEach((b, i) => {
        b.style.background = i < nivel ? colores[nivel - 1] : '#2a2520'
      })
      textoF.textContent = val.length > 0 ? textos[nivel - 1] || '' : ''
    })

    // --- Validación de campos ---
    function mostrarError(id, mostrar) {
      const el    = document.getElementById('error-' + id)
      const input = document.getElementById(id)
      el.classList.toggle('visible', mostrar)
      input.classList.toggle('error', mostrar)
      return mostrar
    }

    function validar() {
      let hayError = false
      if (nombreInput.value.trim().length < 2)
        hayError = mostrarError('nombre', true)   || hayError
      else mostrarError('nombre', false)

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailInput.value.trim()))
        hayError = mostrarError('email', true)    || hayError
      else mostrarError('email', false)

      if (passwordInput.value.length < 6)
        hayError = mostrarError('password', true) || hayError
      else mostrarError('password', false)

      if (passwordInput.value !== confirmarInput.value)
        hayError = mostrarError('confirmar', true) || hayError
      else mostrarError('confirmar', false)

      return !hayError
    }

    // --- Validación en tiempo real al salir de cada campo ---
    nombreInput.addEventListener('blur',    () => mostrarError('nombre',    nombreInput.value.trim().length < 2))
    emailInput.addEventListener('blur',     () => mostrarError('email',     !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())))
    passwordInput.addEventListener('blur',  () => mostrarError('password',  passwordInput.value.length < 6))
    confirmarInput.addEventListener('blur', () => mostrarError('confirmar', passwordInput.value !== confirmarInput.value))

    // --- Registro ---
    btnRegistro.addEventListener('click', async () => {
      if (!validar()) return

      btnRegistro.disabled     = true
      btnRegistro.textContent  = 'Creando cuenta...'
      alerta.className         = 'alerta'

      const { data, error } = await supabase.auth.signUp({
        email:    emailInput.value.trim(),
        password: passwordInput.value,
        options: {
          data: {
            nombre: nombreInput.value.trim()
    }
  }
})

      if (error) {
        alerta.className   = 'alerta error'
        alerta.textContent = error.message === 'User already registered'
          ? 'Este correo ya tiene una cuenta. Inicia sesión.'
          : 'Ha ocurrido un error. Inténtalo de nuevo.'
        btnRegistro.disabled    = false
        btnRegistro.textContent = 'Crear cuenta'
        return
      }

     

      alerta.className   = 'alerta exito'
      alerta.textContent = '¡Cuenta creada! Redirigiendo...'

      setTimeout(() => {
        window.location.href = 'dashboard.html'
      }, 1500)
    })
  