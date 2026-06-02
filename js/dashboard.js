     import { supabase } from './supabase.js'

    // --- Proteger la página: redirige si no hay sesión ---
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) window.location.href = 'login.html'

    const userId = session.user.id
    let reservaAcancelar = null
    let todasLasReservas = []

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
        const cancelable = r.estado !== 'cancelada'
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
              </div>
            </div>
          </div>`
      }).join('')

      // Eventos de cancelar
      document.querySelectorAll('.btn-accion.cancelar').forEach(btn => {
        btn.addEventListener('click', () => {
          reservaAcancelar = btn.dataset.id
          document.getElementById('modal-cancelar').classList.add('visible')
        })
      })
    }

    // --- Cargar reservas desde Supabase ---
    async function cargarReservas(filtro = 'todas') {
      document.getElementById('lista-reservas').innerHTML = '<div class="cargando">Cargando reservas...</div>'

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

    // --- Cargar al inicio ---
    cargarReservas()
  