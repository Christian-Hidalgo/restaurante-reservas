    import { supabase } from './supabase.js'

    // --- Proteger página ---
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) window.location.href = 'login.html'

    const userId = session.user.id

    // --- Cargar nombre ---
    const { data: perfil } = await supabase
      .from('profiles')
      .select('nombre, rol')
      .eq('id', userId)
      .single()

    if (perfil) {
      document.getElementById('nombre-usuario').textContent = perfil.nombre.split(' ')[0]
      if (perfil.rol === 'admin') window.location.href = 'admin.html'
    }

    // --- Logout ---
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await supabase.auth.signOut()
      window.location.href = '../index.html'
    })

    // --- Configurar fecha mínima (hoy) y máxima (3 meses) ---
    const inputFecha = document.getElementById('fecha')
    const hoy        = new Date()
    const max        = new Date()
    max.setMonth(max.getMonth() + 3)
    inputFecha.min   = hoy.toISOString().split('T')[0]
    inputFecha.max   = max.toISOString().split('T')[0]

    // --- Variables de estado ---
    let mesasDisponibles = []
    let mesaSeleccionada = null

    const selHora       = document.getElementById('hora')
    const selComensales = document.getElementById('comensales')
    const alerta        = document.getElementById('alerta')
    const btnReservar   = document.getElementById('btn-reservar')

    // --- Validaciones ---
    function mostrarError(id, mostrar) {
      document.getElementById('error-' + id).classList.toggle('visible', mostrar)
      document.getElementById(id).classList.toggle('error', mostrar)
    }

    // --- Cargar mesas disponibles ---
    async function buscarMesasDisponibles() {
      const fecha      = inputFecha.value
      const hora       = selHora.value
      const comensales = parseInt(selComensales.value)

      if (!fecha || !hora || !comensales) {
        document.getElementById('mesas-grid').innerHTML =
          '<div class="cargando-mesas">Selecciona fecha, hora y comensales para ver las mesas disponibles</div>'
        actualizarStepper(1)
        return
      }

      document.getElementById('mesas-grid').innerHTML =
        '<div class="cargando-mesas">Buscando mesas disponibles...</div>'

      // 1. Calcular rango de capacidad permitido
      //    Mínimo: 2 si va 1 persona, si no, el número de comensales
      //    Máximo: 2 plazas extra sobre el número de comensales
      const capacidadMin = comensales === 1 ? 2 : comensales
      const capacidadMax = comensales + 2

// 2. Obtener todas las mesas dentro del rango permitido
const { data: mesas, error: errMesas } = await supabase
  .from('mesas')
  .select('*')
  .gte('capacidad', capacidadMin)
  .lte('capacidad', capacidadMax)
  .order('numero', { ascending: true })

      if (errMesas) {
        document.getElementById('mesas-grid').innerHTML =
          '<div class="cargando-mesas">Error al cargar las mesas</div>'
        return
      }

      // 2. Obtener reservas existentes para esa fecha y hora
      const { data: reservas } = await supabase
        .from('reservas')
        .select('mesa_id')
        .eq('fecha', fecha)
        .eq('hora', hora + ':00')
        .neq('estado', 'cancelada')

      const mesasOcupadas = new Set((reservas || []).map(r => r.mesa_id))
      mesasDisponibles    = mesas.filter(m => !mesasOcupadas.has(m.id))

      renderizarMesas(mesas, mesasOcupadas)
      actualizarStepper(2)
    }

    function renderizarMesas(mesas, ocupadas) {
      const grid = document.getElementById('mesas-grid')

      if (mesas.length === 0) {
        grid.innerHTML = '<div class="cargando-mesas">No hay mesas con esa capacidad</div>'
        return
      }

      grid.innerHTML = mesas.map(m => {
        const noDisp = ocupadas.has(m.id)
        return `
          <div class="mesa-opcion ${noDisp ? 'no-disponible' : ''}" data-id="${m.id}" data-numero="${m.numero}" data-ubicacion="${m.ubicacion}">
            <div class="mesa-numero">${m.numero}</div>
            <div class="mesa-info">${m.capacidad} ${m.capacidad === 1 ? 'persona' : 'personas'}</div>
            <div class="mesa-ubicacion">${m.ubicacion}</div>
          </div>`
      }).join('')

      // Evento de selección
      document.querySelectorAll('.mesa-opcion:not(.no-disponible)').forEach(opt => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.mesa-opcion').forEach(o => o.classList.remove('seleccionada'))
          opt.classList.add('seleccionada')
          mesaSeleccionada = {
            id:        opt.dataset.id,
            numero:    opt.dataset.numero,
            ubicacion: opt.dataset.ubicacion
          }
          actualizarResumen()
          actualizarStepper(3)
        })
      })
    }

    // --- Actualizar el stepper visual ---
    function actualizarStepper(paso) {
      const s1 = document.getElementById('step-1')
      const s2 = document.getElementById('step-2')
      const s3 = document.getElementById('step-3')
      s1.className = 'step'
      s2.className = 'step'
      s3.className = 'step'

      if (paso >= 1) s1.classList.add('completado')
      if (paso >= 2) s2.classList.add('completado')
      if (paso === 1) s1.classList.add('activo')
      if (paso === 2) s2.classList.add('activo')
      if (paso === 3) {
        s1.classList.add('completado')
        s2.classList.add('completado')
        s3.classList.add('activo')
      }
    }

    // --- Actualizar el resumen ---
    function actualizarResumen() {
      if (!mesaSeleccionada) {
        document.getElementById('resumen').style.display = 'none'
        btnReservar.disabled = true
        return
      }

      const fecha = new Date(inputFecha.value + 'T00:00:00')
      const fechaTexto = fecha.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      })

      document.getElementById('r-fecha').textContent      = fechaTexto
      document.getElementById('r-hora').textContent       = selHora.value
      document.getElementById('r-comensales').textContent = selComensales.value + (selComensales.value === '1' ? ' persona' : ' personas')
      document.getElementById('r-mesa').textContent       = `Mesa ${mesaSeleccionada.numero} (${mesaSeleccionada.ubicacion})`
      document.getElementById('resumen').style.display    = 'block'
      btnReservar.disabled = false
    }

    // --- Listeners ---
    inputFecha.addEventListener('change',  () => { mesaSeleccionada = null; buscarMesasDisponibles() })
    selHora.addEventListener('change',     () => { mesaSeleccionada = null; buscarMesasDisponibles() })
    selComensales.addEventListener('change', () => { mesaSeleccionada = null; buscarMesasDisponibles() })

    // --- Confirmar reserva ---
    btnReservar.addEventListener('click', async () => {
      let hayError = false

// Validar fecha: debe estar entre hoy y 3 meses como máximo
const hoyDate    = new Date(); hoyDate.setHours(0, 0, 0, 0)
const limiteDate = new Date(); limiteDate.setMonth(limiteDate.getMonth() + 3)
const fechaReserva = new Date(inputFecha.value + 'T00:00:00')

if (!inputFecha.value) {
  mostrarError('fecha', true); hayError = true
} else if (fechaReserva < hoyDate) {
  mostrarError('fecha', true)
  mostrarMensaje('error', 'No puedes reservar en una fecha pasada')
  hayError = true
} else if (fechaReserva > limiteDate) {
  mostrarError('fecha', true)
  mostrarMensaje('error', 'Solo puedes reservar con un máximo de 3 meses de antelación')
  hayError = true
} else {
  mostrarError('fecha', false)
}

if (!selHora.value)       { mostrarError('hora', true);       hayError = true } else mostrarError('hora', false)
if (!selComensales.value) { mostrarError('comensales', true); hayError = true } else mostrarError('comensales', false)
if (!mesaSeleccionada)    { mostrarMensaje('error', 'Selecciona una mesa para continuar'); hayError = true }
if (hayError) return

      btnReservar.disabled    = true
      btnReservar.textContent = 'Procesando...'

      const { error } = await supabase
        .from('reservas')
        .insert({
          user_id:        userId,
          mesa_id:        mesaSeleccionada.id,
          fecha:          inputFecha.value,
          hora:           selHora.value + ':00',
          num_comensales: parseInt(selComensales.value),
          estado:         'pendiente',
          notas:          document.getElementById('notas').value.trim() || null
        })

      if (error) {
        mostrarMensaje('error', 'No se pudo crear la reserva. Inténtalo de nuevo.')
        btnReservar.disabled    = false
        btnReservar.textContent = 'Confirmar reserva'
        return
      }

      mostrarMensaje('exito', '¡Reserva creada con éxito! Redirigiendo a tus reservas...')

      setTimeout(() => {
        window.location.href = 'dashboard.html'
      }, 1800)
    })

    function mostrarMensaje(tipo, texto) {
      alerta.className   = 'alerta ' + tipo
      alerta.textContent = texto
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  