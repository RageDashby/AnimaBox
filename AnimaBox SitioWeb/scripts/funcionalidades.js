// ============================================================
// funcionalidades.js — Fase 1 y 2 integradas (Sin API)
// ============================================================

var CLAVE_COLECCION = "animabox_coleccion";
var vistaActual = "catalogo";
var filtroColeccion = "todos"; 
var indiceSlider = 0;
var intervaloSlider = null;
var tokenSesion = localStorage.getItem("animabox_token") || null;
var usuarioActual = localStorage.getItem("animabox_usuario") || null;
var coleccionLocal = {}; 

// --- UTILIDADES BÁSICAS ---
function obtenerElemento(selector) { return document.querySelector(selector); }
function crearElemento(etiqueta, clase) { var el = document.createElement(etiqueta); if (clase) el.className = clase; return el; }

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// --- NUEVO: ALERTA PERSONALIZADA ESTILO PÁGINA ---
function mostrarAlerta(mensaje, tipo) {
    var alertaAnterior = document.getElementById("alertaUniversal");
    if (alertaAnterior) {
        if (alertaAnterior.open) alertaAnterior.close();
        alertaAnterior.remove();
    }

    var alerta = document.createElement("dialog");
    alerta.id = "alertaUniversal";
    alerta.className = "alerta-animabox";
    alerta.setAttribute("aria-live", "assertive");
    alerta.setAttribute("aria-atomic", "true");
    alerta.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: ${tipo === 'error' ? '#d9534f' : 'var(--acento, #f1a9bd)'};
        color: ${tipo === 'error' ? '#fff' : 'var(--vino, #7a2e3f)'};
        padding: 15px 30px; border-radius: 8px; font-weight: bold;
        font-family: 'Montserrat', sans-serif; z-index: 9999999;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: opacity 0.3s;
        border: none; margin: 0; max-width: calc(100vw - 32px);
        text-align: center; pointer-events: none; outline: none;
    `;
    alerta.textContent = mensaje;
    document.body.appendChild(alerta);
    alerta.showModal();
    setTimeout(function() {
        alerta.style.opacity = "0";
        setTimeout(function() {
            if (alerta.isConnected) {
                if (alerta.open) alerta.close();
                alerta.remove();
            }
        }, 300);
    }, 3500);
}

// --- NUEVO: MANEJO DE EXPIRACIÓN DE TOKEN ---
function verificarTokenExpirado() {
    if (!tokenSesion) return false;
    try {
        // Decodificar el payload del JWT (la segunda parte del token)
        var payload = JSON.parse(atob(tokenSesion.split('.')[1]));
        var tiempoActual = Math.floor(Date.now() / 1000);
        
        if (payload.exp < tiempoActual) {
            mostrarAlerta("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.", "error");
            setTimeout(() => { cerrarSesion(); }, 2000); 
            return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

// --- TOAST UNIVERSAL (Usando <dialog> para estar en la capa superior) ---
function mostrarToast() {
    // 1. Eliminar cualquier toast anterior para que no se dupliquen
    var toastViejo = document.getElementById("toastUniversal");
    if (toastViejo) toastViejo.remove();

    // 2. Crear el elemento como un <dialog>
    var toast = document.createElement("dialog");
    toast.id = "toastUniversal";
    toast.textContent = "Para poder usar esta función inicie sesión o regístrese";
    
    // 3. Estilos en línea (Mismo estilo de la página, con animación)
    toast.style.cssText = `
        position: fixed;
        top: -100px;
        left: 50%;
        transform: translateX(-50%);
        background: #7a2e3f;
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        font-weight: bold;
        font-family: 'Montserrat', sans-serif;
        border: none;
        box-shadow: 0 4px 15px rgba(0,0,0,0.6);
        transition: top 0.4s ease;
        pointer-events: none;
        text-align: center;
        font-size: 15px;
        margin: 0;
        outline: none;
    `;

    document.body.appendChild(toast);

    // 4. Mostrarlo usando showModal() para que entre a la capa superior (Top Layer)
    toast.showModal();

    // 5. Animación de entrada (deslizar hacia abajo)
    setTimeout(function() {
        toast.style.top = "20px";
    }, 50);

    // 6. Animación de salida y destrucción
    setTimeout(function() {
        toast.style.top = "-100px";
        setTimeout(function() {
            if (toast) {
                toast.close(); // Cerrar el dialog
                toast.remove(); // Eliminar del DOM
            }
        }, 400); 
    }, 2500);
}

// --- SESIÓN Y USUARIOS ---
function actualizarUIUsuario() {
    if (verificarTokenExpirado()) return; 

    var btnLogin = document.getElementById("btnAbrirLogin");
    var btnRegistro = document.getElementById("btnAbrirRegistro");
    var pestanaColeccion = document.getElementById("pestanaColeccion");
    var textoPerfil = document.getElementById("textoUsuarioPerfil");
    var btnCerrar = document.getElementById("btnCerrarSesion");

    if (tokenSesion && usuarioActual) {
        if (btnLogin) btnLogin.classList.add("oculto");
        if (btnRegistro) btnRegistro.classList.add("oculto");
        if (pestanaColeccion) pestanaColeccion.classList.remove("oculto");
        if (textoPerfil) { textoPerfil.classList.remove("oculto"); textoPerfil.textContent = "Hola, " + usuarioActual; }
        if (btnCerrar) btnCerrar.classList.remove("oculto");
    } else {
        if (btnLogin) btnLogin.classList.remove("oculto");
        if (btnRegistro) btnRegistro.classList.remove("oculto");
        if (pestanaColeccion) pestanaColeccion.classList.add("oculto");
        if (textoPerfil) textoPerfil.classList.add("oculto");
        if (btnCerrar) btnCerrar.classList.add("oculto");
    }
}

function configurarEventosAuth() {
    var modalAuth = document.getElementById("modalAuth");
    var seccionLogin = document.getElementById("seccionLogin");
    var seccionRegistro = document.getElementById("seccionRegistro");

    if(document.getElementById("btnAbrirLogin")) {
        document.getElementById("btnAbrirLogin").addEventListener("click", function() {
            seccionLogin.classList.remove("oculto"); seccionRegistro.classList.add("oculto");
            modalAuth.showModal();
        });
        document.getElementById("btnAbrirRegistro").addEventListener("click", function() {
            seccionRegistro.classList.remove("oculto"); seccionLogin.classList.add("oculto");
            modalAuth.showModal();
        });
        document.getElementById("cerrarAuth").addEventListener("click", function() { modalAuth.close(); });
        
        document.getElementById("irARegistro").addEventListener("click", function(e) { e.preventDefault(); seccionLogin.classList.add("oculto"); seccionRegistro.classList.remove("oculto"); });
        document.getElementById("irALogin").addEventListener("click", function(e) { e.preventDefault(); seccionRegistro.classList.add("oculto"); seccionLogin.classList.remove("oculto"); });
    }

    var btnLogin = document.getElementById("btnLogin");
    if(btnLogin) {
        btnLogin.addEventListener("click", function() {
            var usuario = document.getElementById("loginUsuario").value.trim();
            var contrasena = document.getElementById("loginContrasena").value.trim();
            if (!usuario || !contrasena) return mostrarAlerta("Llena todos los campos", "error");

            fetch("http://localhost:3000/api/login", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario: usuario, contrasena: contrasena })
            }).then(res => res.json().then(data => {
                if (res.ok) {
                    localStorage.setItem("animabox_token", data.token);
                    localStorage.setItem("animabox_usuario", data.usuario);
                    window.location.reload();
                } else { mostrarAlerta(data.mensaje, "error"); }
            }));
        });
    }

    var btnRegistro = document.getElementById("btnRegistro");
    if(btnRegistro) {
        btnRegistro.addEventListener("click", function() {
            var correo = document.getElementById("regCorreo").value.trim();
            var usuario = document.getElementById("regUsuario").value.trim();
            var contrasena = document.getElementById("regContrasena").value.trim();
            var confirmar = document.getElementById("regConfirmar").value.trim();

            if (!correo || !usuario || !contrasena) return mostrarAlerta("Llena todos los campos", "error");
            if (contrasena !== confirmar) return mostrarAlerta("Las contraseñas no coinciden", "error");

            fetch("http://localhost:3000/api/registro", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ correo: correo, usuario: usuario, contrasena: contrasena })
            }).then(res => res.json().then(data => {
                if (res.ok) { 
                    mostrarAlerta("Registro exitoso. Ahora puedes iniciar sesión.", "exito"); 
                    seccionRegistro.classList.add("oculto"); seccionLogin.classList.remove("oculto"); 
                }
                else { mostrarAlerta(data.mensaje, "error"); }
            }));
        });
    }
}

function cerrarSesion() {
    localStorage.removeItem("animabox_token");
    localStorage.removeItem("animabox_usuario");
    window.location.reload();
}
// --- NUEVO: RELOJ QUE VIGILA LA EXPIRACIÓN EN TIEMPO REAL ---
function vigilarExpiracionToken() {
    if (!tokenSesion) return;

    setInterval(function() {
        try {
            var payload = JSON.parse(atob(tokenSesion.split('.')[1]));
            var tiempoActual = Math.floor(Date.now() / 1000);
            
            // Si el token expiró
            if (payload.exp < tiempoActual) {
                mostrarAlerta("Tu sesión ha expirado. Recargando la página...", "error");
                
                // Limpiamos los datos
                localStorage.removeItem("animabox_token");
                localStorage.removeItem("animabox_usuario");
                localStorage.removeItem("animabox_coleccion");
                
                // Recargamos la página para que entre en vigor el modo invitado
                setTimeout(function() {
                    window.location.reload();
                }, 2500); // Espera 2.5 segundos para que el usuario lea el mensaje
            }
        } catch (e) {
            // Si hay un error leyendo el token, no hacemos nada
        }
    }, 1000); // Revisa cada 1 segundo (1000 ms)
}
// --- COLECCIÓN (Lógica y API) ---
function cargarColeccionDesdeBD() {
    if (!tokenSesion) return;
    fetch("http://localhost:3000/api/coleccion", {
        headers: { "Authorization": tokenSesion }
    }).then(res => res.json()).then(data => {
        coleccionLocal = {};
        if (data.coleccion) {
            for (var i = 0; i < data.coleccion.length; i++) {
                var item = data.coleccion[i];
                coleccionLocal[item.pelicula_id] = {
                    enColeccion: item.en_coleccion === 1,
                    favorito: item.favorito === 1,
                    visto: item.visto === 1
                };
            }
        }
        renderizarCatalogo();
        actualizarContadorColeccion();
    }).catch(err => console.log("Error cargando colección", err));
}

function actualizarContadorColeccion() {
    var total = 0;
    for (var id in coleccionLocal) { if (coleccionLocal[id].enColeccion) total++; }
    var el = obtenerElemento("#contadorColeccion");
    if (el) el.textContent = total;
}

function marcarBoton(tarjeta, accion, activo) {
  var btn = tarjeta.querySelector('.accion-icono[data-accion="' + accion + '"]');
  if (!btn) return;
  if (activo) btn.classList.add("activa");
  else btn.classList.remove("activa");

  var icono = btn.querySelector("i");
  var mapa = {
    catalogo: ["fa-regular fa-bookmark", "fa-solid fa-bookmark"],
    favorito: ["fa-regular fa-heart", "fa-solid fa-heart"],
    visto: ["fa-regular fa-eye", "fa-solid fa-eye"]
  };
  icono.className = mapa[accion][activo ? 1 : 0];
}

function alternarFlag(peliculaId, accion) {
    if (!tokenSesion) { mostrarToast(); return; }
    
    var id = String(peliculaId);
    if (!coleccionLocal[id]) coleccionLocal[id] = { enColeccion: false, favorito: false, visto: false };

    if (accion === "catalogo") coleccionLocal[id].enColeccion = !coleccionLocal[id].enColeccion;
    if (accion === "favorito") { coleccionLocal[id].favorito = !coleccionLocal[id].favorito; if (coleccionLocal[id].favorito) coleccionLocal[id].enColeccion = true; }
    if (accion === "visto") { coleccionLocal[id].visto = !coleccionLocal[id].visto; if (coleccionLocal[id].visto) coleccionLocal[id].enColeccion = true; }
    if (!coleccionLocal[id].enColeccion) coleccionLocal[id] = { enColeccion: false, favorito: false, visto: false };

    actualizarContadorColeccion();
    renderizarCatalogo();

    fetch("http://localhost:3000/api/accion", {
        method: "PUT", headers: { "Content-Type": "application/json", "Authorization": tokenSesion },
        body: JSON.stringify({ accion: "guardarColeccion", peliculaId: peliculaId, enColeccion: coleccionLocal[id].enColeccion, favorito: coleccionLocal[id].favorito, visto: coleccionLocal[id].visto })
    }).catch(err => console.log("Error guardando en BD", err));
}

// --- HOVER Y SLIDER ---
function configurarHoverTarjetas() {
  var posters = document.querySelectorAll(".tarjeta-poster");
  for (var i = 0; i < posters.length; i++) {
    var poster = posters[i];
    poster.addEventListener("mouseover", function (e) { var ov = e.currentTarget.querySelector(".tarjeta-overlay"); if (ov) ov.style.opacity = "1"; });
    poster.addEventListener("mouseleave", function (e) { var ov = e.currentTarget.querySelector(".tarjeta-overlay"); if (ov) ov.style.opacity = "0"; });
  }
}

function inicializarSlider(peliculas) {
  var destacadas = []; var copia = peliculas.slice(); copia.sort(function () { return Math.random() - 0.5; });
  for (var i = 0; i < 5 && i < copia.length; i++) destacadas.push(copia[i]);
  var cont = obtenerElemento("#sliderContenido"); var puntos = obtenerElemento("#sliderPuntos");
  if(!cont) return;
  cont.innerHTML = ""; puntos.innerHTML = "";
  
  for (var j = 0; j < destacadas.length; j++) {
    var p = destacadas[j];
    var slide = crearElemento("div", "slider-slide" + (j === 0 ? " activo" : ""));
    slide.style.backgroundImage = 'url("' + p.imagen_url + '")';
    slide.innerHTML = '<div class="slider-info"><h2>' + escaparHtml(p.nombre) + "</h2><p>" + escaparHtml(p.director) + " · " + escaparHtml(p.anio_lanzamiento) + "</p></div>";
    
    // SOLUCIÓN AL BUG DEL SLIDER (Scope de la variable)
    (function(idPelicula) {
        slide.addEventListener("click", function () { 
            abrirModal(idPelicula); 
        });
    })(p.id);

    cont.appendChild(slide);
    
    var punto = crearElemento("button", "slider-punto" + (j === 0 ? " activo" : ""));
    punto.dataset.indice = j;
    (function(indice) {
        punto.addEventListener("click", function () { irASlide(indice); });
    })(j);
    puntos.appendChild(punto);
  }
  obtenerElemento("#flechaIzquierda").onclick = function () { moverSlider(-1); };
  obtenerElemento("#flechaDerecha").onclick = function () { moverSlider(1); };
  iniciarAutoplay();
}

function irASlide(i) {
  var slides = document.querySelectorAll(".slider-slide"); var puntos = document.querySelectorAll(".slider-punto"); if (!slides.length) return;
  slides[indiceSlider].classList.remove("activo"); puntos[indiceSlider].classList.remove("activo");
  indiceSlider = (i + slides.length) % slides.length;
  slides[indiceSlider].classList.add("activo"); puntos[indiceSlider].classList.add("activo");
}
function moverSlider(dir) { irASlide(indiceSlider + dir); reiniciarAutoplay(); }
function iniciarAutoplay() { intervaloSlider = setInterval(function () { irASlide(indiceSlider + 1); }, 6000); }
function reiniciarAutoplay() { clearInterval(intervaloSlider); iniciarAutoplay(); }

// --- MODAL CONTROLS ---
function mostrarModal() {
  document.body.classList.add("modal-abierto");
  obtenerElemento("#modalDetalles").showModal();
}
function cerrarModal() {
  document.body.classList.remove("modal-abierto");
  obtenerElemento("#modalDetalles").close();
}
function configurarCierreModal() {
  var btnCerrar = obtenerElemento("#cerrarModal");
  if(btnCerrar) btnCerrar.addEventListener("click", cerrarModal);
  var modal = obtenerElemento("#modalDetalles");
  if(modal) modal.addEventListener("click", function (e) { if (e.target === modal) cerrarModal(); });
}

// --- FILTROS ---
function llenarSelect(selector, valores, etiqueta, desc) {
  var select = obtenerElemento(selector); if(!select) return;
  var unicos = []; var vistos = {};
  for (var i = 0; i < valores.length; i++) { var v = valores[i]; if (v === null || v === undefined || v === "") continue; if (vistos[v]) continue; vistos[v] = true; unicos.push(v); }
  if (desc) unicos.sort(function (a, b) { return Number(b) - Number(a); });
  else unicos.sort(function (a, b) { return String(a).localeCompare(String(b), "es"); });
  var html = '<option value="">' + etiqueta + "</option>";
  for (var j = 0; j < unicos.length; j++) { html += '<option value="' + escaparHtml(unicos[j]) + '">' + escaparHtml(unicos[j]) + "</option>"; }
  select.innerHTML = html;
}

function inicializarFiltros(peliculas) {
  var estudios = [], directores = [], anios = [], generos = [];
  for (var i = 0; i < peliculas.length; i++) {
    estudios.push(peliculas[i].casa_productora); directores.push(peliculas[i].director); anios.push(peliculas[i].anio_lanzamiento);
    var g = peliculas[i].generos || []; for (var k = 0; k < g.length; k++) generos.push(g[k]);
  }
  llenarSelect("#filtroEstudio", estudios, "Todos los estudios", false);
  llenarSelect("#filtroDirector", directores, "Todos los directores", false);
  llenarSelect("#filtroAnio", anios, "Todos los años", true);
  llenarSelect("#filtroGenero", generos, "Todos los géneros", false);
}

// --- EVENTOS GLOBALES ---
function conectarEventosGlobales() {
  if(obtenerElemento("#entradaBusqueda")) obtenerElemento("#entradaBusqueda").addEventListener("input", renderizarCatalogo);
  if(obtenerElemento("#filtroEstudio")) {
      obtenerElemento("#filtroEstudio").addEventListener("change", renderizarCatalogo);
      obtenerElemento("#filtroAnio").addEventListener("change", renderizarCatalogo);
      obtenerElemento("#filtroGenero").addEventListener("change", renderizarCatalogo);
      obtenerElemento("#filtroDirector").addEventListener("change", renderizarCatalogo);

      obtenerElemento("#limpiarFiltros").addEventListener("click", function () {
        obtenerElemento("#entradaBusqueda").value = "";
        obtenerElemento("#filtroEstudio").value = ""; obtenerElemento("#filtroAnio").value = ""; obtenerElemento("#filtroGenero").value = ""; obtenerElemento("#filtroDirector").value = "";
        renderizarCatalogo();
      });
  }

  if(obtenerElemento("#pestanaCatalogo")) {
      obtenerElemento("#pestanaCatalogo").addEventListener("click", function () {
        vistaActual = "catalogo"; obtenerElemento("#pestanaCatalogo").classList.add("activo"); obtenerElemento("#pestanaColeccion").classList.remove("activo");
        document.getElementById("barraFiltrosPrincipales").classList.remove("oculto");
        document.getElementById("tabsColeccion").classList.add("oculto");
        renderizarCatalogo();
      });
  }

  if(obtenerElemento("#pestanaColeccion")) {
      obtenerElemento("#pestanaColeccion").addEventListener("click", function () {
        if (!tokenSesion) { mostrarToast(); return; }
        vistaActual = "coleccion"; obtenerElemento("#pestanaColeccion").classList.add("activo"); obtenerElemento("#pestanaCatalogo").classList.remove("activo");
        document.getElementById("barraFiltrosPrincipales").classList.add("oculto");
        document.getElementById("tabsColeccion").classList.remove("oculto");
        document.getElementById("tituloColeccionUsuario").textContent = "Colección de " + usuarioActual;
        renderizarCatalogo();
      });
  }

  var tabBtns = document.querySelectorAll(".tab-btn");
  for(var t = 0; t < tabBtns.length; t++) {
      tabBtns[t].addEventListener("click", function() {
          for(var k = 0; k < tabBtns.length; k++) tabBtns[k].classList.remove("activo");
          this.classList.add("activo");
          filtroColeccion = this.dataset.filtro;
          renderizarCatalogo();
      });
  }

  if(obtenerElemento("#logoInicio")) {
      obtenerElemento("#logoInicio").addEventListener("click", function (e) {
        e.preventDefault(); vistaActual = "catalogo"; 
        if(obtenerElemento("#pestanaCatalogo")) obtenerElemento("#pestanaCatalogo").click(); 
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
  }

  var btnCerrar = document.getElementById("btnCerrarSesion");
  if(btnCerrar) btnCerrar.addEventListener("click", cerrarSesion);
}