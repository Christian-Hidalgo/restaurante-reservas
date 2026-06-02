    import { supabase } from './supabase.js'
    // --- Proteger página ---
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) window.location.href = 'login.html'

    const userId = session.user.id

    // --- Cargar datos del perfil ---
    const { data: perfil, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !perfil) {
      document.body.innerHTML = '<p style="padding:40px;text-align:center;color:#9a8e78;">Error al cargar el perfil</p>'
      throw error
    }

    // Si es admin redirige al panel admin
    if (perfil.rol === 'admin') window.location.href = 'admin.html'

    // --- Pintar datos en la pantalla ---
    document.getElementById('nombre-usuario').textContent = perfil.nombre.split(' ')[0]
    document.getElementById('perfil-nombre').textContent  = perfil.nombre
    document.getElementById('perfil-email').textContent   = perfil.email
    document.getElementById('perfil-rol').textContent     = perfil.rol
    document.getElementById('avatar').textContent         = perfil.nombre.charAt(0).toUpperCase()
    document.getElementById('nombre').value               = perfil.nombre
    document.getElementById('email').value                = perfil.email

    // --- Logout ---
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await supabase.auth.signOut()
      window.location.href = '../index.html'
    })

    // --- Mostrar / ocultar contraseñas ---
    function toggleVisibilidad(inputId, btnId) {
      const input = document.getElementById(inputId)
      const btn   = document.getElementById(btnId)
      btn.addEventListener('click', () => {
        const visible = input.type === 'text'
        input.type = visible ? 'password' : 'text'
        btn.style.color = visible ? '#3a3530' : '#c9a84c'
      })
    }
    toggleVisibilidad('pass-nueva', 'toggle-nueva')
    toggleVisibilidad('pass-confirmar', 'toggle-confirmar')

    // --- Helpers ---
    function mostrarError(id, mostrar) {
      document.getElementById('error-' + id).classList.toggle('visible', mostrar)
      document.getElementById(id).classList.toggle('error', mostrar)
    }

    function mostrarAlerta(alertaId, tipo, texto) {
      const a       = document.getElementById(alertaId)
      a.className   = 'alerta ' + tipo
      a.textContent = texto
      setTimeout(() => { a.className = 'alerta'; a.textContent = '' }, 5000)
    }

    // --- Guardar info personal ---
    document.getElementById('btn-guardar-info').addEventListener('click', async () => {
      const nuevoNombre = document.getElementById('nombre').value.trim()

      if (nuevoNombre.length < 2) {
        mostrarError('nombre', true)
        return
      }
      mostrarError('nombre', false)

      if (nuevoNombre === perfil.nombre) {
        mostrarAlerta('alerta-info', 'error', 'No has cambiado nada')
        return
      }

      const btn = document.getElementById('btn-guardar-info')
      btn.disabled    = true
      btn.textContent = 'Guardando...'

      const { error } = await supabase
        .from('profiles')
        .update({ nombre: nuevoNombre })
        .eq('id', userId)

      if (error) {
        mostrarAlerta('alerta-info', 'error', 'No se pudo guardar. Inténtalo de nuevo.')
      } else {
        mostrarAlerta('alerta-info', 'exito', 'Cambios guardados correctamente')
        perfil.nombre = nuevoNombre
        document.getElementById('nombre-usuario').textContent = nuevoNombre.split(' ')[0]
        document.getElementById('perfil-nombre').textContent  = nuevoNombre
        document.getElementById('avatar').textContent         = nuevoNombre.charAt(0).toUpperCase()
      }

      btn.disabled    = false
      btn.textContent = 'Guardar cambios'
    })

    // --- Cambiar contraseña ---
    document.getElementById('btn-guardar-pass').addEventListener('click', async () => {
      const nueva     = document.getElementById('pass-nueva').value
      const confirmar = document.getElementById('pass-confirmar').value

      let hayError = false
      if (nueva.length < 6)         { mostrarError('pass-nueva', true);     hayError = true } else mostrarError('pass-nueva', false)
      if (nueva !== confirmar)      { mostrarError('pass-confirmar', true); hayError = true } else mostrarError('pass-confirmar', false)
      if (hayError) return

      const btn = document.getElementById('btn-guardar-pass')
      btn.disabled    = true
      btn.textContent = 'Actualizando...'

      const { error } = await supabase.auth.updateUser({ password: nueva })

      if (error) {
        mostrarAlerta('alerta-pass', 'error', 'No se pudo actualizar la contraseña')
      } else {
        mostrarAlerta('alerta-pass', 'exito', 'Contraseña actualizada correctamente')
        document.getElementById('pass-nueva').value     = ''
        document.getElementById('pass-confirmar').value = ''
      }

      btn.disabled    = false
      btn.textContent = 'Actualizar contraseña'
    })

    // --- Cerrar todas las sesiones ---
    const modal = document.getElementById('modal-confirm')

    document.getElementById('btn-cerrar-todo').addEventListener('click', () => {
      document.getElementById('modal-titulo').textContent  = 'Cerrar todas las sesiones'
      document.getElementById('modal-mensaje').textContent = 'Se cerrará tu sesión en todos los dispositivos donde hayas iniciado sesión. Tendrás que volver a entrar.'
      modal.classList.add('visible')
    })

    document.getElementById('modal-no').addEventListener('click', () => modal.classList.remove('visible'))
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('visible') })

    document.getElementById('modal-si').addEventListener('click', async () => {
      await supabase.auth.signOut({ scope: 'global' })
      window.location.href = 'login.html'
    })
  