// ============================================================
// apip.js — Servidor AnimaBox Fase 2 (Híbrido: JSON + MySQL)
// ============================================================
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const basesdatos = require("mysql");
const jwt = require("jsonwebtoken");

// 🚨 ATENCIÓN: CAMBIAR EL TIEMPO DEL TOKEN A "1h" o "1d" PARA LA ENTREGA FINAL 🚨
const TIEMPO_TOKEN = "30s"; 

const llave = "HJDJHjdkjHJSjHJJKDXKJhjdjszhukmxdhjHJKhdiJHjhHhjHJb";
const puerto = 3000;

const RUTA_PELICULAS = path.join(__dirname, "Peliculas.json");
const RUTA_COMENTARIOS = path.join(__dirname, "Comentarios.json");

function leerJson(ruta) {
  try { return JSON.parse(fs.readFileSync(ruta, "utf8")); } catch { return null; }
}
function responderJson(response, codigo, objeto) {
  response.statusCode = codigo;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(objeto));
}

const server = http.createServer((request, response) => {
    // CORS
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "*");

    if (request.method === "OPTIONS") {
        response.writeHead(204);
        return response.end();
    }

    const mysql = basesdatos.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "BD_animabox"
    });

    const token = request.headers.authorization;

    function verificarToken(callback) {
        if (!token || token === "null") return callback(null, null);
        jwt.verify(token, llave, (err, decoded) => {
            if (err) return callback(err, null);
            callback(null, decoded);
        });
    }

    switch (request.method) {
        case "GET":
            switch (request.url) {
                case "/api/peliculas":
                    responderJson(response, 200, leerJson(RUTA_PELICULAS));
                    mysql.end();
                    break;
                case "/api/comentarios":
                    responderJson(response, 200, leerJson(RUTA_COMENTARIOS));
                    mysql.end();
                    break;
                case "/api/obtener_usuario":
                    verificarToken((err, decoded) => {
                        if (err || !decoded) {
                            mysql.end();
                            return responderJson(response, 401, { mensaje: "Token inválido o expirado" });
                        }
                        mysql.query("SELECT id, usuario, correo FROM usuarios WHERE usuario = ?", [decoded.username], (err, res) => {
                            mysql.end();
                            if (err || res.length === 0) return responderJson(response, 404, { mensaje: "Usuario no encontrado" });
                            responderJson(response, 200, res[0]);
                        });
                    });
                    break;
                case "/api/coleccion":
                    verificarToken((err, decoded) => {
                        if (err || !decoded) {
                            mysql.end();
                            return responderJson(response, 401, { mensaje: "No autorizado" });
                        }
                        mysql.query("SELECT pelicula_id, en_coleccion, favorito, visto FROM coleccion WHERE usuario_id = (SELECT id FROM usuarios WHERE usuario = ?)", [decoded.username], (err, res) => {
                            mysql.end();
                            if (err) return responderJson(response, 500, { mensaje: "Error en BD" });
                            responderJson(response, 200, { coleccion: res });
                        });
                    });
                    break;
                default:
                    mysql.end();
                    responderJson(response, 404, { mensaje: "Ruta no encontrada" });
            }
            break;

        case "POST":
            var informacion = "";
            request.on("data", info => { informacion += info; });
            request.on("end", () => {
                const body = JSON.parse(informacion);
                switch (request.url) {
                    case "/api/login":
                        mysql.query("SELECT usuario FROM usuarios WHERE (usuario = ? OR correo = ?) AND contrasena = ?", [body.usuario, body.usuario, body.contrasena], (err, res) => {
                            mysql.end();
                            if (err || res.length === 0) return responderJson(response, 401, { mensaje: "Credenciales incorrectas" });
                            const tokenGenerado = jwt.sign({ username: res[0].usuario }, llave, { expiresIn: TIEMPO_TOKEN });
                            responderJson(response, 200, { mensaje: "Login exitoso", token: tokenGenerado, usuario: res[0].usuario });
                        });
                        break;
                    case "/api/registro":
                        mysql.query("INSERT INTO usuarios (usuario, correo, contrasena) VALUES (?, ?, ?)", [body.usuario, body.correo, body.contrasena], (err, res) => {
                            mysql.end();
                            if (err) return responderJson(response, 400, { mensaje: "El usuario o correo ya existe" });
                            responderJson(response, 201, { mensaje: "Usuario registrado con éxito" });
                        });
                        break;
                    case "/api/accion":
                        if (body.accion === "crearComentario") {
                            var comentarios = leerJson(RUTA_COMENTARIOS) || { arreglo: [] };
                            var nuevoId = comentarios.arreglo.length > 0 ? Math.max(...comentarios.arreglo.map(c => c.id)) + 1 : 1;
                            
                            var nuevoComentario = {
                                id: nuevoId, peliculaId: body.peliculaId, usuario: body.usuario,
                                texto: body.texto, calificacion: body.calificacion, likes: 0
                            };
                            comentarios.arreglo.push(nuevoComentario);
                            fs.writeFileSync(RUTA_COMENTARIOS, JSON.stringify(comentarios, null, 2));
                            mysql.end();
                            return responderJson(response, 201, { mensaje: "Comentario creado", comentario: nuevoComentario });
                        }
                        mysql.end();
                        responderJson(response, 400, { mensaje: "Acción no válida" });
                        break;
                    default:
                        mysql.end();
                        responderJson(response, 404, { mensaje: "Ruta no encontrada" });
                }
            });
            break;

        case "PUT":
            var informacion = "";
            request.on("data", info => { informacion += info; });
            request.on("end", () => {
                const body = JSON.parse(informacion);
                verificarToken((err, decoded) => {
                    if (err || !decoded) {
                        mysql.end();
                        return responderJson(response, 401, { mensaje: "No autorizado" });
                    }
                    
                    if (request.url === "/api/accion" && body.accion === "guardarColeccion") {
                        const query = `
                            INSERT INTO coleccion (usuario_id, pelicula_id, en_coleccion, favorito, visto) 
                            VALUES ((SELECT id FROM usuarios WHERE usuario = ?), ?, ?, ?, ?) 
                            ON DUPLICATE KEY UPDATE en_coleccion = ?, favorito = ?, visto = ?
                        `;
                        const valores = [
                            decoded.username, body.peliculaId, body.enColeccion, body.favorito, body.visto,
                            body.enColeccion, body.favorito, body.visto
                        ];
                        mysql.query(query, valores, (err) => {
                            mysql.end();
                            if (err) return responderJson(response, 500, { mensaje: "Error al guardar en BD" });
                            responderJson(response, 200, { mensaje: "Colección actualizada" });
                        });
                    } else if (request.url === "/api/accion" && body.accion === "editarComentario") {
                         var comentarios = leerJson(RUTA_COMENTARIOS) || { arreglo: [] };
                         for (var i = 0; i < comentarios.arreglo.length; i++) {
                             if (comentarios.arreglo[i].id == body.id) {
                                 comentarios.arreglo[i].texto = body.texto;
                                 comentarios.arreglo[i].calificacion = body.calificacion;
                                 break;
                             }
                         }
                         fs.writeFileSync(RUTA_COMENTARIOS, JSON.stringify(comentarios, null, 2));
                         mysql.end();
                         return responderJson(response, 200, { mensaje: "Comentario editado" });
                    } else {
                        mysql.end();
                        responderJson(response, 400, { mensaje: "Acción PUT no válida" });
                    }
                });
            });
            break;

        case "DELETE":
            var informacion = "";
            request.on("data", info => { informacion += info; });
            request.on("end", () => {
                const body = JSON.parse(informacion);
                if (request.url === "/api/accion" && body.accion === "eliminarComentario") {
                    var comentarios = leerJson(RUTA_COMENTARIOS) || { arreglo: [] };
                    for (var i = 0; i < comentarios.arreglo.length; i++) {
                        if (comentarios.arreglo[i].id == body.id) {
                            comentarios.arreglo.splice(i, 1);
                            break;
                        }
                    }
                    fs.writeFileSync(RUTA_COMENTARIOS, JSON.stringify(comentarios, null, 2));
                    mysql.end();
                    return responderJson(response, 200, { mensaje: "Comentario eliminado" });
                }
                mysql.end();
                responderJson(response, 400, { mensaje: "Acción DELETE no válida" });
            });
            break;
    }
});

server.listen(puerto, () => {
    console.log("Servidor AnimaBox Fase 2 en http://localhost:" + puerto);
});