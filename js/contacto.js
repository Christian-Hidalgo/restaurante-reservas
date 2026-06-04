import { supabase } from './supabase.js'

const form          = document.getElementById('form-contacto')
const nombreInput   = document.getElementById('nombre')
const emailInput    = document.getElementById('email')
const telefonoInput = document.getElementById('telefono')
const motivoInput   = document.getElementById('motivo')
const mensajeInput  = document.getElementById('mensaje')
const btnEnviar     = document.getElementById('btn-enviar')
const alerta        = document.getElementById('alerta')

// --- Patrones de validación ---
const nombreRegex   = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/
const emailRegex    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const telefonoRegex = /^[+\d\s()-]{9,20}$/

// --- Adaptar el nav si hay sesión activa ---
const { data: { session } } = await supabase.auth.getSession()
if (session) {
  document.getElementById('link-login').textContent = 'Mi panel'
  document.getElementById('link-login').href       = 'dashboard.html'
  document.getElementById('link-reservar').href    = 'nueva-reserva.html'

  // Prerellenar nombre y email del usuario logueado
  const { data: perfil } = await supabase
    .from('profiles')
    .select('nombre, email')
    .eq('id', session.user.id)
    .single()

  if (perfil) {
    nombreInput.value = perfil.nombre
    emailInput.value  = perfil.email
  }
}

// --- Helpers ---
function mostrarError(id, mostrar) {
  document.getElementById('error-' + id).classList.toggle('visible', mostrar)
  document.getElementById(id).classList.toggle('error', mostrar)
}

function mostrarAlerta(tipo, texto) {
  alerta.className   = 'alerta ' + tipo
  alerta.textContent = texto
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// --- Validación completa ---
function validar() {
  let hayError = false

  // Nombre: mínimo 2 caracteres, solo letras y espacios
  const nombre = nombreInput.value.trim()
  if (nombre.length < 2 || !nombreRegex.test(nombre)) {
    mostrarError('nombre', true); hayError = true
  } else {
    mostrarError('nombre', false)
  }

  // Email: formato válido
  if (!emailRegex.test(emailInput.value.trim())) {
    mostrarError('email', true); hayError = true
  } else {
    mostrarError('email', false)
  }

  // Teléfono: solo si tiene algo introducido, validar formato
  const telefono = telefonoInput.value.trim()
  if (telefono && !telefonoRegex.test(telefono)) {
    mostrarError('telefono', true); hayError = true
  } else {
    mostrarError('telefono', false)
  }

  // Motivo: debe estar seleccionado
  if (!motivoInput.value) {
    mostrarError('motivo', true); hayError = true
  } else {
    mostrarError('motivo', false)
  }

  // Mensaje: mínimo 10 caracteres
  if (mensajeInput.value.trim().length < 10) {
    mostrarError('mensaje', true); hayError = true
  } else {
    mostrarError('mensaje', false)
  }

  return !hayError
}

// --- Validación en tiempo real al salir de cada campo ---
nombreInput.addEventListener('blur', () => {
  const v = nombreInput.value.trim()
  mostrarError('nombre', v.length < 2 || !nombreRegex.test(v))
})

emailInput.addEventListener('blur',  () => mostrarError('email',  !emailRegex.test(emailInput.value.trim())))

telefonoInput.addEventListener('blur', () => {
  const v = telefonoInput.value.trim()
  mostrarError('telefono', v && !telefonoRegex.test(v))
})

motivoInput.addEventListener('change', () => mostrarError('motivo',  !motivoInput.value))
mensajeInput.addEventListener('blur', () => mostrarError('mensaje', mensajeInput.value.trim().length < 10))

// --- Envío del formulario ---
form.addEventListener('submit', async (e) => {
  e.preventDefault()

  if (!validar()) return

  btnEnviar.disabled    = true
  btnEnviar.textContent = 'Enviando...'
  alerta.className      = 'alerta'

  const { error } = await supabase
    .from('mensajes')
    .insert({
      nombre:   nombreInput.value.trim(),
      email:    emailInput.value.trim(),
      telefono: telefonoInput.value.trim() || null,
      motivo:   motivoInput.value,
      mensaje:  mensajeInput.value.trim()
    })

  if (error) {
    mostrarAlerta('error', 'No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.')
    btnEnviar.disabled    = false
    btnEnviar.textContent = 'Enviar mensaje'
    return
  }

  mostrarAlerta('exito', '¡Mensaje enviado! Te responderemos lo antes posible.')

  // Limpiar el formulario
  form.reset()
  btnEnviar.disabled    = false
  btnEnviar.textContent = 'Enviar mensaje'
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