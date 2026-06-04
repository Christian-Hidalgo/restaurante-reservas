import { supabase } from './supabase.js'

// --- Proteger página: solo admin ---
const { data: { session } } = await supabase.auth.getSession()
if (!session) window.location.href = 'login.html'

const userId = session.user.id

const { data: perfilAdmin } = await supabase
  .from('profiles').select('nombre, rol').eq('id', userId).single()

if (!perfilAdmin || perfilAdmin.rol !== 'admin') {
  window.location.href = 'dashboard.html'
}

document.getElementById('nombre-admin').textContent = perfilAdmin.nombre.split(' ')[0]

// --- Logout ---
document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabase.auth.signOut()
  window.location.href = '../index.html'
})

// --- Tabs ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('activo'))
    document.querySelectorAll('.tab-contenido').forEach(c => c.classList.remove('activo'))
    btn.classList.add('activo')
    document.getElementById('tab-' + btn.dataset.tab).classList.add('activo')
  })
})

// --- Variables de estado ---
let todasReservas      = []
let todosUsuarios      = []
let todosPlatos        = []
let todosMensajes      = []
let todasValoraciones  = []
let platoEditando      = null
let imagenArchivo      = null
let platoEliminar      = null
let mensajeAbierto     = null
let valoracionEliminar = null

// --- Diccionarios ---
const motivosTexto = {
  consulta:   'Consulta general',
  eventos:    'Eventos privados',
  sugerencia: 'Sugerencia',
  queja:      'Queja o reclamación'
}

// --- Helpers de formato de fecha ---
function formatearFecha(fechaStr) {
  const f = new Date(fechaStr + 'T00:00:00')
  return f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatearFechaCompleta(fechaStr) {
  const f = new Date(fechaStr)
  return f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatearFechaHora(fechaStr) {
  const f = new Date(fechaStr)
  return f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// --- Cargar reservas desde Supabase ---
async function cargarReservas() {
  const { data, error } = await supabase
    .from('reservas')
    .select('*, mesas(numero, ubicacion), profiles(nombre, email)')
    .order('fecha', { ascending: false })
    .order('hora',  { ascending: false })

  if (error) {
    document.getElementById('tbody-reservas').innerHTML =
      '<tr><td colspan="7" class="estado-vacio">Error al cargar las reservas</td></tr>'
    return
  }

  todasReservas = data || []
  filtrarReservas()
}

// --- Filtrar reservas según los selects ---
function filtrarReservas() {
  const texto    = document.getElementById('buscar-reserva').value.toLowerCase().trim()
  const estado   = document.getElementById('filtro-estado').value
  const fechaSel = document.getElementById('filtro-fecha').value
  const hoy      = new Date(); hoy.setHours(0,0,0,0)

  // Semana de lunes a domingo (convención española)
  const inicioSemana = new Date(hoy)
  const diaSemana = hoy.getDay()
  const diff = diaSemana === 0 ? 6 : diaSemana - 1
  inicioSemana.setDate(hoy.getDate() - diff)
  const finSemana = new Date(inicioSemana)
  finSemana.setDate(inicioSemana.getDate() + 7)

  const filtradas = todasReservas.filter(r => {
    if (estado !== 'todos' && r.estado !== estado) return false

    if (texto) {
      const nombre = (r.profiles?.nombre || '').toLowerCase()
      const email  = (r.profiles?.email  || '').toLowerCase()
      if (!nombre.includes(texto) && !email.includes(texto)) return false
    }

    if (fechaSel !== 'todas') {
      const fechaReserva = new Date(r.fecha + 'T00:00:00')
      if (fechaSel === 'hoy'     && fechaReserva.getTime() !== hoy.getTime())                 return false
      if (fechaSel === 'semana'  && (fechaReserva < inicioSemana || fechaReserva >= finSemana)) return false
      if (fechaSel === 'futuras' && fechaReserva < hoy)                                       return false
      if (fechaSel === 'pasadas' && fechaReserva >= hoy)                                      return false
    }

    return true
  })

  renderizarReservas(filtradas)
}

// --- Renderizar tabla de reservas ---
function renderizarReservas(reservas) {
  const tbody = document.getElementById('tbody-reservas')

  if (reservas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="estado-vacio">No hay reservas que coincidan con los filtros</td></tr>'
    return
  }

  tbody.innerHTML = reservas.map(r => {
    const mesa     = r.mesas ? `Mesa ${r.mesas.numero}` : '-'
    const cliente  = r.profiles?.nombre || 'Desconocido'
    const email    = r.profiles?.email  || ''
    const acciones = r.estado === 'cancelada'
      ? '<span style="color:#6b5f4a;font-size:12px;">Sin acciones</span>'
      : `
        ${r.estado === 'pendiente'  ? `<button class="btn-accion confirmar" data-id="${r.id}" data-estado="confirmada">Confirmar</button>` : ''}
        ${r.estado === 'confirmada' ? `<button class="btn-accion"           data-id="${r.id}" data-estado="pendiente">A pendiente</button>` : ''}
        <button class="btn-accion cancelar" data-id="${r.id}" data-estado="cancelada">Cancelar</button>
      `
    return `
      <tr>
        <td class="fecha-celda">${formatearFecha(r.fecha)}</td>
        <td>${r.hora.substring(0,5)}</td>
        <td>
          <div style="font-weight:500;">${cliente}</div>
          <div style="font-size:12px;color:#6b5f4a;">${email}</div>
        </td>
        <td>${mesa}</td>
        <td>${r.num_comensales}</td>
        <td><span class="badge ${r.estado}">${r.estado}</span></td>
        <td><div class="acciones-celda">${acciones}</div></td>
      </tr>`
  }).join('')

  document.querySelectorAll('#tbody-reservas .btn-accion[data-estado]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true
      const { error } = await supabase
        .from('reservas')
        .update({ estado: btn.dataset.estado })
        .eq('id', btn.dataset.id)
      if (!error) {
        await cargarReservas()
        await cargarStats()
      } else {
        btn.disabled = false
      }
    })
  })
}

// --- Cargar usuarios con número de reservas ---
async function cargarUsuarios() {
  const { data: usuarios, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    document.getElementById('tbody-usuarios').innerHTML =
      '<tr><td colspan="5" class="estado-vacio">Error al cargar los usuarios</td></tr>'
    return
  }

  const { data: reservas } = await supabase.from('reservas').select('user_id')
  const contador = {}
  ;(reservas || []).forEach(r => { contador[r.user_id] = (contador[r.user_id] || 0) + 1 })

  todosUsuarios = (usuarios || []).map(u => ({ ...u, total_reservas: contador[u.id] || 0 }))
  filtrarUsuarios()
}

// --- Filtrar usuarios ---
function filtrarUsuarios() {
  const texto = document.getElementById('buscar-usuario').value.toLowerCase().trim()
  const rol   = document.getElementById('filtro-rol').value

  const filtrados = todosUsuarios.filter(u => {
    if (rol !== 'todos' && u.rol !== rol) return false
    if (texto) {
      const nombre = (u.nombre || '').toLowerCase()
      const email  = (u.email  || '').toLowerCase()
      if (!nombre.includes(texto) && !email.includes(texto)) return false
    }
    return true
  })

  renderizarUsuarios(filtrados)
}

// --- Renderizar tabla de usuarios ---
function renderizarUsuarios(usuarios) {
  const tbody = document.getElementById('tbody-usuarios')

  if (usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="estado-vacio">No hay usuarios que coincidan con los filtros</td></tr>'
    return
  }

  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td style="font-weight:500;">${u.nombre}</td>
      <td>${u.email}</td>
      <td><span class="badge rol-${u.rol}">${u.rol}</span></td>
      <td>${u.total_reservas}</td>
      <td style="color:#9a8e78;">${formatearFechaCompleta(u.created_at)}</td>
    </tr>
  `).join('')
}

// --- Cargar platos desde Supabase ---
async function cargarPlatos() {
  const { data, error } = await supabase
    .from('platos')
    .select('*')
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) {
    document.getElementById('tbody-platos').innerHTML =
      '<tr><td colspan="6" class="estado-vacio">Error al cargar la carta</td></tr>'
    return
  }

  todosPlatos = data || []
  filtrarPlatos()
}

// --- Filtrar platos ---
function filtrarPlatos() {
  const texto    = document.getElementById('buscar-plato').value.toLowerCase().trim()
  const categoria = document.getElementById('filtro-categoria').value

  const filtrados = todosPlatos.filter(p => {
    if (categoria !== 'todas' && p.categoria !== categoria) return false
    if (texto && !p.nombre.toLowerCase().includes(texto)) return false
    return true
  })

  renderizarPlatos(filtrados)
}

// --- Renderizar tabla de platos ---
function renderizarPlatos(platos) {
  const tbody = document.getElementById('tbody-platos')

  if (platos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="estado-vacio">No hay platos que coincidan con los filtros</td></tr>'
    return
  }

  tbody.innerHTML = platos.map(p => `
    <tr>
      <td>
        <div class="plato-mini-imagen" style="${p.imagen_url ? `background-image: url('${p.imagen_url}');` : ''}">
          ${!p.imagen_url ? '✦' : ''}
        </div>
      </td>
      <td style="font-weight:500;">${p.nombre}</td>
      <td style="color:#9a8e78;text-transform:capitalize;">${p.categoria}</td>
      <td style="color:#c9a84c;font-weight:500;">${Number(p.precio).toFixed(2)} €</td>
      <td><span class="badge ${p.disponible ? 'disponible' : 'no-disponible'}">${p.disponible ? 'Disponible' : 'No disponible'}</span></td>
      <td>
        <div class="acciones-celda">
          <button class="btn-accion editar" data-id="${p.id}">Editar</button>
          <button class="btn-accion eliminar" data-id="${p.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join('')

  document.querySelectorAll('#tbody-platos .btn-accion.editar').forEach(btn => {
    btn.addEventListener('click', () => abrirModalPlato(btn.dataset.id))
  })

  document.querySelectorAll('#tbody-platos .btn-accion.eliminar').forEach(btn => {
    btn.addEventListener('click', () => {
      platoEliminar = btn.dataset.id
      document.getElementById('modal-eliminar').classList.add('visible')
    })
  })
}

// --- Abrir modal de plato en modo nuevo o editar ---
function abrirModalPlato(idPlato = null) {
  platoEditando = idPlato
  imagenArchivo = null
  document.getElementById('alerta-plato').className = 'alerta'

  if (idPlato) {
    const p = todosPlatos.find(x => x.id === idPlato)
    if (!p) return
    document.getElementById('modal-titulo-plato').textContent = 'Editar plato'
    document.getElementById('plato-nombre').value      = p.nombre
    document.getElementById('plato-descripcion').value = p.descripcion || ''
    document.getElementById('plato-precio').value      = p.precio
    document.getElementById('plato-categoria').value   = p.categoria
    document.getElementById('plato-disponible').checked = p.disponible

    const preview = document.getElementById('upload-preview')
    if (p.imagen_url) {
      preview.innerHTML = `<img class="preview-imagen" src="${p.imagen_url}" alt="Vista previa">`
      document.getElementById('upload-zona').classList.add('con-preview')
    } else {
      preview.innerHTML = `<p>Haz clic para subir una imagen</p><small>PNG, JPG o WEBP (máx. 5 MB)</small>`
      document.getElementById('upload-zona').classList.remove('con-preview')
    }
  } else {
    document.getElementById('modal-titulo-plato').textContent = 'Nuevo plato'
    document.getElementById('plato-nombre').value      = ''
    document.getElementById('plato-descripcion').value = ''
    document.getElementById('plato-precio').value      = ''
    document.getElementById('plato-categoria').value   = 'entrantes'
    document.getElementById('plato-disponible').checked = true
    document.getElementById('upload-preview').innerHTML =
      `<p>Haz clic para subir una imagen</p><small>PNG, JPG o WEBP (máx. 5 MB)</small>`
    document.getElementById('upload-zona').classList.remove('con-preview')
  }

  document.getElementById('plato-imagen-input').value = ''
  document.getElementById('modal-plato').classList.add('visible')
}

document.getElementById('btn-nuevo-plato').addEventListener('click', () => abrirModalPlato())

document.getElementById('cancelar-plato').addEventListener('click', () => {
  document.getElementById('modal-plato').classList.remove('visible')
})

document.getElementById('modal-plato').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-plato')) {
    document.getElementById('modal-plato').classList.remove('visible')
  }
})

// --- Subida de imagen ---
document.getElementById('upload-zona').addEventListener('click', () => {
  document.getElementById('plato-imagen-input').click()
})

document.getElementById('plato-imagen-input').addEventListener('change', (e) => {
  const file = e.target.files[0]
  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    mostrarAlertaModal('error', 'La imagen es demasiado grande. Máximo 5 MB.')
    return
  }

  imagenArchivo = file
  const reader = new FileReader()
  reader.onload = (ev) => {
    document.getElementById('upload-preview').innerHTML =
      `<img class="preview-imagen" src="${ev.target.result}" alt="Vista previa">`
    document.getElementById('upload-zona').classList.add('con-preview')
  }
  reader.readAsDataURL(file)
})

function mostrarAlertaModal(tipo, texto) {
  const a = document.getElementById('alerta-plato')
  a.className   = 'alerta ' + tipo
  a.textContent = texto
}

// --- Guardar plato (insertar o editar) ---
document.getElementById('guardar-plato').addEventListener('click', async () => {
  const nombre      = document.getElementById('plato-nombre').value.trim()
  const descripcion = document.getElementById('plato-descripcion').value.trim()
  const precio      = parseFloat(document.getElementById('plato-precio').value)
  const categoria   = document.getElementById('plato-categoria').value
  const disponible  = document.getElementById('plato-disponible').checked

  if (!nombre || nombre.length < 2) {
    mostrarAlertaModal('error', 'Introduce un nombre válido para el plato')
    return
  }
  if (isNaN(precio) || precio <= 0) {
    mostrarAlertaModal('error', 'Introduce un precio válido')
    return
  }

  const btn = document.getElementById('guardar-plato')
  btn.disabled = true
  btn.textContent = 'Guardando...'

  let imagen_url = null
  const platoActual = platoEditando ? todosPlatos.find(p => p.id === platoEditando) : null

  if (imagenArchivo) {
    const ext = imagenArchivo.name.split('.').pop()
    const nombreFichero = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

    const { error: errUpload } = await supabase.storage
      .from('platos')
      .upload(nombreFichero, imagenArchivo, { cacheControl: '3600', upsert: false })

    if (errUpload) {
      mostrarAlertaModal('error', 'No se pudo subir la imagen. Inténtalo de nuevo.')
      btn.disabled = false
      btn.textContent = 'Guardar'
      return
    }

    const { data: urlData } = supabase.storage.from('platos').getPublicUrl(nombreFichero)
    imagen_url = urlData.publicUrl
  } else if (platoActual) {
    imagen_url = platoActual.imagen_url
  }

  const datosPlato = { nombre, descripcion: descripcion || null, precio, categoria, imagen_url, disponible }

  let error
  if (platoEditando) {
    const res = await supabase.from('platos').update(datosPlato).eq('id', platoEditando)
    error = res.error
  } else {
    const res = await supabase.from('platos').insert(datosPlato)
    error = res.error
  }

  if (error) {
    mostrarAlertaModal('error', 'No se pudo guardar el plato. Inténtalo de nuevo.')
    btn.disabled = false
    btn.textContent = 'Guardar'
    return
  }

  document.getElementById('modal-plato').classList.remove('visible')
  btn.disabled = false
  btn.textContent = 'Guardar'
  await cargarPlatos()
})

// --- Eliminar plato ---
document.getElementById('cancelar-eliminar').addEventListener('click', () => {
  document.getElementById('modal-eliminar').classList.remove('visible')
  platoEliminar = null
})

document.getElementById('modal-eliminar').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-eliminar')) {
    document.getElementById('modal-eliminar').classList.remove('visible')
    platoEliminar = null
  }
})

document.getElementById('confirmar-eliminar').addEventListener('click', async () => {
  if (!platoEliminar) return
  const btn = document.getElementById('confirmar-eliminar')
  btn.disabled = true

  const { error } = await supabase.from('platos').delete().eq('id', platoEliminar)

  document.getElementById('modal-eliminar').classList.remove('visible')
  platoEliminar = null
  btn.disabled = false

  if (!error) await cargarPlatos()
})

// --- Cargar mensajes desde Supabase ---
async function cargarMensajes() {
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    document.getElementById('tbody-mensajes').innerHTML =
      '<tr><td colspan="6" class="estado-vacio">Error al cargar los mensajes</td></tr>'
    return
  }

  todosMensajes = data || []
  actualizarBadgeMensajes()
  filtrarMensajes()
}

// --- Actualizar badge de mensajes sin leer ---
function actualizarBadgeMensajes() {
  const sinLeer = todosMensajes.filter(m => !m.leido).length
  const badge = document.getElementById('badge-mensajes-sin-leer')
  if (sinLeer > 0) {
    badge.textContent = sinLeer
    badge.classList.add('visible')
  } else {
    badge.classList.remove('visible')
  }
}

// --- Filtrar mensajes ---
function filtrarMensajes() {
  const texto  = document.getElementById('buscar-mensaje').value.toLowerCase().trim()
  const motivo = document.getElementById('filtro-motivo').value
  const leido  = document.getElementById('filtro-leido').value

  const filtrados = todosMensajes.filter(m => {
    if (motivo !== 'todos' && m.motivo !== motivo) return false
    if (leido === 'leidos' && !m.leido)            return false
    if (leido === 'no-leidos' && m.leido)          return false
    if (texto) {
      const nombre  = (m.nombre  || '').toLowerCase()
      const email   = (m.email   || '').toLowerCase()
      const mensaje = (m.mensaje || '').toLowerCase()
      if (!nombre.includes(texto) && !email.includes(texto) && !mensaje.includes(texto)) return false
    }
    return true
  })

  renderizarMensajes(filtrados)
}

// --- Renderizar tabla de mensajes ---
function renderizarMensajes(mensajes) {
  const tbody = document.getElementById('tbody-mensajes')

  if (mensajes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="estado-vacio">No hay mensajes que coincidan con los filtros</td></tr>'
    return
  }

  tbody.innerHTML = mensajes.map(m => `
    <tr class="${!m.leido ? 'fila-no-leido' : ''}">
      <td class="fecha-celda">${formatearFechaCompleta(m.created_at)}</td>
      <td>
        <div style="font-weight:500;">${m.nombre}</div>
        <div style="font-size:12px;color:#6b5f4a;">${m.email}</div>
      </td>
      <td style="color:#9a8e78;">${motivosTexto[m.motivo] || m.motivo}</td>
      <td><div class="mensaje-resumen">${m.mensaje}</div></td>
      <td><span class="badge ${m.leido ? 'leido' : 'no-leido'}">${m.leido ? 'Leído' : 'Sin leer'}</span></td>
      <td>
        <div class="acciones-celda">
          <button class="btn-accion ver-mensaje" data-id="${m.id}">Ver</button>
        </div>
      </td>
    </tr>
  `).join('')

  document.querySelectorAll('#tbody-mensajes .btn-accion.ver-mensaje').forEach(btn => {
    btn.addEventListener('click', () => abrirMensaje(btn.dataset.id))
  })
}

// --- Abrir modal con mensaje completo ---
async function abrirMensaje(idMensaje) {
  const m = todosMensajes.find(x => x.id === idMensaje)
  if (!m) return

  mensajeAbierto = idMensaje

  document.getElementById('ver-mensaje-de').textContent     = m.nombre
  document.getElementById('ver-mensaje-email').textContent  = m.email
  document.getElementById('ver-mensaje-motivo').textContent = motivosTexto[m.motivo] || m.motivo
  document.getElementById('ver-mensaje-fecha').textContent  = formatearFechaHora(m.created_at)
  document.getElementById('ver-mensaje-texto').textContent  = m.mensaje

  const filaTelefono = document.getElementById('fila-telefono')
  if (m.telefono) {
    document.getElementById('ver-mensaje-telefono').textContent = m.telefono
    filaTelefono.style.display = 'grid'
  } else {
    filaTelefono.style.display = 'none'
  }

  document.getElementById('modal-mensaje').classList.add('visible')

  // Marcar como leído si no lo estaba
  if (!m.leido) {
    await supabase.from('mensajes').update({ leido: true }).eq('id', idMensaje)
    m.leido = true
    actualizarBadgeMensajes()
    filtrarMensajes()
  }
}

document.getElementById('cerrar-mensaje').addEventListener('click', () => {
  document.getElementById('modal-mensaje').classList.remove('visible')
  mensajeAbierto = null
})

document.getElementById('modal-mensaje').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-mensaje')) {
    document.getElementById('modal-mensaje').classList.remove('visible')
    mensajeAbierto = null
  }
})

document.getElementById('eliminar-mensaje').addEventListener('click', async () => {
  if (!mensajeAbierto) return
  const btn = document.getElementById('eliminar-mensaje')
  btn.disabled = true

  const { error } = await supabase.from('mensajes').delete().eq('id', mensajeAbierto)

  document.getElementById('modal-mensaje').classList.remove('visible')
  mensajeAbierto = null
  btn.disabled = false

  if (!error) await cargarMensajes()
})

// --- Cargar valoraciones desde Supabase ---
async function cargarValoraciones() {
  const { data, error } = await supabase
    .from('valoraciones')
    .select('*, profiles!valoraciones_user_id_profiles_fkey(nombre, email), reservas(fecha)')
    .order('created_at', { ascending: false })

  if (error) {
    document.getElementById('tbody-valoraciones').innerHTML =
      '<tr><td colspan="5" class="estado-vacio">Error al cargar las valoraciones</td></tr>'
    return
  }

  todasValoraciones = data || []
  filtrarValoraciones()
}

// --- Filtrar valoraciones ---
function filtrarValoraciones() {
  const texto      = document.getElementById('buscar-valoracion').value.toLowerCase().trim()
  const puntuacion = document.getElementById('filtro-puntuacion').value

  const filtradas = todasValoraciones.filter(v => {
    if (puntuacion !== 'todas' && v.puntuacion !== parseInt(puntuacion)) return false
    if (texto) {
      const nombre     = (v.profiles?.nombre || '').toLowerCase()
      const email      = (v.profiles?.email  || '').toLowerCase()
      const comentario = (v.comentario       || '').toLowerCase()
      if (!nombre.includes(texto) && !email.includes(texto) && !comentario.includes(texto)) return false
    }
    return true
  })

  renderizarValoraciones(filtradas)
}

// --- Generar HTML de estrellas ---
function estrellasHTML(puntuacion) {
  let html = ''
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= puntuacion ? '' : 'vacia'}">★</span>`
  }
  return html
}

// --- Renderizar tabla de valoraciones ---
function renderizarValoraciones(valoraciones) {
  const tbody = document.getElementById('tbody-valoraciones')

  if (valoraciones.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="estado-vacio">No hay valoraciones que coincidan con los filtros</td></tr>'
    return
  }

  tbody.innerHTML = valoraciones.map(v => {
    const cliente = v.profiles?.nombre || 'Desconocido'
    const email   = v.profiles?.email  || ''
    return `
      <tr>
        <td class="fecha-celda">${formatearFechaCompleta(v.created_at)}</td>
        <td>
          <div style="font-weight:500;">${cliente}</div>
          <div style="font-size:12px;color:#6b5f4a;">${email}</div>
        </td>
        <td><div class="estrellas-tabla">${estrellasHTML(v.puntuacion)}</div></td>
        <td>
          ${v.comentario
            ? `<div class="comentario-resumen">${v.comentario}</div>`
            : `<span class="sin-comentario">Sin comentario</span>`}
        </td>
        <td>
          <div class="acciones-celda">
            <button class="btn-accion eliminar" data-id="${v.id}">Eliminar</button>
          </div>
        </td>
      </tr>`
  }).join('')

  document.querySelectorAll('#tbody-valoraciones .btn-accion.eliminar').forEach(btn => {
    btn.addEventListener('click', () => {
      valoracionEliminar = btn.dataset.id
      document.getElementById('modal-eliminar-valoracion').classList.add('visible')
    })
  })
}

// --- Modal eliminar valoración ---
document.getElementById('cancelar-eliminar-valoracion').addEventListener('click', () => {
  document.getElementById('modal-eliminar-valoracion').classList.remove('visible')
  valoracionEliminar = null
})

document.getElementById('modal-eliminar-valoracion').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-eliminar-valoracion')) {
    document.getElementById('modal-eliminar-valoracion').classList.remove('visible')
    valoracionEliminar = null
  }
})

document.getElementById('confirmar-eliminar-valoracion').addEventListener('click', async () => {
  if (!valoracionEliminar) return
  const btn = document.getElementById('confirmar-eliminar-valoracion')
  btn.disabled = true

  const { error } = await supabase.from('valoraciones').delete().eq('id', valoracionEliminar)

  document.getElementById('modal-eliminar-valoracion').classList.remove('visible')
  valoracionEliminar = null
  btn.disabled = false

  if (!error) await cargarValoraciones()
})

// --- Cargar estadísticas ---
async function cargarStats() {
  const hoy = new Date().toISOString().split('T')[0]

  const { count: hoyCount }    = await supabase.from('reservas').select('*', { count: 'exact', head: true }).eq('fecha', hoy).neq('estado', 'cancelada')
  const { count: pendCount }   = await supabase.from('reservas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente')
  const { count: confCount }   = await supabase.from('reservas').select('*', { count: 'exact', head: true }).eq('estado', 'confirmada')
  const { count: totalCount }  = await supabase.from('reservas').select('*', { count: 'exact', head: true })
  const { count: usersCount }  = await supabase.from('profiles').select('*', { count: 'exact', head: true })

  document.getElementById('stat-hoy').textContent         = hoyCount   || 0
  document.getElementById('stat-pendientes').textContent  = pendCount  || 0
  document.getElementById('stat-confirmadas').textContent = confCount  || 0
  document.getElementById('stat-total').textContent       = totalCount || 0
  document.getElementById('stat-usuarios').textContent    = usersCount || 0
}

// --- Listeners de filtros ---
document.getElementById('buscar-reserva').addEventListener('input', filtrarReservas)
document.getElementById('filtro-estado').addEventListener('change', filtrarReservas)
document.getElementById('filtro-fecha').addEventListener('change',  filtrarReservas)
document.getElementById('buscar-usuario').addEventListener('input', filtrarUsuarios)
document.getElementById('filtro-rol').addEventListener('change',    filtrarUsuarios)
document.getElementById('buscar-plato').addEventListener('input',   filtrarPlatos)
document.getElementById('filtro-categoria').addEventListener('change', filtrarPlatos)
document.getElementById('buscar-mensaje').addEventListener('input', filtrarMensajes)
document.getElementById('filtro-motivo').addEventListener('change', filtrarMensajes)
document.getElementById('filtro-leido').addEventListener('change',  filtrarMensajes)
document.getElementById('buscar-valoracion').addEventListener('input',   filtrarValoraciones)
document.getElementById('filtro-puntuacion').addEventListener('change',  filtrarValoraciones)

// --- Cargar todo al inicio ---
await cargarStats()
await cargarReservas()
await cargarUsuarios()
await cargarPlatos()
await cargarMensajes()
await cargarValoraciones()