
     import { supabase } from './supabase.js'

    // --- Navbar: cambia de aspecto al hacer scroll ---
    const navbar = document.getElementById('navbar')
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 40)
    })

    // --- Animación de entrada del hero al cargar ---
    window.addEventListener('load', () => {
      document.getElementById('hero').classList.add('visible')
    })

    // --- Intersection Observer: anima las cards al aparecer en pantalla ---
    const cards = document.querySelectorAll('.card')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('visible')
          }, i * 150)
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.2 })

    cards.forEach(card => observer.observe(card))

    // --- Sesión activa: adapta los botones si el usuario ya está logueado ---
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      document.getElementById('sesion-msg').style.display = 'block'
      document.getElementById('btn-hero').href = 'pages/dashboard.html'
      document.getElementById('btn-hero').textContent = 'Ir a mis reservas'
      document.getElementById('link-login').href = 'pages/dashboard.html'
      document.getElementById('link-login').textContent = 'Mi panel'
      document.getElementById('link-reservar').href = 'pages/nueva-reserva.html'
    }
  