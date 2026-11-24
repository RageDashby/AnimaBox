-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 24-11-2026 a las 10:22:40
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `bd_animabox`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `coleccion`
--

CREATE TABLE `coleccion` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `pelicula_id` int(11) NOT NULL,
  `en_coleccion` tinyint(1) DEFAULT 1,
  `favorito` tinyint(1) DEFAULT 0,
  `visto` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `coleccion`
--

INSERT INTO `coleccion` (`id`, `usuario_id`, `pelicula_id`, `en_coleccion`, `favorito`, `visto`) VALUES
(1, 1, 4, 0, 0, 0),
(2, 1, 31, 0, 0, 0),
(3, 1, 40, 1, 0, 0),
(4, 1, 101, 1, 1, 0),
(5, 1, 86, 1, 1, 0),
(6, 1, 99, 1, 1, 0),
(8, 1, 113, 1, 0, 1),
(10, 1, 36, 1, 0, 0),
(11, 1, 20, 1, 0, 0),
(12, 1, 92, 1, 1, 0),
(13, 1, 25, 1, 1, 0),
(14, 1, 3, 1, 1, 0),
(15, 1, 15, 1, 1, 0),
(16, 1, 51, 1, 0, 1),
(17, 1, 1, 1, 0, 1),
(18, 1, 34, 1, 1, 0),
(19, 1, 2, 1, 0, 1),
(20, 1, 9, 1, 0, 1),
(21, 1, 59, 1, 1, 1),
(22, 1, 81, 1, 0, 1),
(23, 1, 103, 1, 0, 0),
(24, 1, 58, 1, 0, 0),
(25, 1, 133, 1, 0, 0),
(26, 1, 47, 1, 1, 1),
(28, 1, 32, 1, 0, 0),
(45, 1, 141, 1, 0, 1),
(47, 1, 35, 1, 0, 1),
(48, 1, 96, 1, 0, 1),
(49, 1, 30, 1, 0, 0),
(50, 1, 62, 1, 1, 0),
(51, 1, 17, 1, 0, 0),
(52, 1, 142, 1, 0, 0),
(53, 1, 91, 1, 0, 0),
(54, 1, 98, 1, 1, 0),
(55, 1, 55, 1, 1, 0),
(56, 1, 7, 1, 0, 0),
(57, 1, 5, 1, 1, 0),
(58, 1, 97, 1, 1, 0),
(62, 7, 31, 1, 0, 0),
(63, 7, 143, 1, 0, 0),
(64, 7, 76, 1, 0, 0),
(65, 7, 4, 1, 1, 0),
(66, 7, 100, 1, 0, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `usuario` varchar(50) NOT NULL,
  `correo` varchar(100) NOT NULL,
  `contrasena` varchar(255) NOT NULL,
  `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `usuario`, `correo`, `contrasena`, `fecha_registro`) VALUES
(1, 'Ashby', 'ashby@gmai.com', '123', '2026-11-24 06:43:33'),
(7, 'Hilary', 'Hilary@gmail.com', '321', '2026-11-24 09:20:24');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `coleccion`
--
ALTER TABLE `coleccion`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `usuario_id` (`usuario_id`,`pelicula_id`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `usuario` (`usuario`),
  ADD UNIQUE KEY `correo` (`correo`),
  ADD UNIQUE KEY `contrasena` (`contrasena`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `coleccion`
--
ALTER TABLE `coleccion`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=67;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `coleccion`
--
ALTER TABLE `coleccion`
  ADD CONSTRAINT `coleccion_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
