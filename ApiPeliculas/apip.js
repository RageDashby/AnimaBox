const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const puerto = 3000;

// Rutas
const RUTA_PELICULAS = path.join(__dirname, "Peliculas.json");
const RUTA_COMENTARIOS = path.join(__dirname, "Comentarios.json");


function leerJson(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8"));
  } catch (err) {
    console.log("Error leyendo " + ruta + ": " + err.message);
    return null;
  }
}

function responderJson(response, codigo, objeto) {
  response.statusCode = codigo;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(objeto));
}

// Server
const servidor = http.createServer((request, response) => {

  // Reglas CORS 
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  switch (request.method) { 

    // GET — devuelve películas o comentarios según la ruta
  
    case "GET": {
      var url = new URL(request.url, "http://localhost:" + puerto);

      if (url.pathname === "/api/peliculas") {
        var peliculas = leerJson(RUTA_PELICULAS);
        if (peliculas === null) {
          return responderJson(response, 500, { mensaje: "Error leyendo Peliculas.json" });
        }
        return responderJson(response, 200, peliculas);
      }

      if (url.pathname === "/api/comentarios") {
        var comentarios = leerJson(RUTA_COMENTARIOS);
        if (comentarios === null) {
          return responderJson(response, 500, { mensaje: "Error leyendo Comentarios.json" });
        }
        return responderJson(response, 200, comentarios);
      }

      return responderJson(response, 404, { mensaje: "Ruta no encontrada" });
    }

    // POST
    case "POST": {
      var informacion = "";
      request.on("data", info => {
        informacion += info;
      });
      request.on("end", () => {

        var body;
        try {
          body = JSON.parse(informacion);
        } catch (err) {
          return responderJson(response, 400, { mensaje: "JSON inválido en el body" });
        }

        if (body.accion === "crearComentario") {

          var comentarios = leerJson(RUTA_COMENTARIOS);
          if (comentarios === null) {
            comentarios = { arreglo: [] };
          }

          var nuevoId = 1;
          if (comentarios.arreglo.length > 0) {
            var maxId = 0;
            for (var i = 0; i < comentarios.arreglo.length; i++) {
              if (comentarios.arreglo[i].id > maxId) {
                maxId = comentarios.arreglo[i].id;
              }
            }
            nuevoId = maxId + 1;
          }

          var nuevoComentario = {
            id: nuevoId,
            peliculaId: Number(body.peliculaId),
            usuario: String(body.usuario || "Invitado").trim().slice(0, 40),
            texto: String(body.texto || "").trim().slice(0, 500),
            calificacion: Number(body.calificacion) || 0,
            likes: 0
          };

          comentarios.arreglo.push(nuevoComentario);

          fs.writeFile(RUTA_COMENTARIOS, JSON.stringify(comentarios, null, 2), err => {
            if (err) {
              console.log(err);
              return responderJson(response, 500, { mensaje: "Error guardando comentario" });
            }
            return responderJson(response, 201, {
              mensaje: "Comentario creado",
              comentario: nuevoComentario
            });
          });

        } else {
          return responderJson(response, 400, { mensaje: "Acción POST no reconocida" });
        }
      });
      break;
    }

    // PUT
    case "PUT": {
      var informacion = "";
      request.on("data", info => {
        informacion += info;
      });
      request.on("end", () => {

        var body;
        try {
          body = JSON.parse(informacion);
        } catch (err) {
          return responderJson(response, 400, { mensaje: "JSON inválido en el body" });
        }

        var comentarios = leerJson(RUTA_COMENTARIOS);
        if (comentarios === null) {
          comentarios = { arreglo: [] };
        }

        // PUT Editar Comentario
        if (body.accion === "editarComentario") {

          var indiceEncontrado = -1;
          for (var i = 0; i < comentarios.arreglo.length; i++) {
            if (comentarios.arreglo[i].id == body.id) {
              indiceEncontrado = i;
              break;
            }
          }

          if (indiceEncontrado === -1) {
            return responderJson(response, 404, { mensaje: "Comentario no encontrado" });
          }

          comentarios.arreglo[indiceEncontrado].texto = String(body.texto || "").trim().slice(0, 500);
          comentarios.arreglo[indiceEncontrado].calificacion = Number(body.calificacion) || 0;

          fs.writeFile(RUTA_COMENTARIOS, JSON.stringify(comentarios, null, 2), err => {
            if (err) {
              console.log(err);
              return responderJson(response, 500, { mensaje: "Error guardando comentario" });
            }
            return responderJson(response, 200, {
              mensaje: "Comentario editado",
              comentario: comentarios.arreglo[indiceEncontrado]
            });
          });

        // PUT darLike
        } else if (body.accion === "darLike") {

          var indiceEncontrado = -1;
          for (var i = 0; i < comentarios.arreglo.length; i++) {
            if (comentarios.arreglo[i].id == body.id) {
              indiceEncontrado = i;
              break;
            }
          }

          if (indiceEncontrado === -1) {
            return responderJson(response, 404, { mensaje: "Comentario no encontrado" });
          }

          if (!comentarios.arreglo[indiceEncontrado].likes) {
            comentarios.arreglo[indiceEncontrado].likes = 0;
          }
          comentarios.arreglo[indiceEncontrado].likes = comentarios.arreglo[indiceEncontrado].likes + 1;

          fs.writeFile(RUTA_COMENTARIOS, JSON.stringify(comentarios, null, 2), err => {
            if (err) {
              console.log(err);
              return responderJson(response, 500, { mensaje: "Error guardando like" });
            }
            return responderJson(response, 200, {
              mensaje: "Like registrado",
              likes: comentarios.arreglo[indiceEncontrado].likes
            });
          });

        } else {
          return responderJson(response, 400, { mensaje: "Acción PUT no reconocida" });
        }
      });
      break;
    }

    // DELETE: Eliminar comentario
    case "DELETE": {
      var informacion = "";
      request.on("data", info => {
        informacion += info;
      });
      request.on("end", () => {

        var body;
        try {
          body = JSON.parse(informacion);
        } catch (err) {
          return responderJson(response, 400, { mensaje: "JSON inválido en el body" });
        }

        if (body.accion === "eliminarComentario") {

          var comentarios = leerJson(RUTA_COMENTARIOS);
          if (comentarios === null) {
            comentarios = { arreglo: [] };
          }

          var indiceEncontrado = -1;
          for (var i = 0; i < comentarios.arreglo.length; i++) {
            if (comentarios.arreglo[i].id == body.id) {
              indiceEncontrado = i;
              break;
            }
          }

          if (indiceEncontrado === -1) {
            return responderJson(response, 404, { mensaje: "Comentario no encontrado" });
          }

          comentarios.arreglo.splice(indiceEncontrado, 1);

          fs.writeFile(RUTA_COMENTARIOS, JSON.stringify(comentarios, null, 2), err => {
            if (err) {
              console.log(err);
              return responderJson(response, 500, { mensaje: "Error eliminando comentario" });
            }
            return responderJson(response, 200, { mensaje: "Comentario eliminado" });
          });

        } else {
          return responderJson(response, 400, { mensaje: "Acción DELETE no reconocida" });
        }
      });
      break;
    }

    case "OPTIONS": {
      response.writeHead(204);
      response.end();
      break;
    }

    // Cualqueir otro metodo
    default: {
      responderJson(response, 405, { mensaje: "Método no permitido" });
    }
  }
});

servidor.listen(puerto, () => {
  console.log("Servidor AnimaBox a la escucha en http://localhost:" + puerto);
 
});