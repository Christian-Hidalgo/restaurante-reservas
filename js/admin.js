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

    // --- Datos ---
    let todasReservas = []
    let todosUsuarios = []

    function formatearFecha(fechaStr) {
      const f = new Date(fechaStr + 'T00:00:00')
      return f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    function formatearFechaCompleta(fechaStr) {
      const f = new Date(fechaStr)
      return f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    // --- Cargar todas las reservas con datos del cliente y mesa ---
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

      document.querySelectorAll('.btn-accion[data-estado]').forEach(btn => {
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

      // Contar reservas por usuario
      const { data: reservas } = await supabase
        .from('reservas')
        .select('user_id')

      const contador = {}
      ;(reservas || []).forEach(r => {
        contador[r.user_id] = (contador[r.user_id] || 0) + 1
      })

      todosUsuarios = (usuarios || []).map(u => ({
        ...u,
        total_reservas: contador[u.id] || 0
      }))

      filtrarUsuarios()
    }

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

    // --- Cargar todo al inicio ---
    await cargarStats()
    await cargarReservas()
    await cargarUsuarios()