import { supabase } from './supabase.js'

// --- Adaptar el nav si hay sesión activa ---
const { data: { session } } = await supabase.auth.getSession()
if (session) {
  document.getElementById('link-login').textContent = 'Mi panel'
  document.getElementById('link-login').href       = 'dashboard.html'
  document.getElementById('link-reservar').href    = 'nueva-reserva.html'
}

// --- Formatear fecha en formato natural ---
function formatearFecha(fechaStr) {
  const f = new Date(fechaStr)
  return f.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

// --- Generar HTML de estrellas (rellenas y vacías) ---
function estrellasHTML(puntuacion, total = 5) {
  let html = ''
  for (let i = 1; i <= total; i++) {
    html += `<span class="${i <= puntuacion ? '' : 'vacia'}">★</span>`
  }
  return html
}

// --- Cargar las valoraciones desde Supabase ---
async function cargarValoraciones() {
  // Traemos las valoraciones con el nombre del autor y la fecha de la reserva
  const { data, error } = await supabase
    .from('valoraciones')
    .select('*, profiles!valoraciones_user_id_profiles_fkey(nombre), reservas(fecha)')
    .order('created_at', { ascending: false })

  if (error) {
    document.getElementById('resumen-global').innerHTML =
      '<div class="cargando">No se pudieron cargar las valoraciones</div>'
    return
  }

  const valoraciones = data || []
  renderizarResumen(valoraciones)
  renderizarLista(valoraciones)
}

// --- Renderizar el resumen global con media y distribución ---
function renderizarResumen(valoraciones) {
  const contenedor = document.getElementById('resumen-global')
  const total      = valoraciones.length

  if (total === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio" style="grid-column:1/-1;">
        <h3>Aún no hay valoraciones</h3>
        <p>Sé el primero en compartir tu experiencia en Casa Hidalgo</p>
      </div>`
    return
  }

  const suma  = valoraciones.reduce((acc, v) => acc + v.puntuacion, 0)
  const media = (suma / total).toFixed(1)
  const mediaRedondeada = Math.round(suma / total)

  // Contar cuántas valoraciones hay de cada puntuación (5, 4, 3, 2, 1)
  const conteo = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  valoraciones.forEach(v => { conteo[v.puntuacion]++ })

  contenedor.innerHTML = `
    <div class="resumen-media">
      <div class="nota">${media}</div>
      <div class="nota-estrellas">${estrellasHTML(mediaRedondeada)}</div>
      <div class="nota-total">${total} ${total === 1 ? 'valoración' : 'valoraciones'}</div>
    </div>

    <div class="resumen-distribucion">
      ${[5, 4, 3, 2, 1].map(n => {
        const cantidad = conteo[n]
        const porcentaje = total > 0 ? (cantidad / total) * 100 : 0
        return `
          <div class="fila-distribucion">
            <span class="num-estrellas">${n} <span style="font-size:11px;">★</span></span>
            <div class="barra-fondo">
              <div class="barra-relleno" style="width:${porcentaje}%;"></div>
            </div>
            <span class="num-total">${cantidad}</span>
          </div>`
      }).join('')}
    </div>
  `
}

// --- Renderizar el listado completo de valoraciones ---
function renderizarLista(valoraciones) {
  const contenedor = document.getElementById('lista-valoraciones')

  if (valoraciones.length === 0) {
    contenedor.innerHTML = ''
    return
  }

  contenedor.innerHTML = valoraciones.map(v => {
    const nombre  = v.profiles?.nombre || 'Cliente'
    const inicial = nombre.charAt(0).toUpperCase()
    const fechaVisita = v.reservas?.fecha ? formatearFecha(v.reservas.fecha) : formatearFecha(v.created_at)

    return `
      <article class="valoracion-card">
        <div class="avatar">${inicial}</div>
        <div class="valoracion-contenido">
          <div class="valoracion-cabecera">
            <span class="valoracion-nombre">${nombre}</span>
            <span class="valoracion-fecha">Visita del ${fechaVisita}</span>
          </div>
          <div class="valoracion-estrellas">${estrellasHTML(v.puntuacion)}</div>
          ${v.comentario ? `<p class="valoracion-comentario">${v.comentario}</p>` : ''}
        </div>
      </article>`
  }).join('')
}

// --- Cargar al inicio ---
cargarValoraciones()