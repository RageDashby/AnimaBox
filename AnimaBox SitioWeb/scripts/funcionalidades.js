var CLAVE_COLECCION = "animabox_coleccion";
var vistaActual = "catalogo";
var indiceSlider = 0;
var intervaloSlider = null;

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function obtenerElemento(selector) {
  return document.querySelector(selector);
}

function crearElemento(etiqueta, clase) {
  var el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  return el;
}

// 
function leerColeccion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_COLECCION)) || {};
  } catch (err) {
    return {};
  }
}

function guardarColeccion(obj) {
  localStorage.setItem(CLAVE_COLECCION, JSON.stringify(obj));
  actualizarContadorColeccion();
}

function actualizarContadorColeccion() {
  var col = leerColeccion();
  var total = 0;
  for (var id in col) {
    if (col[id].enColeccion) total = total + 1;
  }
  obtenerElemento("#contadorColeccion").textContent = total;
}

// Flag dentro del catalogo
function alternarFlag(peliculaId, accion) {
  var col = leerColeccion();
  var id = String(peliculaId);

  if (!col[id]) {
    col[id] = { enColeccion: false, favorito: false, visto: false };
  }

  if (accion === "catalogo") {
    col[id].enColeccion = !col[id].enColeccion;
  }
  if (accion === "favorito") {
    col[id].favorito = !col[id].favorito;
    if (col[id].favorito) col[id].enColeccion = true;
  }
  if (accion === "visto") {
    col[id].visto = !col[id].visto;
    if (col[id].visto) col[id].enColeccion = true;
  }

  if (!col[id].enColeccion) {
    col[id] = { enColeccion: false, favorito: false, visto: false };
  }

  guardarColeccion(col);
  renderizarCatalogo(); 
}

// Marca visualmente el boton
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

// Hover
function configurarHoverTarjetas() {
  var posters = document.querySelectorAll(".tarjeta-poster");

  for (var i = 0; i < posters.length; i++) {
    var poster = posters[i];
    var overlay = poster.querySelector(".tarjeta-overlay");
    if (!overlay) continue;

    poster.addEventListener("mouseover", function (evento) {
      var ov = evento.currentTarget.querySelector(".tarjeta-overlay");
      if (ov) ov.style.opacity = "1";
    });

    poster.addEventListener("mouseleave", function (evento) {
      var ov = evento.currentTarget.querySelector(".tarjeta-overlay");
      if (ov) ov.style.opacity = "0";
    });
  }
}

// Slider
function inicializarSlider(peliculas) {
  var destacadas = [];
  var copia = peliculas.slice();
  copia.sort(function () { return Math.random() - 0.5; });
  for (var i = 0; i < 5 && i < copia.length; i++) {
    destacadas.push(copia[i]);
  }

  var cont = obtenerElemento("#sliderContenido");
  var puntos = obtenerElemento("#sliderPuntos");
  cont.innerHTML = "";
  puntos.innerHTML = "";

  for (var j = 0; j < destacadas.length; j++) {
    var p = destacadas[j];

    var slide = crearElemento("div", "slider-slide" + (j === 0 ? " activo" : ""));
    slide.style.backgroundImage = 'url("' + p.imagen_url + '")';
    slide.innerHTML =
      '<div class="slider-info"><h2>' + escaparHtml(p.nombre) + "</h2>" +
      "<p>" + escaparHtml(p.director) + " · " + escaparHtml(p.anio_lanzamiento) + "</p></div>";
    slide.dataset.idPelicula = p.id;
    slide.addEventListener("click", function (evento) {
      abrirModal(Number(evento.currentTarget.dataset.idPelicula)); // función de script.js
    });
    cont.appendChild(slide);

    var punto = crearElemento("button", "slider-punto" + (j === 0 ? " activo" : ""));
    punto.dataset.indice = j;
    punto.addEventListener("click", function (evento) {
      irASlide(Number(evento.currentTarget.dataset.indice));
    });
    puntos.appendChild(punto);
  }

  obtenerElemento("#flechaIzquierda").onclick = function () { moverSlider(-1); };
  obtenerElemento("#flechaDerecha").onclick = function () { moverSlider(1); };
  iniciarAutoplay();
}

function irASlide(i) {
  var slides = document.querySelectorAll(".slider-slide");
  var puntos = document.querySelectorAll(".slider-punto");
  if (!slides.length) return;

  slides[indiceSlider].classList.remove("activo");
  puntos[indiceSlider].classList.remove("activo");

  indiceSlider = (i + slides.length) % slides.length;

  slides[indiceSlider].classList.add("activo");
  puntos[indiceSlider].classList.add("activo");
}

function moverSlider(dir) {
  irASlide(indiceSlider + dir);
  reiniciarAutoplay();
}

function iniciarAutoplay() {
  intervaloSlider = setInterval(function () { irASlide(indiceSlider + 1); }, 6000);
}

function reiniciarAutoplay() {
  clearInterval(intervaloSlider);
  iniciarAutoplay();
}

// Abrir y cerrar modal
function mostrarModal() {
  obtenerElemento("#modalDetalles").showModal();
}

function cerrarModal() {
  obtenerElemento("#modalDetalles").close();
}

function configurarCierreModal() {
  obtenerElemento("#cerrarModal").addEventListener("click", cerrarModal);
  obtenerElemento("#modalDetalles").addEventListener("click", function (evento) {
    if (evento.target === obtenerElemento("#modalDetalles")) cerrarModal();
  });
}

// Filtrado
function llenarSelect(selector, valores, etiqueta, desc) {
  var select = obtenerElemento(selector);
  var unicos = [];
  var vistos = {};

  for (var i = 0; i < valores.length; i++) {
    var v = valores[i];
    if (v === null || v === undefined || v === "") continue;
    if (vistos[v]) continue;
    vistos[v] = true;
    unicos.push(v);
  }

  if (desc) {
    unicos.sort(function (a, b) { return Number(b) - Number(a); });
  } else {
    unicos.sort(function (a, b) { return String(a).localeCompare(String(b), "es"); });
  }

  var html = '<option value="">' + etiqueta + "</option>";
  for (var j = 0; j < unicos.length; j++) {
    html += '<option value="' + escaparHtml(unicos[j]) + '">' + escaparHtml(unicos[j]) + "</option>";
  }
  select.innerHTML = html;
}

function inicializarFiltros(peliculas) {
  var estudios = [], directores = [], anios = [], generos = [];

  for (var i = 0; i < peliculas.length; i++) {
    estudios.push(peliculas[i].casa_productora);
    directores.push(peliculas[i].director);
    anios.push(peliculas[i].anio_lanzamiento);
    var g = peliculas[i].generos || [];
    for (var k = 0; k < g.length; k++) generos.push(g[k]);
  }

  llenarSelect("#filtroEstudio", estudios, "Todos los estudios", false);
  llenarSelect("#filtroDirector", directores, "Todos los directores", false);
  llenarSelect("#filtroAnio", anios, "Todos los años", true);
  llenarSelect("#filtroGenero", generos, "Todos los géneros", false);
}

// Eventos
function conectarEventosGlobales() {
  obtenerElemento("#entradaBusqueda").addEventListener("input", renderizarCatalogo);
  obtenerElemento("#filtroEstudio").addEventListener("change", renderizarCatalogo);
  obtenerElemento("#filtroAnio").addEventListener("change", renderizarCatalogo);
  obtenerElemento("#filtroGenero").addEventListener("change", renderizarCatalogo);
  obtenerElemento("#filtroDirector").addEventListener("change", renderizarCatalogo);

  obtenerElemento("#limpiarFiltros").addEventListener("click", function () {
    obtenerElemento("#entradaBusqueda").value = "";
    obtenerElemento("#filtroEstudio").value = "";
    obtenerElemento("#filtroAnio").value = "";
    obtenerElemento("#filtroGenero").value = "";
    obtenerElemento("#filtroDirector").value = "";
    renderizarCatalogo();
  });

  obtenerElemento("#pestanaCatalogo").addEventListener("click", function () {
    vistaActual = "catalogo";
    obtenerElemento("#pestanaCatalogo").classList.add("activo");
    obtenerElemento("#pestanaColeccion").classList.remove("activo");
    renderizarCatalogo();
  });

  obtenerElemento("#pestanaColeccion").addEventListener("click", function () {
    vistaActual = "coleccion";
    obtenerElemento("#pestanaColeccion").classList.add("activo");
    obtenerElemento("#pestanaCatalogo").classList.remove("activo");
    renderizarCatalogo();
  });

  obtenerElemento("#logoInicio").addEventListener("click", function (evento) {
    evento.preventDefault();
    vistaActual = "catalogo";
    obtenerElemento("#pestanaCatalogo").click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}