import { supabase } from './supabase.js'

let todosLosPlatos = []

// --- Sesión activa: adapta los botones del nav ---
const { data: { session } } = await supabase.auth.getSession()
if (session) {
  document.getElementById('link-login').textContent = 'Mi panel'
  document.getElementById('link-login').href       = 'dashboard.html'
  document.getElementById('link-reservar').href    = 'nueva-reserva.html'
}

// --- Cargar platos desde Supabase ---
async function cargarPlatos() {
  const { data, error } = await supabase
    .from('platos')
    .select('*')
    .order('categoria', { ascending: true })
    .order('precio', { ascending: true })

  if (error) {
    document.getElementById('contenedor-carta').innerHTML =
      '<p class="estado-vacio">No se pudo cargar la carta. Inténtalo de nuevo más tarde.</p>'
    return
  }

  todosLosPlatos = data || []
  renderizarPlatos('todas')
}

// --- Renderizar platos agrupados por categoría ---
function renderizarPlatos(categoriaFiltro) {
  const contenedor = document.getElementById('contenedor-carta')

  const platosFiltrados = categoriaFiltro === 'todas'
    ? todosLosPlatos
    : todosLosPlatos.filter(p => p.categoria === categoriaFiltro)

  if (platosFiltrados.length === 0) {
    contenedor.innerHTML = '<p class="estado-vacio">No hay platos en esta categoría todavía</p>'
    return
  }

  // Agrupar por categoría
  const grupos = {}
  platosFiltrados.forEach(p => {
    if (!grupos[p.categoria]) grupos[p.categoria] = []
    grupos[p.categoria].push(p)
  })

  const ordenCategorias = ['entrantes', 'principales', 'postres', 'bebidas']
  let html = ''

  ordenCategorias.forEach(cat => {
    if (!grupos[cat]) return

    html += `
      <section class="categoria-seccion">
        <div class="categoria-titulo">
          <span>${cat}</span>
          <div class="linea"></div>
        </div>
        <div class="platos-grid">
          ${grupos[cat].map(plato => `
            <article class="plato-card">
              <div class="plato-imagen" style="${plato.imagen_url ? `background-image: url('${plato.imagen_url}');` : ''}">
                ${!plato.imagen_url ? '<div class="plato-sin-imagen" style="height:100%;">✦</div>' : ''}
                ${!plato.disponible ? '<div class="plato-no-disponible">No disponible</div>' : ''}
              </div>
              <div class="plato-info">
                <div class="plato-cabecera">
                  <h3 class="plato-nombre">${plato.nombre}</h3>
                  <span class="plato-precio">${Number(plato.precio).toFixed(2)} €</span>
                </div>
                ${plato.descripcion ? `<p class="plato-descripcion">${plato.descripcion}</p>` : ''}
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `
  })

  contenedor.innerHTML = html
}

// --- Filtros de categoría ---
document.querySelectorAll('.filtro-cat').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filtro-cat').forEach(b => b.classList.remove('activo'))
    btn.classList.add('activo')
    renderizarPlatos(btn.dataset.cat)
  })
})

// --- Menú hamburguesa móvil ---
const btnHamburguesa = document.getElementById('hamburguesa')
const navLinks       = document.getElementById('nav-links')

btnHamburguesa.addEventListener('click', () => {
  btnHamburguesa.classList.toggle('abierto')
  navLinks.classList.toggle('abierto')
})

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    btnHamburguesa.classList.remove('abierto')
    navLinks.classList.remove('abierto')
  })
})

// --- Cargar al inicio ---
cargarPlatos()