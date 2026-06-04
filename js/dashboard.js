import { supabase } from './supabase.js'

// --- Proteger la página: redirige si no hay sesión ---
const { data: { session } } = await supabase.auth.getSession()
if (!session) window.location.href = 'login.html'

const userId = session.user.id
let reservaAcancelar = null
let reservaAvalorar = null
let valoracionExistente = null
let puntuacionSeleccionada = 0
let todasLasReservas = []
let valoracionesUsuario = []

// --- Cargar nombre del usuario ---
const { data: perfil } = await supabase
  .from('profiles')
  .select('nombre, rol')
  .eq('id', userId)
  .single()

if (perfil) {
  document.getElementById('nombre-usuario').textContent = perfil.nombre.split(' ')[0]
  if (perfil.rol === 'admin') window.location.href = 'admin.html'
}

// --- Cerrar sesión ---
document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabase.auth.signOut()
  window.location.href = '../index.html'
})

// --- Formatear fecha ---
function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr + 'T00:00:00')
  const dia   = fecha.getDate()
  const mes   = fecha.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()
  const anio  = fecha.getFullYear()
  return { dia, mes, anio }
}

// --- Formatear hora ---
function formatearHora(horaStr) {
  return horaStr.substring(0, 5)
}

// --- Comprobar si una reserva es valorable ---
function esValorable(reserva) {
  if (reserva.estado !== 'confirmada') return false
  const fechaReserva = new Date(reserva.fecha + 'T' + reserva.hora)
  return fechaReserva < new Date()
}

// --- Comprobar si una reserva ya tiene valoración ---
function tieneValoracion(reservaId) {
  return valoracionesUsuario.some(v => v.reserva_id === reservaId)
}

// --- Renderizar reservas ---
function renderizarReservas(reservas) {
  const lista = document.getElementById('lista-reservas')

  if (reservas.length === 0) {
    lista.innerHTML = `
      <div class="estado-vacio">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f0ead6" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h3>Sin reservas</h3>
        <p>Todavía no tienes reservas con este filtro</p>
        <a href="nueva-reserva.html" class="btn-nav primario" style="display:inline-block;padding:10px 24px;">Hacer una reserva</a>
      </div>`
    return
  }

  lista.innerHTML = reservas.map(r => {
    const { dia, mes, anio } = formatearFecha(r.fecha)
    const cancelable = r.estado !== 'cancelada' && !esValorable(r)
    const valorable  = esValorable(r)
    const yaValorada = tieneValoracion(r.id)

    return `
      <div class="reserva-card">
        <div class="reserva-fecha">
          <div class="dia">${dia}</div>
          <div class="mes">${mes} ${anio}</div>
        </div>
        <div class="reserva-info">
          <h3>Mesa ${r.mesas.numero} · ${r.mesas.ubicacion}</h3>
          <div class="reserva-detalles">
            <span class="detalle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${formatearHora(r.hora)}
            </span>
            <span class="detalle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              ${r.num_comensales} ${r.num_comensales === 1 ? 'persona' : 'personas'}
            </span>
            ${r.notas ? `<span class="detalle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              ${r.notas}
            </span>` : ''}
          </div>
        </div>
        <div class="reserva-acciones">
          <span class="badge ${r.estado}">${r.estado}</span>
          <div class="acciones-botones">
            ${cancelable ? `<button class="btn-accion cancelar" data-id="${r.id}">Cancelar</button>` : ''}
            ${valorable && !yaValorada ? `<button class="btn-accion valorar" data-id="${r.id}" data-fecha="${r.fecha}">Valorar visita</button>` : ''}
            ${valorable && yaValorada  ? `<button class="btn-accion valorar" data-id="${r.id}" data-fecha="${r.fecha}" data-editar="true">Ver valoración</button>` : ''}
          </div>
        </div>
      </div>`
  }).join('')

  // --- Eventos de cancelar ---
  document.querySelectorAll('.btn-accion.cancelar').forEach(btn => {
    btn.addEventListener('click', () => {
      reservaAcancelar = btn.dataset.id
      document.getElementById('modal-cancelar').classList.add('visible')
    })
  })

  // --- Eventos de valorar ---
  document.querySelectorAll('.btn-accion.valorar').forEach(btn => {
    btn.addEventListener('click', () => {
      abrirModalValoracion(btn.dataset.id, btn.dataset.fecha, btn.dataset.editar === 'true')
    })
  })
}

// --- Cargar valoraciones del usuario ---
async function cargarValoracionesUsuario() {
  const { data, error } = await supabase
    .from('valoraciones')
    .select('*')
    .eq('user_id', userId)

  if (!error) valoracionesUsuario = data || []
}

// --- Cargar reservas desde Supabase ---
async function cargarReservas(filtro = 'todas') {
  document.getElementById('lista-reservas').innerHTML = '<div class="cargando">Cargando reservas...</div>'

  // Primero cargamos las valoraciones del usuario para saber cuáles están valoradas
  await cargarValoracionesUsuario()

  let query = supabase
    .from('reservas')
    .select('*, mesas(numero, ubicacion)')
    .eq('user_id', userId)
    .order('fecha', { ascending: true })
    .order('hora',  { ascending: true })

  if (filtro !== 'todas') query = query.eq('estado', filtro)

  const { data, error } = await query

  if (error) {
    document.getElementById('lista-reservas').innerHTML = '<div class="cargando">Error al cargar las reservas.</div>'
    return
  }

  todasLasReservas = data
  renderizarReservas(data)
}

// --- Filtros ---
document.querySelectorAll('.filtro-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('activo'))
    btn.classList.add('activo')
    cargarReservas(btn.dataset.filtro)
  })
})

// --- Modal cancelar ---
document.getElementById('modal-no').addEventListener('click', () => {
  document.getElementById('modal-cancelar').classList.remove('visible')
  reservaAcancelar = null
})

document.getElementById('modal-si').addEventListener('click', async () => {
  if (!reservaAcancelar) return

  const { error } = await supabase
    .from('reservas')
    .update({ estado: 'cancelada' })
    .eq('id', reservaAcancelar)

  document.getElementById('modal-cancelar').classList.remove('visible')
  reservaAcancelar = null

  if (!error) cargarReservas(document.querySelector('.filtro-btn.activo').dataset.filtro)
})

document.getElementById('modal-cancelar').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('modal-cancelar').classList.remove('visible')
    reservaAcancelar = null
  }
})

// --- Modal valoración: abrir ---
function abrirModalValoracion(idReserva, fechaReserva, esEditar) {
  reservaAvalorar = idReserva
  valoracionExistente = esEditar ? valoracionesUsuario.find(v => v.reserva_id === idReserva) : null
  puntuacionSeleccionada = valoracionExistente ? valoracionExistente.puntuacion : 0

  // Título e info según modo
  if (esEditar) {
    document.getElementById('modal-valorar-titulo').textContent = 'Tu valoración'
    document.getElementById('eliminar-valorar').style.display = 'inline-block'
    document.getElementById('guardar-valorar').textContent = 'Actualizar'
  } else {
    document.getElementById('modal-valorar-titulo').textContent = 'Valorar tu visita'
    document.getElementById('eliminar-valorar').style.display = 'none'
    document.getElementById('guardar-valorar').textContent = 'Guardar valoración'
  }

  // Info de la reserva
  const fecha = new Date(fechaReserva + 'T00:00:00')
  const fechaTexto = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  document.getElementById('modal-valorar-info').textContent = 'Reserva del ' + fechaTexto

  // Limpiar alertas
  document.getElementById('alerta-valoracion').className = 'alerta-valoracion'

  // Rellenar comentario si existe
  document.getElementById('comentario-valoracion').value = valoracionExistente ? (valoracionExistente.comentario || '') : ''

  // Pintar las estrellas según la puntuación actual
  pintarEstrellas(puntuacionSeleccionada)
  actualizarTextoPuntuacion(puntuacionSeleccionada)

  document.getElementById('modal-valorar').classList.add('visible')
}

// --- Pintar estrellas según puntuación ---
function pintarEstrellas(valor) {
  document.querySelectorAll('#estrellas-selector .estrella').forEach(est => {
    const v = parseInt(est.dataset.valor)
    est.classList.toggle('activa', v <= valor)
    est.classList.remove('hover')
  })
}

// --- Texto descriptivo de la puntuación ---
function actualizarTextoPuntuacion(valor) {
  const textos = {
    0: 'Selecciona una puntuación',
    1: 'Muy decepcionante',
    2: 'Esperaba más',
    3: 'Cumplió las expectativas',
    4: 'Muy buena experiencia',
    5: 'Excelente, repetiré seguro'
  }
  document.getElementById('puntuacion-texto').textContent = textos[valor] || textos[0]
}

// --- Eventos de las estrellas ---
document.querySelectorAll('#estrellas-selector .estrella').forEach(est => {
  est.addEventListener('mouseenter', () => {
    const v = parseInt(est.dataset.valor)
    document.querySelectorAll('#estrellas-selector .estrella').forEach(e => {
      const valor = parseInt(e.dataset.valor)
      e.classList.remove('activa')
      e.classList.toggle('hover', valor <= v)
    })
    actualizarTextoPuntuacion(v)
  })

  est.addEventListener('mouseleave', () => {
    document.querySelectorAll('#estrellas-selector .estrella').forEach(e => {
      e.classList.remove('hover')
      const valor = parseInt(e.dataset.valor)
      e.classList.toggle('activa', valor <= puntuacionSeleccionada)
    })
    actualizarTextoPuntuacion(puntuacionSeleccionada)
  })

  est.addEventListener('click', () => {
    puntuacionSeleccionada = parseInt(est.dataset.valor)
    pintarEstrellas(puntuacionSeleccionada)
    actualizarTextoPuntuacion(puntuacionSeleccionada)
  })
})

// --- Mostrar alerta en el modal ---
function mostrarAlertaValoracion(tipo, texto) {
  const a = document.getElementById('alerta-valoracion')
  a.className   = 'alerta-valoracion ' + tipo
  a.textContent = texto
}

// --- Cancelar modal valoración ---
document.getElementById('cancelar-valorar').addEventListener('click', () => {
  cerrarModalValoracion()
})

document.getElementById('modal-valorar').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) cerrarModalValoracion()
})

function cerrarModalValoracion() {
  document.getElementById('modal-valorar').classList.remove('visible')
  reservaAvalorar = null
  valoracionExistente = null
  puntuacionSeleccionada = 0
}

// --- Guardar valoración (insertar o actualizar) ---
document.getElementById('guardar-valorar').addEventListener('click', async () => {
  if (puntuacionSeleccionada < 1) {
    mostrarAlertaValoracion('error', 'Tienes que seleccionar una puntuación')
    return
  }

  const comentario = document.getElementById('comentario-valoracion').value.trim()
  const btn = document.getElementById('guardar-valorar')
  btn.disabled = true
  const textoOriginal = btn.textContent
  btn.textContent = 'Guardando...'

  let error
  if (valoracionExistente) {
    // Actualizar
    const res = await supabase
      .from('valoraciones')
      .update({ puntuacion: puntuacionSeleccionada, comentario: comentario || null })
      .eq('id', valoracionExistente.id)
    error = res.error
  } else {
    // Insertar
    const res = await supabase
      .from('valoraciones')
      .insert({
        user_id:    userId,
        reserva_id: reservaAvalorar,
        puntuacion: puntuacionSeleccionada,
        comentario: comentario || null
      })
    error = res.error
  }

  btn.disabled = false
  btn.textContent = textoOriginal

  if (error) {
    mostrarAlertaValoracion('error', 'No se pudo guardar la valoración. Inténtalo de nuevo.')
    return
  }

  cerrarModalValoracion()
  cargarReservas(document.querySelector('.filtro-btn.activo').dataset.filtro)
})

// --- Eliminar valoración ---
document.getElementById('eliminar-valorar').addEventListener('click', async () => {
  if (!valoracionExistente) return

  const btn = document.getElementById('eliminar-valorar')
  btn.disabled = true
  btn.textContent = 'Eliminando...'

  const { error } = await supabase
    .from('valoraciones')
    .delete()
    .eq('id', valoracionExistente.id)

  btn.disabled = false
  btn.textContent = 'Eliminar'

  if (error) {
    mostrarAlertaValoracion('error', 'No se pudo eliminar la valoración. Inténtalo de nuevo.')
    return
  }

  cerrarModalValoracion()
  cargarReservas(document.querySelector('.filtro-btn.activo').dataset.filtro)
})

// --- Cargar al inicio ---
cargarReservas()