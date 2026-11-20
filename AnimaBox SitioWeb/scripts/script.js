// ============================================================
// script.js — Lógica frontend de AnimaBox
// API: http://localhost:3000 (Node nativo en ApiPeliculas/apip.js)
// ============================================================

const URL_API = "http://localhost:3000";
const CLAVE_COLECCION = "animabox_coleccion"; // { [peliculaId]: { enColeccion, favorito, visto } }
let peliculas = [];
let comentariosCache = {}; // { [peliculaId]: [comentarios] }
let vistaActual = "catalogo";
let indiceSlider = 0;
let intervaloSlider = null;

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);
const crear = (etiqueta, clase) => {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  return el;
};
const escapar = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

// ---------- LocalStorage: colección / favoritos / vistos ----------
function leerColeccion() {
  try { return JSON.parse(localStorage.getItem(CLAVE_COLECCION)) || {}; }
  catch { return {}; }
}
function guardarColeccion(obj) {
  localStorage.setItem(CLAVE_COLECCION, JSON.stringify(obj));
  actualizarContadorColeccion();
}
function actualizarContadorColeccion() {
  const col = leerColeccion();
  const total = Object.values(col).filter(f => f.enColeccion).length;
  $("#contadorColeccion").textContent = total;
}

// ---------- Llamadas a la API ----------
async function apiGet(ruta) {
  const res = await fetch(`${URL_API}${ruta}`);
  if (!res.ok) throw new Error(`GET ${ruta} → ${res.status}`);
  return res.json();
}
async function apiEnviar(metodo, cuerpo) {
  const res = await fetch(`${URL_API}/api/accion`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.mensaje || `Error ${res.status}`);
  return data;
}

// ---------- Inicialización ----------
async function iniciar() {
  try {
    const data = await apiGet("/api/peliculas");
    peliculas = data.peliculas || [];
    inicializarFiltros();
    inicializarSlider();
    renderizarCatalogo();
    actualizarContadorColeccion();
    conectarEventos();
  } catch (err) {
    console.error(err);
    $("#mensajeError").classList.remove("oculto");
    $("#mensajeError").innerHTML = `<strong>No se pudo cargar el catálogo.</strong><br>${escapar(err.message)}<br>Verifica que el servidor Node esté corriendo en <code>${URL_API}</code>.`;
    $("#contadorResultados").textContent = "Error";
  }
}

// ---------- Filtros (4 selects, igual que plantilla) ----------
function inicializarFiltros() {
  llenarSelect("#filtroEstudio", peliculas.map(p => p.casa_productora), "Todos los estudios");
  llenarSelect("#filtroDirector", peliculas.map(p => p.director), "Todos los directores");
  llenarSelect("#filtroAnio", peliculas.map(p => p.anio_lanzamiento), "Todos los años", true);
  llenarSelect("#filtroGenero", peliculas.flatMap(p => p.generos || []), "Todos los géneros");
}
function llenarSelect(sel, valores, etiqueta, desc = false) {
  const select = $(sel);
  const unicos = [...new Set(valores.filter(v => v !== null && v !== undefined && v !== ""))];
  unicos.sort((a, b) => desc ? Number(b) - Number(a) : String(a).localeCompare(String(b), "es"));
  select.innerHTML = `<option value="">${etiqueta}</option>` +
    unicos.map(v => `<option value="${escapar(v)}">${escapar(v)}</option>`).join("");
}

// ---------- Slider ----------
function inicializarSlider() {
  const destacadas = [...peliculas].sort(() => Math.random() - 0.5).slice(0, 5);
  const cont = $("#sliderContenido");
  const puntos = $("#sliderPuntos");
  cont.innerHTML = "";
  puntos.innerHTML = "";

  destacadas.forEach((p, i) => {
    const slide = crear("div", "slider-slide" + (i === 0 ? " activo" : ""));
    slide.style.backgroundImage = `url("${p.imagen_url}")`;
    slide.innerHTML = `<div class="slider-info"><h2>${escapar(p.nombre)}</h2><p>${escapar(p.director)} · ${escapar(p.anio_lanzamiento)}</p></div>`;
    slide.addEventListener("click", () => abrirModal(p.id));
    cont.appendChild(slide);

    const punto = crear("button", "slider-punto" + (i === 0 ? " activo" : ""));
    punto.addEventListener("click", () => irASlide(i));
    puntos.appendChild(punto);
  });

  $("#flechaIzquierda").onclick = () => moverSlider(-1);
  $("#flechaDerecha").onclick = () => moverSlider(1);
  iniciarAutoplay();
}
function irASlide(i) {
  const slides = document.querySelectorAll(".slider-slide");
  const puntos = document.querySelectorAll(".slider-punto");
  if (!slides.length) return;
  slides[indiceSlider].classList.remove("activo");
  puntos[indiceSlider].classList.remove("activo");
  indiceSlider = (i + slides.length) % slides.length;
  slides[indiceSlider].classList.add("activo");
  puntos[indiceSlider].classList.add("activo");
}
function moverSlider(dir) { irASlide(indiceSlider + dir); reiniciarAutoplay(); }
function iniciarAutoplay() {
  intervaloSlider = setInterval(() => irASlide(indiceSlider + 1), 6000); // 6 seg
}
function reiniciarAutoplay() {
  clearInterval(intervaloSlider);
  iniciarAutoplay();
}

// ---------- Render del catálogo (clonación de tarjeta) ----------
function renderizarCatalogo() {
  const busqueda = $("#entradaBusqueda").value.trim().toLowerCase();
  const estudio = $("#filtroEstudio").value;
  const anio = $("#filtroAnio").value;
  const genero = $("#filtroGenero").value;
  const director = $("#filtroDirector").value;
  const coleccion = leerColeccion();

  // En "Mi colección" solo se muestran las marcadas con enColeccion
  const visibles = peliculas.filter(p => {
    if (vistaActual === "coleccion" && !coleccion[p.id]?.enColeccion) return false;
    const coincideBusqueda = !busqueda ||
      [p.nombre, p.director, p.casa_productora].some(v =>
        String(v || "").toLowerCase().includes(busqueda));
    return coincideBusqueda &&
      (!estudio || p.casa_productora === estudio) &&
      (!anio || String(p.anio_lanzamiento) === anio) &&
      (!genero || (p.generos || []).includes(genero)) &&
      (!director || p.director === director);
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  $("#tituloLista").textContent = vistaActual === "coleccion" ? "Mi colección" : "Todas las películas";
  $("#contadorResultados").textContent = `${visibles.length} ${visibles.length === 1 ? "película" : "películas"}`;
  $("#mensajeVacio").classList.toggle("oculto", visibles.length > 0);

  const contenedor = $("#listaPeliculas");
  contenedor.innerHTML = "";
  const plantilla = $("#plantillaTarjeta");

  visibles.forEach(p => {
    const tarjeta = plantilla.cloneNode(true);
    tarjeta.classList.remove("oculto");
    tarjeta.removeAttribute("aria-hidden");
    tarjeta.dataset.id = p.id;

    const img = tarjeta.querySelector(".tarjeta-imagen");
    img.src = p.imagen_url;
    img.alt = `Póster de ${p.nombre}`;
    img.onerror = () => { img.src = "https://placehold.co/500x750/432c3b/f1a9bd?text=Sin+imagen"; };

    tarjeta.querySelector(".overlay-anio").textContent = p.anio_lanzamiento;
    tarjeta.querySelector(".overlay-director").textContent = p.director;
    tarjeta.querySelector(".overlay-generos").textContent = (p.generos || []).slice(0, 2).join(" · ");
    tarjeta.querySelector(".tarjeta-titulo").textContent = p.nombre;

    // Estado de los 3 botones según localStorage
    const estado = coleccion[p.id] || {};
    marcarBoton(tarjeta, "catalogo", estado.enColeccion);
    marcarBoton(tarjeta, "favorito", estado.favorito);
    marcarBoton(tarjeta, "visto", estado.visto);

    // Click en póster → modal
    tarjeta.querySelector(".tarjeta-poster").addEventListener("click", (e) => {
      if (e.target.closest(".accion-icono")) return;
      abrirModal(p.id);
    });

    // Click en los 3 botones
    tarjeta.querySelectorAll(".accion-icono").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        alternarFlag(p.id, btn.dataset.accion);
      });
    });

    contenedor.appendChild(tarjeta);
  });
}

// Marca visualmente el botón según su flag
function marcarBoton(tarjeta, accion, activo) {
  const btn = tarjeta.querySelector(`.accion-icono[data-accion="${accion}"]`);
  if (!btn) return;
  btn.classList.toggle("activa", !!activo);
  const icono = btn.querySelector("i");
  const mapa = {
    catalogo: ["fa-regular fa-bookmark", "fa-solid fa-bookmark"],
    favorito: ["fa-regular fa-heart", "fa-solid fa-heart"],
    visto: ["fa-regular fa-eye", "fa-solid fa-eye"]
  };
  icono.className = mapa[accion][activo ? 1 : 0];
}

// Alterna un flag (catálogo/favorito/visto) en localStorage
function alternarFlag(peliculaId, accion) {
  const col = leerColeccion();
  const id = String(peliculaId);
  col[id] = col[id] || { enColeccion: false, favorito: false, visto: false };

  if (accion === "catalogo") col[id].enColeccion = !col[id].enColeccion;
  if (accion === "favorito") { col[id].favorito = !col[id].favorito; if (col[id].favorito) col[id].enColeccion = true; }
  if (accion === "visto") { col[id].visto = !col[id].visto; if (col[id].visto) col[id].enColeccion = true; }

  // Si ya no está en colección, limpia flags
  if (!col[id].enColeccion) col[id] = { enColeccion: false, favorito: false, visto: false };

  guardarColeccion(col);
  renderizarCatalogo();
}

// ---------- Modal de detalles ----------
async function abrirModal(peliculaId) {
  const p = peliculas.find(x => x.id === peliculaId);
  if (!p) return;
  const coleccion = leerColeccion();
  const estado = coleccion[p.id] || {};

  // Carga comentarios desde la API
  let comentarios = [];
  try {
    const data = await apiGet("/api/comentarios");
    comentarios = (data.arreglo || []).filter(c => c.peliculaId === p.id);
  } catch (err) { console.warn("No se pudieron cargar comentarios:", err); }

  const galeria = (p.galeria || []).slice(0, 3);
  const estrellas = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  $("#contenidoModal").innerHTML = `
    <div class="modal-layout">
      <div class="modal-poster">
        <img src="${escapar(p.imagen_url)}" alt="Póster de ${escapar(p.nombre)}">
        <div class="modal-galeria">
          ${galeria.map(g => `<img src="${escapar(g)}" alt="Imagen de ${escapar(p.nombre)}">`).join("")}
        </div>
      </div>
      <div class="modal-info">
        <h2>${escapar(p.nombre)}</h2>
        <p class="meta">${escapar(p.director)} · ${escapar(p.anio_lanzamiento)} · ${escapar(p.duracion)} min · ${escapar(p.casa_productora)}</p>
        <p class="sinopsis">${escapar(p.descripcion)}</p>
        <div class="etiquetas">${(p.generos || []).map(g => `<span class="etiqueta">${escapar(g)}</span>`).join("")}</div>
        <div class="modal-acciones">
          <button class="accion-icono ${estado.enColeccion ? "activa" : ""}" data-accion="catalogo" title="Agregar al catálogo"><i class="fa-${estado.enColeccion ? "solid" : "regular"} fa-bookmark"></i></button>
          <button class="accion-icono ${estado.favorito ? "activa" : ""}" data-accion="favorito" title="Favorito"><i class="fa-${estado.favorito ? "solid" : "regular"} fa-heart"></i></button>
          <button class="accion-icono ${estado.visto ? "activa" : ""}" data-accion="visto" title="Ya visto"><i class="fa-${estado.visto ? "solid" : "regular"} fa-eye"></i></button>
        </div>
        <section class="seccion-comentarios">
          <h3>Comentarios</h3>
          <div id="listaComentarios">
            ${comentarios.length ? comentarios.map(c => `
              <div class="comentario" data-id="${c.id}">
                <div class="comentario-cabecera">
                  <span class="comentario-usuario">${escapar(c.usuario)}</span>
                  <span class="comentario-estrellas">${estrellas(c.calificacion)}</span>
                </div>
                <p class="comentario-texto">${escapar(c.texto)}</p>
                <div class="comentario-acciones">
                  <button class="me-gusta" data-accion="like"><i class="fa-regular fa-heart"></i> ${c.likes || 0}</button>
                  <button data-accion="editar"><i class="fa-solid fa-pen"></i> Editar</button>
                  <button data-accion="eliminar"><i class="fa-solid fa-trash"></i> Eliminar</button>
                </div>
              </div>`).join("") : '<p class="mensaje">Aún no hay comentarios.</p>'}
          </div>
          <form class="formulario-comentario" id="formComentario">
            <input id="comUsuario" placeholder="Tu nombre o alias" maxlength="40" required>
            <select id="comCalificacion">
              <option value="5">5 estrellas</option><option value="4">4 estrellas</option>
              <option value="3">3 estrellas</option><option value="2">2 estrellas</option>
              <option value="1">1 estrella</option>
            </select>
            <textarea id="comTexto" placeholder="Escribe tu comentario..." maxlength="500" required></textarea>
            <button type="submit">Publicar comentario</button>
          </form>
        </section>
      </div>
    </div>`;

  // Botones de flag dentro del modal
  $("#contenidoModal").querySelectorAll(".modal-acciones .accion-icono").forEach(btn => {
    btn.addEventListener("click", () => {
      alternarFlag(p.id, btn.dataset.accion);
      abrirModal(p.id); // re-render
    });
  });

  // Formulario POST comentario
  $("#formComentario").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await apiEnviar("POST", {
        accion: "crearComentario",
        peliculaId: p.id,
        usuario: $("#comUsuario").value.trim(),
        texto: $("#comTexto").value.trim(),
        calificacion: Number($("#comCalificacion").value)
      });
      abrirModal(p.id);
    } catch (err) { alert("Error al publicar: " + err.message); }
  });

  // Acciones sobre comentarios (like / editar / eliminar)
  $("#listaComentarios").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-accion]");
    if (!btn) return;
    const idComentario = Number(btn.closest(".comentario").dataset.id);
    const accion = btn.dataset.accion;
    try {
      if (accion === "like") {
        await apiEnviar("PUT", { accion: "darLike", id: idComentario });
      } else if (accion === "eliminar") {
        if (!confirm("¿Eliminar este comentario?")) return;
        await apiEnviar("DELETE", { accion: "eliminarComentario", id: idComentario });
      } else if (accion === "editar") {
        const nuevo = prompt("Edita tu comentario:");
        if (nuevo === null) return;
        const nuevaCal = prompt("Nueva calificación (1-5):", "5");
        await apiEnviar("PUT", {
          accion: "editarComentario", id: idComentario,
          texto: nuevo, calificacion: Number(nuevaCal) || 5
        });
      }
      abrirModal(p.id);
    } catch (err) { alert("Error: " + err.message); }
  });

  $("#modalDetalles").showModal();
}

// ---------- Eventos globales ----------
function conectarEventos() {
  $("#entradaBusqueda").addEventListener("input", renderizarCatalogo);
  ["#filtroEstudio", "#filtroAnio", "#filtroGenero", "#filtroDirector"].forEach(sel =>
    $(sel).addEventListener("change", renderizarCatalogo));
  $("#limpiarFiltros").addEventListener("click", () => {
    $("#entradaBusqueda").value = "";
    ["#filtroEstudio", "#filtroAnio", "#filtroGenero", "#filtroDirector"].forEach(s => $(s).value = "");
    renderizarCatalogo();
  });
  $("#pestanaCatalogo").addEventListener("click", () => {
    vistaActual = "catalogo";
    $("#pestanaCatalogo").classList.add("activo");
    $("#pestanaColeccion").classList.remove("activo");
    renderizarCatalogo();
  });
  $("#pestanaColeccion").addEventListener("click", () => {
    vistaActual = "coleccion";
    $("#pestanaColeccion").classList.add("activo");
    $("#pestanaCatalogo").classList.remove("activo");
    renderizarCatalogo();
  });
  $("#logoInicio").addEventListener("click", (e) => {
    e.preventDefault();
    vistaActual = "catalogo";
    $("#pestanaCatalogo").click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#cerrarModal").addEventListener("click", () => $("#modalDetalles").close());
  $("#modalDetalles").addEventListener("click", (e) => {
    if (e.target === $("#modalDetalles")) $("#modalDetalles").close();
  });
}

// Arranque
iniciar();