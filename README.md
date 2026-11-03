# Game Feel Interactivo

Sitio web en español que acompaña el libro *Game Feel: A Game Designer's Guide to Virtual Sensation* de Steve Swink (2009). Tiene una página por capítulo con un resumen propio y demos jugables en el navegador, más tres laboratorios dedicados a curvas de respuesta, peso del mouse y lag.

> Este proyecto no está afiliado al autor ni a la editorial. Los resúmenes tienen redacción propia y las citas son breves y atribuidas. El libro no se incluye en el repositorio.

## Contenido

- **19 capítulos** (`capitulos/`): cada uno trae ideas clave, números clave, demos con instrucciones ("Prueba esto…"), una sección *Para medir* y enlaces a los laboratorios relacionados.
- **Ejemplos jugables**: recreaciones de los *Playable Examples* del libro (CH01-1 … CH17-2) y ejercicios propios (EX). Las demos de los juegos analizados (caps. 12–16) son *sandboxes* de la mecánica con formas abstractas y niveles propios, sin sprites ni marcas.
- **Laboratorios** (`laboratorio/`):
  - **Curvas de respuesta**: editor de curvas, ADSR, zonas muertas y suavizados.
  - **Peso del mouse**: modelos de peso, agarrar y lanzar, apariencia vs. sonido vs. movimiento, ratio C:D y ley de Fitts.
  - **Lag**: retraso, jitter y caídas de fps con predicción, test ciego A/B, tiempo de reacción, mitigaciones y lag elegido vs. impuesto.

Las demos se juegan con teclado, mouse, gamepad (Gamepad API) o controles táctiles, según el caso. Cada una muestra su franja de controles.

## Stack

- HTML y JavaScript vanilla con módulos ES y Canvas 2D. **No hay paso de build.**
- [Three.js](https://threejs.org/) r170 para las demos 3D (CH01-1, caps. 15 y 16). Está incluido en `assets/vendor/` y se carga con un import map.
- Sonidos sintetizados con Web Audio, sin archivos de audio.

## Estructura

```
index.html              portada: índice de capítulos y laboratorios
404.html
netlify.toml            publicación estática y headers de caché
capitulos/NN-slug.html  una página por capítulo
laboratorio/            curvas-de-respuesta, peso-del-mouse, lag
assets/
  css/site.css          tokens, modo oscuro, layout y componentes
  js/chapters.js        metadatos de capítulos y registro de demos (DEMOS)
  js/core/              loop de paso fijo, input, panel de parámetros, gráficos,
                        curvas, simulación de lag, audio, navegación e índice
  js/demos/             una demo por archivo (chNN-*.js, lab-*.js)
  vendor/               three.module.min.js
```

Para agregar una demo:

1. Crea `assets/js/demos/<id>.js` con `createDemo()` de `core/demo.js`.
2. Regístrala en `DEMOS` (`assets/js/chapters.js`) con `page`, `title`, `devices` y `controls`. De ahí salen la franja de controles, el índice de la página y el subíndice de la portada.
3. Móntala desde la página correspondiente, antes de llamar a `buildToc()`.

## Correr en local

Los módulos ES necesitan un servidor HTTP, así que abrir el archivo con doble clic no funciona. Sirve la raíz del proyecto con cualquier servidor estático.

## Créditos

Basado en *Game Feel* de Steve Swink (Morgan Kaufmann, 2009). Para entender el material a fondo, lee el libro.
