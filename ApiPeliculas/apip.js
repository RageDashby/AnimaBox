// ============================================================
// apip.js — Servidor Node.js nativo para AnimaBox
// Maneja GET, POST, PUT, DELETE multifuncional vía "accion"
// ============================================================
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PUERTO = 3000;

// Rutas absolutas a los JSON (evita problemas de cwd)
const RUTA_PELICULAS = path.join(__dirname, "Peliculas.json");
const RUTA_COMENTARIOS = path.join(__dirname, "Comentarios.json");

// ---- Utilidades ----
// Lee un JSON del disco de forma síncrona y segura
function leerJson(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8"));
  } catch (err) {
    console.error("Error leyendo", ruta, err.message);
    return null;
  }
}

// Escribe un JSON en disco (sobrescribe)
function escribirJson(ruta, datos) {
  return new Promise((resolve, reject) => {
    fs.writeFile(ruta, JSON.stringify(datos, null, 2), "utf8", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Responde JSON con el código indicado
function responderJson(response, codigo, objeto) {
  response.statusCode = codigo;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(objeto));
}

// Acumula el body de la request y devuelve el objeto parseado
function leerBody(request) {
  return new Promise((resolve, reject) => {
    let info = "";
    request.on("data", (chunk) => { info += chunk; });
    request.on("end", () => {
      try { resolve(info ? JSON.parse(info) : {}); }
      catch (err) { reject(err); }
    });
    request.on("error", reject);
  });
}

// ---- Servidor ----
const servidor = http.createServer(async (request, response) => {
  // CORS abierto (igual que en clase)
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    return response.end();
  }

  try {
    // ========================================================
    // GET — devuelve películas o comentarios según la ruta
    // ========================================================
    if (request.method === "GET") {
      const url = new URL(request.url, `http://localhost:${PUERTO}`);

      if (url.pathname === "/api/peliculas") {
        const peliculas = leerJson(RUTA_PELICULAS);
        return responderJson(response, 200, peliculas);
      }

      if (url.pathname === "/api/comentarios") {
        const comentarios = leerJson(RUTA_COMENTARIOS);
        return responderJson(response, 200, comentarios);
      }

      return responderJson(response, 404, { mensaje: "Ruta no encontrada" });
    }

    // ========================================================
    // POST — multifuncional según "accion"
    //   accion: "crearComentario"
    // ========================================================
    if (request.method === "POST") {
      const body = await leerBody(request);

      if (body.accion === "crearComentario") {
        const comentarios = leerJson(RUTA_COMENTARIOS) || { arreglo: [] };
        const nuevoId = comentarios.arreglo.length
          ? Math.max(...comentarios.arreglo.map(c => c.id)) + 1
          : 1;

        const nuevoComentario = {
          id: nuevoId,
          peliculaId: Number(body.peliculaId),
          usuario: String(body.usuario || "Invitado").trim().slice(0, 40),
          texto: String(body.texto || "").trim().slice(0, 500),
          calificacion: Number(body.calificacion) || 0,
          likes: 0
        };

        comentarios.arreglo.push(nuevoComentario);
        await escribirJson(RUTA_COMENTARIOS, comentarios);
        return responderJson(response, 201, { mensaje: "Comentario creado", comentario: nuevoComentario });
      }

      return responderJson(response, 400, { mensaje: "Acción POST no reconocida" });
    }

    // ========================================================
    // PUT — multifuncional según "accion"
    //   accion: "editarComentario" | "darLike"
    // ========================================================
    if (request.method === "PUT") {
      const body = await leerBody(request);
      const comentarios = leerJson(RUTA_COMENTARIOS) || { arreglo: [] };

      if (body.accion === "editarComentario") {
        const idx = comentarios.arreglo.findIndex(c => c.id === Number(body.id));
        if (idx === -1) return responderJson(response, 404, { mensaje: "Comentario no encontrado" });

        comentarios.arreglo[idx].texto = String(body.texto || "").trim().slice(0, 500);
        comentarios.arreglo[idx].calificacion = Number(body.calificacion) || 0;
        await escribirJson(RUTA_COMENTARIOS, comentarios);
        return responderJson(response, 200, { mensaje: "Comentario editado", comentario: comentarios.arreglo[idx] });
      }

      if (body.accion === "darLike") {
        const idx = comentarios.arreglo.findIndex(c => c.id === Number(body.id));
        if (idx === -1) return responderJson(response, 404, { mensaje: "Comentario no encontrado" });

        comentarios.arreglo[idx].likes = (comentarios.arreglo[idx].likes || 0) + 1;
        await escribirJson(RUTA_COMENTARIOS, comentarios);
        return responderJson(response, 200, { mensaje: "Like registrado", likes: comentarios.arreglo[idx].likes });
      }

      return responderJson(response, 400, { mensaje: "Acción PUT no reconocida" });
    }

    // ========================================================
    // DELETE — multifuncional según "accion"
    //   accion: "eliminarComentario"
    // ========================================================
    if (request.method === "DELETE") {
      const body = await leerBody(request);
      const comentarios = leerJson(RUTA_COMENTARIOS) || { arreglo: [] };

      if (body.accion === "eliminarComentario") {
        const idx = comentarios.arreglo.findIndex(c => c.id === Number(body.id));
        if (idx === -1) return responderJson(response, 404, { mensaje: "Comentario no encontrado" });

        comentarios.arreglo.splice(idx, 1);
        await escribirJson(RUTA_COMENTARIOS, comentarios);
        return responderJson(response, 200, { mensaje: "Comentario eliminado" });
      }

      return responderJson(response, 400, { mensaje: "Acción DELETE no reconocida" });
    }

    responderJson(response, 405, { mensaje: "Método no permitido" });
  } catch (err) {
    console.error("Error en servidor:", err);
    responderJson(response, 500, { mensaje: "Error interno del servidor", detalle: err.message });
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Servidor AnimaBox escuchando en http://localhost:${PUERTO}`);
  console.log(`  GET    /api/peliculas`);
  console.log(`  GET    /api/comentarios`);
  console.log(`  POST   /api/accion  (accion: crearComentario)`);
  console.log(`  PUT    /api/accion  (accion: editarComentario | darLike)`);
  console.log(`  DELETE /api/accion  (accion: eliminarComentario)`);
});