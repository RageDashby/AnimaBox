// ============================================================
// script.js — Fase 1 y 2 integradas (Lógica de la API y UI)
// ============================================================

var URL_API = "http://localhost:3000";
var peliculas = [];
var calificacionSeleccionada = 0;
var imagenesCarrusel = [];
var indiceCarrusel = 0;

function apiGet(ruta) {
  return fetch(URL_API + ruta).then(function (recurso) {
    if (!recurso.ok) throw new Error("GET " + ruta + " → " + recurso.status);
    return recurso.json();
  });
}

function apiEnviar(metodo, cuerpo) {
  return fetch(URL_API + "/api/accion", {
    method: metodo, headers: { "Content-Type": "application/json", "Authorization": tokenSesion || "" },
    body: JSON.stringify(cuerpo)
  }).then(function (recurso) {
    return recurso.json().then(function (data) {
      if (!recurso.ok) throw new Error(data.mensaje || "Error " + recurso.status);
      return data;
    });
  });
}

function iniciar() {
  apiGet("/api/peliculas")
    .then(function (data) {
      peliculas = data.peliculas || [];
      inicializarFiltros(peliculas);
      inicializarSlider(peliculas);
      actualizarUIUsuario();
      vigilarExpiracionToken(); 
      configurarEventosAuth();
      conectarEventosGlobales();
      configurarCierreModal();
      
      if (tokenSesion) {
          cargarColeccionDesdeBD(); 
      } else {
          renderizarCatalogo();
      }
    })
    .catch(function (err) {
      console.error(err);
      var mensaje = obtenerElemento("#mensajeError");
      if(mensaje) { mensaje.classList.remove("oculto"); mensaje.innerHTML = "<strong>No se pudo cargar el catálogo.</strong><br>" + escaparHtml(err.message); }
    });
}

function renderizarCatalogo() {
  var busqueda = obtenerElemento("#entradaBusqueda").value.trim().toLowerCase();
  var estudio = obtenerElemento("#filtroEstudio").value;
  var anio = obtenerElemento("#filtroAnio").value;
  var genero = obtenerElemento("#filtroGenero").value;
  var director = obtenerElemento("#filtroDirector").value;

  var visibles = [];
  for (var i = 0; i < peliculas.length; i++) {
    var p = peliculas[i];
    var enCol = coleccionLocal[p.id] || { enColeccion: false, favorito: false, visto: false };

    if (vistaActual === "coleccion") {
        if (!enCol.enColeccion) continue;
        if (filtroColeccion === "favoritos" && !enCol.favorito) continue;
        if (filtroColeccion === "vistos" && !enCol.visto) continue;
    }

    if (busqueda !== "") {
      var coincide = String(p.nombre || "").toLowerCase().indexOf(busqueda) !== -1 || String(p.director || "").toLowerCase().indexOf(busqueda) !== -1 || String(p.casa_productora || "").toLowerCase().indexOf(busqueda) !== -1;
      if (!coincide) continue;
    }
    if (estudio !== "" && p.casa_productora !== estudio) continue;
    if (anio !== "" && String(p.anio_lanzamiento) !== anio) continue;
    if (director !== "" && p.director !== director) continue;
    if (genero !== "") {
      var tieneGenero = false; var gs = p.generos || [];
      for (var k = 0; k < gs.length; k++) { if (gs[k] === genero) { tieneGenero = true; break; } }
      if (!tieneGenero) continue;
    }
    visibles.push(p);
  }

  visibles.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); });

  obtenerElemento("#tituloLista").textContent = vistaActual === "coleccion" ? "" : "Todas las películas";
  obtenerElemento("#contadorResultados").textContent = visibles.length + " " + (visibles.length === 1 ? "película" : "películas");

  if (visibles.length > 0) obtenerElemento("#mensajeVacio").classList.add("oculto");
  else obtenerElemento("#mensajeVacio").classList.remove("oculto");

  var contenedor = obtenerElemento("#listaPeliculas");
  contenedor.innerHTML = "";
  var plantilla = obtenerElemento("#plantillaTarjeta");

  for (var j = 0; j < visibles.length; j++) {
    var peli = visibles[j];
    var tarjeta = plantilla.cloneNode(true);
    tarjeta.classList.remove("oculto"); tarjeta.removeAttribute("aria-hidden"); tarjeta.dataset.id = peli.id;

    var img = tarjeta.querySelector(".tarjeta-imagen");
    img.src = peli.imagen_url; img.alt = "Póster de " + peli.nombre;
    img.onerror = function () { this.src = "https://placehold.co/500x750/432c3b/f1a9bd?text=Sin+imagen"; };

    tarjeta.querySelector(".overlay-anio").textContent = peli.anio_lanzamiento;
    tarjeta.querySelector(".overlay-director").textContent = peli.director;
    tarjeta.querySelector(".overlay-generos").textContent = (peli.generos || []).slice(0, 2).join(" · ");
    tarjeta.querySelector(".tarjeta-titulo").textContent = peli.nombre;

    var estado = coleccionLocal[peli.id] || {};
    marcarBoton(tarjeta, "catalogo", estado.enColeccion);
    marcarBoton(tarjeta, "favorito", estado.favorito);
    marcarBoton(tarjeta, "visto", estado.visto);

    (function (idPeli) {
      tarjeta.querySelector(".tarjeta-poster").addEventListener("click", function (evento) {
        if (evento.target.closest(".accion-icono")) return;
        abrirModal(idPeli);
      });
    })(peli.id);

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
  configurarHoverTarjetas();
}

async function abrirModal(peliculaId) {
  var p = null;
  for (var i = 0; i < peliculas.length; i++) { if (peliculas[i].id === peliculaId) { p = peliculas[i]; break; } }
  if (!p) return;

  var estado = coleccionLocal[p.id] || {};
  var comentarios = [];
  try {
    var data = await apiGet("/api/comentarios");
    var todos = data.arreglo || [];
    for (var k = 0; k < todos.length; k++) { if (todos[k].peliculaId === p.id) comentarios.push(todos[k]); }
  } catch (err) { console.warn(err); }

  var miComentario = null;
  if (usuarioActual) {
      for(var c = 0; c < comentarios.length; c++) {
          if(comentarios[c].usuario === usuarioActual) { miComentario = comentarios[c]; break; }
      }
  }

  var galeriaCompleta = [p.imagen_url].concat(p.galeria || []);
  var htmlGaleria = "";
  for (var g = 0; g < galeriaCompleta.length; g++) {
    htmlGaleria += '<img src="' + escaparHtml(galeriaCompleta[g]) + '" class="img-galeria" data-index="' + g + '" alt="Imagen" style="cursor:pointer">';
  }

  var htmlComentarios = "";
  for (var c = 0; c < comentarios.length; c++) {
      var com = comentarios[c];
      var estrellasStr = "★".repeat(com.calificacion) + "☆".repeat(5 - com.calificacion);
      htmlComentarios += 
        '<div class="comentario" data-id="' + com.id + '">' +
          '<div class="comentario-cabecera"><span class="comentario-usuario">' + escaparHtml(com.usuario) + '</span><span class="comentario-estrellas">' + estrellasStr + '</span></div>' +
          '<p class="comentario-texto">' + escaparHtml(com.texto) + '</p>' +
        '</div>';
  }
  if(comentarios.length === 0) htmlComentarios = '<p class="mensaje">Aún no hay comentarios.</p>';

  var htmlTuResena = "";
  if (usuarioActual) {
      if (miComentario) {
          var tusEstrellas = "★".repeat(miComentario.calificacion) + "☆".repeat(5 - miComentario.calificacion);
          htmlTuResena = 
            '<div class="tu-resena" style="background: rgba(241,169,189,0.1); padding: 15px; border-radius: 8px; margin-top:15px;">' +
                '<div id="resenaActual">' +
                    '<h4 style="margin-bottom:5px;">Tu reseña (' + tusEstrellas + ')</h4>' +
                    '<p id="textoMiResena">' + escaparHtml(miComentario.texto) + '</p>' +
                    '<div class="acciones-resena">' +
                        '<button id="btnEditarMiResena" class="btn-resena" type="button">Editar</button>' +
                        '<button id="btnBorrarMiResena" class="btn-resena btn-eliminar" type="button">Eliminar</button>' +
                    '</div>' +
                '</div>' +
                '<div id="formEditarResena" class="form-editar-resena oculto">' +
                    '<label for="inputEditarResena">Editar tu reseña</label>' +
                    '<textarea id="inputEditarResena"></textarea>' +
                    '<div class="acciones-resena">' +
                        '<button id="btnGuardarResena" class="btn-resena" type="button">Guardar cambios</button>' +
                        '<button id="btnCancelarEditarResena" class="btn-resena btn-cancelar" type="button">Cancelar</button>' +
                    '</div>' +
                '</div>' +
                '<div id="confirmarBorrarResena" class="confirmar-borrar-resena oculto">' +
                    '<p>¿Eliminar esta reseña? Esta acción no se puede deshacer.</p>' +
                    '<div class="acciones-resena">' +
                        '<button id="btnConfirmarBorrarResena" class="btn-resena btn-eliminar" type="button">Eliminar reseña</button>' +
                        '<button id="btnCancelarBorrarResena" class="btn-resena btn-cancelar" type="button">Cancelar</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
      } else {
          htmlTuResena = 
            '<div class="form-tu-resena" style="margin-top:15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top:15px;">' +
                '<h4>Deja tu reseña</h4>' +
                '<div class="estrellas-interactivas" id="estrellasInput">' +
                    '<i class="fa-solid fa-star estrella" data-valor="1"></i><i class="fa-solid fa-star estrella" data-valor="2"></i><i class="fa-solid fa-star estrella" data-valor="3"></i><i class="fa-solid fa-star estrella" data-valor="4"></i><i class="fa-solid fa-star estrella" data-valor="5"></i>' +
                '</div>' +
                '<textarea id="inputMiResena" placeholder="Escribe tu opinión..." style="width:100%; height:80px; margin-bottom:10px; background:#523447; color:white; border:1px solid #7a2e3f; border-radius:6px; padding:10px;"></textarea>' +
                '<button id="btnPublicarResena" class="btn-resena">Publicar Reseña</button>' +
            '</div>';
      }
  } else {
      htmlTuResena = '<p class="mensaje" style="margin-top:15px;">Inicia sesión para dejar una reseña.</p>';
  }

  obtenerElemento("#contenidoModal").innerHTML =
    '<div class="modal-layout">' +
      '<div class="modal-poster">' +
        '<img src="' + escaparHtml(p.imagen_url) + '" alt="Póster" id="posterPrincipal">' +
        '<div class="modal-galeria">' + htmlGaleria + '</div>' +
      '</div>' +
      '<div class="modal-info">' +
        '<h2>' + escaparHtml(p.nombre) + '</h2>' +
        '<p class="meta">' + escaparHtml(p.director) + " · " + escaparHtml(p.anio_lanzamiento) + " · " + escaparHtml(p.duracion) + " min · " + escaparHtml(p.casa_productora) + '</p>' +
        '<p class="sinopsis">' + escaparHtml(p.descripcion) + '</p>' +
        '<div class="etiquetas">' + (p.generos || []).map(g => '<span class="etiqueta">' + escaparHtml(g) + '</span>').join("") + '</div>' +
        '<div class="modal-acciones">' +
          '<button class="accion-icono ' + (estado.enColeccion ? "activa" : "") + '" data-accion="catalogo"><i class="fa-' + (estado.enColeccion ? "solid" : "regular") + ' fa-bookmark"></i></button>' +
          '<button class="accion-icono ' + (estado.favorito ? "activa" : "") + '" data-accion="favorito"><i class="fa-' + (estado.favorito ? "solid" : "regular") + ' fa-heart"></i></button>' +
          '<button class="accion-icono ' + (estado.visto ? "activa" : "") + '" data-accion="visto"><i class="fa-' + (estado.visto ? "solid" : "regular") + ' fa-eye"></i></button>' +
        '</div>' +
        '<section class="seccion-comentarios">' +
          '<h3>Comentarios de la comunidad</h3>' +
          '<div id="listaComentarios">' + htmlComentarios + '</div>' +
          htmlTuResena +
        '</section>' +
      '</div>' +
    '</div>'
    +
    '<div id="pantallaCompletaCarrusel" class="carrusel-full oculto">'+
        '<button id="cerrarCarrusel" class="cerrar-modal">'+'<i class="fa-solid fa-xmark">'+'</i>'+'</button>'+
       '<button id="flechaCarruselIzq" class="flecha-full">'+'<i class="fa-solid fa-chevron-left">'+'</i>'+'</button>'+
        '<img id="imgCarruselFull" src="" alt="Imagen completa">'+
        '<button id="flechaCarruselDer" class="flecha-full">'+'<i class="fa-solid fa-chevron-right">'+'</i>'+'</button>'+
    '</div>'
;

  var imgsGaleria = document.querySelectorAll(".img-galeria");
  for (var iImg = 0; iImg < imgsGaleria.length; iImg++) {
      imgsGaleria[iImg].addEventListener("click", function() {
          abrirCarrusel(galeriaCompleta, parseInt(this.dataset.index));
      });
  }
  var posterPrincipal = document.getElementById("posterPrincipal");
  if(posterPrincipal) {
      posterPrincipal.style.cursor = "pointer";
      posterPrincipal.addEventListener("click", function() { abrirCarrusel(galeriaCompleta, 0); });
  }

  var botonesModal = obtenerElemento("#contenidoModal").querySelectorAll(".modal-acciones .accion-icono");
  for (var m = 0; m < botonesModal.length; m++) {
    (function (btn) {
      btn.addEventListener("click", function () { alternarFlag(p.id, btn.dataset.accion); abrirModal(p.id); });
    })(botonesModal[m]);
  }

  if (usuarioActual && !miComentario) {
      var estrellas = document.querySelectorAll("#estrellasInput .estrella");
      calificacionSeleccionada = 0;
      
      for (var e = 0; e < estrellas.length; e++) {
          estrellas[e].addEventListener("mouseover", function() {
              var valor = parseInt(this.dataset.valor);
              for (var k = 0; k < estrellas.length; k++) {
                  if (k < valor) estrellas[k].classList.add("activa");
                  else estrellas[k].classList.remove("activa");
              }
          });
          estrellas[e].addEventListener("mouseleave", function() {
              for (var k = 0; k < estrellas.length; k++) {
                  if (k < calificacionSeleccionada) estrellas[k].classList.add("activa");
                  else estrellas[k].classList.remove("activa");
              }
          });
          estrellas[e].addEventListener("click", function() {
              calificacionSeleccionada = parseInt(this.dataset.valor);
          });
      }

      document.getElementById("btnPublicarResena").addEventListener("click", function() {
          if(calificacionSeleccionada === 0) return mostrarAlerta("Selecciona al menos 1 estrella", "error");
          var texto = document.getElementById("inputMiResena").value.trim();
          if(!texto) return mostrarAlerta("Escribe una reseña", "error");
          
          apiEnviar("POST", { accion: "crearComentario", peliculaId: p.id, usuario: usuarioActual, texto: texto, calificacion: calificacionSeleccionada })
            .then(function() { abrirModal(p.id); }).catch(function(err) { mostrarAlerta(err.message, "error"); });
      });
  } else if (miComentario) {
      var inputEditarResena = document.getElementById("inputEditarResena");
      inputEditarResena.value = miComentario.texto;
      document.getElementById("btnEditarMiResena").addEventListener("click", function() {
          document.getElementById("resenaActual").classList.add("oculto");
          document.getElementById("formEditarResena").classList.remove("oculto");
          inputEditarResena.focus();
      });
      document.getElementById("btnCancelarEditarResena").addEventListener("click", function() {
          inputEditarResena.value = miComentario.texto;
          document.getElementById("formEditarResena").classList.add("oculto");
          document.getElementById("resenaActual").classList.remove("oculto");
      });
      document.getElementById("btnGuardarResena").addEventListener("click", function() {
          var nuevoTexto = inputEditarResena.value.trim();
          if (!nuevoTexto) return mostrarAlerta("Escribe una reseña", "error");
          apiEnviar("PUT", { accion: "editarComentario", id: miComentario.id, texto: nuevoTexto, calificacion: miComentario.calificacion })
            .then(function() { abrirModal(p.id); }).catch(function(err) { mostrarAlerta(err.message, "error"); });
      });
      document.getElementById("btnBorrarMiResena").addEventListener("click", function() {
          document.getElementById("resenaActual").classList.add("oculto");
          document.getElementById("confirmarBorrarResena").classList.remove("oculto");
      });
      document.getElementById("btnCancelarBorrarResena").addEventListener("click", function() {
          document.getElementById("confirmarBorrarResena").classList.add("oculto");
          document.getElementById("resenaActual").classList.remove("oculto");
      });
      document.getElementById("btnConfirmarBorrarResena").addEventListener("click", function() {
          apiEnviar("DELETE", { accion: "eliminarComentario", id: miComentario.id })
            .then(function() { abrirModal(p.id); }).catch(function(err) { mostrarAlerta(err.message, "error"); });
      });
  }

  mostrarModal();
}

function abrirCarrusel(imagenes, index) {
    imagenesCarrusel = imagenes;
    indiceCarrusel = index;
    document.getElementById("imgCarruselFull").src = imagenesCarrusel[indiceCarrusel];
    document.getElementById("pantallaCompletaCarrusel").classList.remove("oculto");
    
    document.getElementById("cerrarCarrusel").onclick = function() { document.getElementById("pantallaCompletaCarrusel").classList.add("oculto"); };
    document.getElementById("flechaCarruselDer").onclick = function() { 
        indiceCarrusel = (indiceCarrusel + 1) % imagenesCarrusel.length; 
        document.getElementById("imgCarruselFull").src = imagenesCarrusel[indiceCarrusel]; 
    };
    document.getElementById("flechaCarruselIzq").onclick = function() { 
        indiceCarrusel = (indiceCarrusel - 1 + imagenesCarrusel.length) % imagenesCarrusel.length; 
        document.getElementById("imgCarruselFull").src = imagenesCarrusel[indiceCarrusel]; 
    };
}

iniciar();