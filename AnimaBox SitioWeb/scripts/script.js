
var URL_API = "http://localhost:3000";
var peliculas = [];

// Api

function apiGet(ruta) {
  return fetch(URL_API + ruta).then(function (recurso) {
    if (!recurso.ok) throw new Error("GET " + ruta + " → " + recurso.status);
    return recurso.json();
  });
}

function apiEnviar(metodo, cuerpo) {
  return fetch(URL_API + "/api/accion", {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo)
  }).then(function (recurso) {
    return recurso.json().then(function (data) {
      if (!recurso.ok) throw new Error(data.mensaje || "Error " + recurso.status);
      return data;
    });
  });
}

// Inicializacion de peliculas

function iniciar() {
  apiGet("/api/peliculas")
    .then(function (data) {
      peliculas = data.peliculas || [];
      inicializarFiltros(peliculas);
      inicializarSlider(peliculas);
      renderizarCatalogo();
      actualizarContadorColeccion();
      conectarEventosGlobales();
      configurarHoverTarjetas();
      configurarCierreModal();
    })
    .catch(function (err) {
      console.error(err);
      var mensaje = obtenerElemento("#mensajeError");
      mensaje.classList.remove("oculto");
      mensaje.innerHTML =
        "<strong>No se pudo cargar el catálogo.</strong><br>" +
        escaparHtml(err.message) +
        "<br>Verifica que el servidor Node esté corriendo en <code>" + URL_API + "</code>.";
      obtenerElemento("#contadorResultados").textContent = "Error";
    });
}

// Clonacion de plantilla y llenado 

function renderizarCatalogo() {
  var busqueda = obtenerElemento("#entradaBusqueda").value.trim().toLowerCase();
  var estudio = obtenerElemento("#filtroEstudio").value;
  var anio = obtenerElemento("#filtroAnio").value;
  var genero = obtenerElemento("#filtroGenero").value;
  var director = obtenerElemento("#filtroDirector").value;
  var coleccion = leerColeccion();

  var visibles = [];
  for (var i = 0; i < peliculas.length; i++) {
    var p = peliculas[i];

    if (vistaActual === "coleccion" && !coleccion[p.id]) continue;
    if (vistaActual === "coleccion" && !coleccion[p.id].enColeccion) continue;

    if (busqueda !== "") {
      var coincide =
        String(p.nombre || "").toLowerCase().indexOf(busqueda) !== -1 ||
        String(p.director || "").toLowerCase().indexOf(busqueda) !== -1 ||
        String(p.casa_productora || "").toLowerCase().indexOf(busqueda) !== -1;
      if (!coincide) continue;
    }

    if (estudio !== "" && p.casa_productora !== estudio) continue;
    if (anio !== "" && String(p.anio_lanzamiento) !== anio) continue;
    if (director !== "" && p.director !== director) continue;

    if (genero !== "") {
      var tieneGenero = false;
      var gs = p.generos || [];
      for (var k = 0; k < gs.length; k++) {
        if (gs[k] === genero) { tieneGenero = true; break; }
      }
      if (!tieneGenero) continue;
    }

    visibles.push(p);
  }

  visibles.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); });

  obtenerElemento("#tituloLista").textContent =
    vistaActual === "coleccion" ? "Mi colección" : "Todas las películas";
  obtenerElemento("#contadorResultados").textContent =
    visibles.length + " " + (visibles.length === 1 ? "película" : "películas");

  if (visibles.length > 0) {
    obtenerElemento("#mensajeVacio").classList.add("oculto");
  } else {
    obtenerElemento("#mensajeVacio").classList.remove("oculto");
  }

  var contenedor = obtenerElemento("#listaPeliculas");
  contenedor.innerHTML = "";
  var plantilla = obtenerElemento("#plantillaTarjeta");

  for (var j = 0; j < visibles.length; j++) {
    var peli = visibles[j];
    var tarjeta = plantilla.cloneNode(true);
    tarjeta.classList.remove("oculto");
    tarjeta.removeAttribute("aria-hidden");
    tarjeta.dataset.id = peli.id;

    var img = tarjeta.querySelector(".tarjeta-imagen");
    img.src = peli.imagen_url;
    img.alt = "Póster de " + peli.nombre;
    img.onerror = function () {
      this.src = "https://placehold.co/500x750/432c3b/f1a9bd?text=Sin+imagen";
    };

    tarjeta.querySelector(".overlay-anio").textContent = peli.anio_lanzamiento;
    tarjeta.querySelector(".overlay-director").textContent = peli.director;
    tarjeta.querySelector(".overlay-generos").textContent =
      (peli.generos || []).slice(0, 2).join(" · ");
    tarjeta.querySelector(".tarjeta-titulo").textContent = peli.nombre;

    var estado = coleccion[peli.id] || {};
    marcarBoton(tarjeta, "catalogo", estado.enColeccion);
    marcarBoton(tarjeta, "favorito", estado.favorito);
    marcarBoton(tarjeta, "visto", estado.visto);

    // Funcion para abrir modal
    (function (idPeli) {
      tarjeta.querySelector(".tarjeta-poster").addEventListener("click", function (evento) {
        if (evento.target.closest(".accion-icono")) return;
        abrirModal(idPeli);
      });
    })(peli.id);

    // Botones  de guardado, fav y visots
    var botones = tarjeta.querySelectorAll(".accion-icono");
    for (var b = 0; b < botones.length; b++) {
      (function (btn, idPeli) {
        btn.addEventListener("click", function (evento) {
          evento.stopPropagation();
          alternarFlag(idPeli, btn.dataset.accion);
        });
      })(botones[b], peli.id);
    }

    contenedor.appendChild(tarjeta);
  }

  // Hover
  configurarHoverTarjetas();
}

// Modal y comentarios
async function abrirModal(peliculaId) {
  var p = null;
  for (var i = 0; i < peliculas.length; i++) {
    if (peliculas[i].id === peliculaId) { p = peliculas[i]; break; }
  }
  if (!p) return;

  var coleccion = leerColeccion();
  var estado = coleccion[p.id] || {};

  // Cargar comentarios desde la api 
  var comentarios = [];
  try {
    var data = await apiGet("/api/comentarios");
    var todos = data.arreglo || [];
    for (var k = 0; k < todos.length; k++) {
      if (todos[k].peliculaId === p.id) comentarios.push(todos[k]);
    }
  } catch (err) {
    console.warn("No se pudieron cargar comentarios:", err);
  }

  var galeria = (p.galeria || []).slice(0, 3);
  var estrellas = function (n) { return "★".repeat(n) + "☆".repeat(5 - n); };

  var htmlGaleria = "";
  for (var g = 0; g < galeria.length; g++) {
    htmlGaleria += '<img src="' + escaparHtml(galeria[g]) + '" alt="Imagen de ' + escaparHtml(p.nombre) + '">';
  }

  var htmlGeneros = "";
  var gen = p.generos || [];
  for (var h = 0; h < gen.length; h++) {
    htmlGeneros += '<span class="etiqueta">' + escaparHtml(gen[h]) + "</span>";
  }

  var htmlComentarios = "";
  if (comentarios.length === 0) {
    htmlComentarios = '<p class="mensaje">Aún no hay comentarios.</p>';
  } else {
    for (var c = 0; c < comentarios.length; c++) {
      var com = comentarios[c];
      htmlComentarios +=
        '<div class="comentario" data-id="' + com.id + '">' +
          '<div class="comentario-cabecera">' +
            '<span class="comentario-usuario">' + escaparHtml(com.usuario) + "</span>" +
            '<span class="comentario-estrellas">' + estrellas(com.calificacion) + "</span>" +
          "</div>" +
          '<p class="comentario-texto">' + escaparHtml(com.texto) + "</p>" +
          '<div class="comentario-acciones">' +
            '<button class="me-gusta" data-accion="like"><i class="fa-regular fa-heart"></i> ' + (com.likes || 0) + "</button>" +
            '<button data-accion="editar"><i class="fa-solid fa-pen"></i> Editar</button>' +
            '<button data-accion="eliminar"><i class="fa-solid fa-trash"></i> Eliminar</button>' +
          "</div>" +
        "</div>";
    }
  }

  obtenerElemento("#contenidoModal").innerHTML =
    '<div class="modal-layout">' +
      '<div class="modal-poster">' +
        '<img src="' + escaparHtml(p.imagen_url) + '" alt="Póster de ' + escaparHtml(p.nombre) + '">' +
        '<div class="modal-galeria">' + htmlGaleria + "</div>" +
      "</div>" +
      '<div class="modal-info">' +
        "<h2>" + escaparHtml(p.nombre) + "</h2>" +
        '<p class="meta">' +
          escaparHtml(p.director) + " · " + escaparHtml(p.anio_lanzamiento) + " · " +
          escaparHtml(p.duracion) + " min · " + escaparHtml(p.casa_productora) +
        "</p>" +
        '<p class="sinopsis">' + escaparHtml(p.descripcion) + "</p>" +
        '<div class="etiquetas">' + htmlGeneros + "</div>" +
        '<div class="modal-acciones">' +
          '<button class="accion-icono ' + (estado.enColeccion ? "activa" : "") + '" data-accion="catalogo"><i class="fa-' + (estado.enColeccion ? "solid" : "regular") + ' fa-bookmark"></i></button>' +
          '<button class="accion-icono ' + (estado.favorito ? "activa" : "") + '" data-accion="favorito"><i class="fa-' + (estado.favorito ? "solid" : "regular") + ' fa-heart"></i></button>' +
          '<button class="accion-icono ' + (estado.visto ? "activa" : "") + '" data-accion="visto"><i class="fa-' + (estado.visto ? "solid" : "regular") + ' fa-eye"></i></button>' +
        "</div>" +
        '<section class="seccion-comentarios">' +
          "<h3>Comentarios</h3>" +
          '<div id="listaComentarios">' + htmlComentarios + "</div>" +
          '<form class="formulario-comentario" id="formComentario">' +
            '<input id="comUsuario" placeholder="Tu nombre o alias" maxlength="40" required>' +
            '<select id="comCalificacion">' +
              '<option value="5">5 estrellas</option><option value="4">4 estrellas</option>' +
              '<option value="3">3 estrellas</option><option value="2">2 estrellas</option>' +
              '<option value="1">1 estrella</option>' +
            "</select>" +
            '<textarea id="comTexto" placeholder="Escribe tu comentario..." maxlength="500" required></textarea>' +
            '<button type="submit">Publicar comentario</button>' +
          "</form>" +
        "</section>" +
      "</div>" +
    "</div>";

  var botonesModal = obtenerElemento("#contenidoModal").querySelectorAll(".modal-acciones .accion-icono");
  for (var m = 0; m < botonesModal.length; m++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        alternarFlag(p.id, btn.dataset.accion);
        abrirModal(p.id);
      });
    })(botonesModal[m]);
  }

  // Agregar comentario
  obtenerElemento("#formComentario").addEventListener("submit", function (evento) {
    evento.preventDefault();
    apiEnviar("POST", {
      accion: "crearComentario",
      peliculaId: p.id,
      usuario: obtenerElemento("#comUsuario").value.trim(),
      texto: obtenerElemento("#comTexto").value.trim(),
      calificacion: Number(obtenerElemento("#comCalificacion").value)
    })
      .then(function () { abrirModal(p.id); })
      .catch(function (err) { alert("Error al publicar: " + err.message); });
  });

  // Acciones sobre comentarios (darle like, editarlo o eliminarlo)
  obtenerElemento("#listaComentarios").addEventListener("click", function (evento) {
    var btn = evento.target.closest("button[data-accion]");
    if (!btn) return;
    var idComentario = Number(btn.closest(".comentario").dataset.id);
    var accion = btn.dataset.accion;

    if (accion === "like") {
      apiEnviar("PUT", { accion: "darLike", id: idComentario })
        .then(function () { abrirModal(p.id); })
        .catch(function (err) { alert("Error: " + err.message); });
    } else if (accion === "eliminar") {
      if (!confirm("¿Eliminar este comentario?")) return;
      apiEnviar("DELETE", { accion: "eliminarComentario", id: idComentario })
        .then(function () { abrirModal(p.id); })
        .catch(function (err) { alert("Error: " + err.message); });
    } else if (accion === "editar") {
      var nuevo = prompt("Edita tu comentario:");
      if (nuevo === null) return;
      var nuevaCal = prompt("Nueva calificación (1-5):", "5");
      apiEnviar("PUT", {
        accion: "editarComentario",
        id: idComentario,
        texto: nuevo,
        calificacion: Number(nuevaCal) || 5
      })
        .then(function () { abrirModal(p.id); })
        .catch(function (err) { alert("Error: " + err.message); });
    }
  });

  mostrarModal(); 
}

//Inciar  
iniciar();