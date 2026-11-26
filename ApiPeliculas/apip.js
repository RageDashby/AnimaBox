/* Librerias necesarios*/
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const basesdatos = require("mysql");
const jwt = require("jsonwebtoken");

/* Tiempo de expiracion del token */
const TIEMPO_TOKEN = "240s";

const llave = "HJDJHjdkjHJSjHJJKDXKJhjdjszhukmxdhjHJKhdiJHjhHhjHJb";
const puerto = 3000;

/* Rutas absolutas*/
const RUTA_PELICULAS = path.join(__dirname, "Peliculas.json");
const RUTA_COMENTARIOS = path.join(__dirname, "Comentarios.json");

/* Funcion para leer el jsonde forma asincorna y maneja los errores con try catch para no colgar la api */
function leerJson(ruta) {
    try { return JSON.parse(fs.readFileSync(ruta, "utf8")); } catch { return null; }
}
/* Responder json, plantilla de respuesta para evitar la repeticion de codigo */

function responderJson(response, codigo, objeto) {
    response.statusCode = codigo;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(objeto));
}
/*Servidor */
const server = http.createServer((request, response) => {
    // CORS
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "*");

    if (request.method === "OPTIONS") {
        response.writeHead(204);
        return response.end();
    }
    /* Conexion con la base de datos */
    const mysql = basesdatos.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "BD_animabox"
    });
    /* Obtiene el token de autorizacion */
    const token = request.headers.authorization;
    /*Verifica el token */
    function verificarToken(callback) {
        if (!token || token === "null") return callback(null, null);
        jwt.verify(token, llave, (err, decoded) => {
            if (err) return callback(err, null);
            callback(null, decoded);
        });
    }
    /*Switch principal para los metodos */
    switch (request.method) {
        /*Consulta de informacion */
        case "GET":
            switch (request.url) {
                /* Devuelve el catalogo leyendo el json */
                case "/api/peliculas":
                    responderJson(response, 200, leerJson(RUTA_PELICULAS));
                    mysql.end();
                    break;
                /* Devuelve los comentarios leyendo el json */
                case "/api/comentarios":
                    responderJson(response, 200, leerJson(RUTA_COMENTARIOS));
                    mysql.end();
                    break;
                case "/api/obtener_usuario":
                    // Verifica el token. Si es valido, busca al usuario en MySQL.    
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
                /*Verifica el token y devuelve las peliculas correspondientes al usuario desde MySQL */
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
            /*Metodo Post: Para crear o registrar informaicon */
        case "POST":
            var informacion = "";
            request.on("data", info => { informacion += info; });
            request.on("end", () => {
                const body = JSON.parse(informacion);
                switch (request.url) {
                    /*Busca el usuario y la contraseña en la base de datos */
                    case "/api/login":
                        mysql.query("SELECT usuario FROM usuarios WHERE (usuario = ? OR correo = ?) AND contrasena = ?", [body.usuario, body.usuario, body.contrasena], (err, res) => {
                            mysql.end();
                            if (err || res.length === 0) return responderJson(response, 401, { mensaje: "Credenciales incorrectas" });

                            const tokenGenerado = jwt.sign({ username: res[0].usuario }, llave, { expiresIn: TIEMPO_TOKEN });
                            responderJson(response, 200, { mensaje: "Login exitoso", token: tokenGenerado, usuario: res[0].usuario });
                        });
                        break;
                        /*Inserta un nuevo usuario en la base de dtaos */
                    case "/api/registro":
                        mysql.query("INSERT INTO usuarios (usuario, correo, contrasena) VALUES (?, ?, ?)", [body.usuario, body.correo, body.contrasena], (err, res) => {
                            mysql.end();
                            if (err) return responderJson(response, 400, { mensaje: "El usuario o correo ya existe" });
                            responderJson(response, 201, { mensaje: "Usuario registrado con éxito" });
                        });
                        break;
                        /*Crear comentario */
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
            /* PUT: Para actualziar o modificar infomracionk */
        case "PUT":
            var informacion = "";
            request.on("data", info => { informacion += info; });
            request.on("end", () => {
                const body = JSON.parse(informacion);
                /*Veriffica el token para asegurar que el usuario tiene permiso de actualizar */
                verificarToken((err, decoded) => {
                    if (err || !decoded) {
                        mysql.end();
                        return responderJson(response, 401, { mensaje: "No autorizado" });
                    }

                    if (request.url === "/api/accion" && body.accion === "guardarColeccion") {
                        /*Si la peli ya esta guardada, se actualiza si no la agrega */
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
                        /*Busca el comentario en el json y lo modifica */
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
            /* Delete: Elimanar comentario */
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
/*Servido a la escucha */
server.listen(puerto, () => {
    console.log("Servidor AnimaBox Fase 2 en http://localhost:" + puerto);
});