// Metadatos de capítulos, laboratorios y demos. Fuente única para la portada,
// la nav, prev/next, el índice de cada página y la franja de controles de cada demo.

export const CHAPTERS = [
  { n: 1, slug: '01-definiendo-game-feel', title: 'Definiendo el game feel', desc: 'Control en tiempo real, espacio simulado y pulido: los tres bloques.' },
  { n: 2, slug: '02-percepcion-humana', title: 'Game feel y percepción humana', desc: 'Ciclo de corrección de 240 ms, umbrales de movimiento, respuesta y continuidad.' },
  { n: 3, slug: '03-modelo-de-interactividad', title: 'El modelo de interactividad', desc: 'El jugador como procesador, los sentidos, la computadora y la intención.' },
  { n: 4, slug: '04-mecanicas', title: 'Mecánicas del game feel', desc: 'Qué mecánicas tienen feel y cuáles no: criterios aplicados.' },
  { n: 5, slug: '05-metricas', title: 'Más allá de la intuición: métricas', desc: 'Métricas duras y blandas; los seis elementos a medir.' },
  { n: 6, slug: '06-metricas-de-input', title: 'Métricas de input', desc: 'Señales, estados, ejes y la física del dispositivo.' },
  { n: 7, slug: '07-metricas-de-respuesta', title: 'Métricas de respuesta', desc: 'Envolventes ADSR, simulación, filtrado y sensibilidad.' },
  { n: 8, slug: '08-metricas-de-contexto', title: 'Métricas de contexto', desc: 'Impresión de espacio, tamaño y velocidad.' },
  { n: 9, slug: '09-metricas-de-pulido', title: 'Métricas de pulido', desc: 'Animación, partículas, sonido y efectos de cámara.' },
  { n: 10, slug: '10-metricas-de-metafora', title: 'Métricas de metáfora', desc: 'Real, icónico y abstracto: las expectativas que crea la representación.' },
  { n: 11, slug: '11-metricas-de-reglas', title: 'Métricas de reglas', desc: 'Reglas de alto, medio y bajo nivel y su efecto en la sensación.' },
  { n: 12, slug: '12-asteroids', title: 'Caso: nave con inercia (Asteroids)', desc: 'Rotación con ataque suave, empuje con inercia, espacio envolvente.' },
  { n: 13, slug: '13-super-mario-bros', title: 'Caso: plataformas (Super Mario Bros.)', desc: 'Aceleración, salto de altura variable y estados suelo/aire.' },
  { n: 14, slug: '14-bionic-commando', title: 'Caso: gancho y péndulo (Bionic Commando)', desc: 'Balanceo, conservación de momento y zona muerta de cámara.' },
  { n: 15, slug: '15-super-mario-64', title: 'Caso: movimiento 3D analógico (Super Mario 64)', desc: 'Stick a velocidad, cadena de saltos y cámara.' },
  { n: 16, slug: '16-raptor-safari', title: 'Caso: vehículo todoterreno (Raptor Safari)', desc: 'Suspensión con raycasts y suavizado del eje de input.' },
  { n: 17, slug: '17-principios', title: 'Principios del game feel', desc: 'Respuesta instantánea, fácil pero profundo, movimiento orgánico…' },
  { n: 18, slug: '18-juegos-que-quiero-hacer', title: 'Juegos que quiero hacer', desc: 'Mil avatares, ventana al mundo, avatares invisibles y afinar como juego.' },
  { n: 19, slug: '19-futuro', title: 'El futuro del game feel', desc: 'Hacia dónde van el input, la respuesta y el pulido.' },
];

export const LABS = [
  { slug: 'curvas-de-respuesta', title: 'Curvas de respuesta', desc: 'Editor input→output, envolventes ADSR, zonas muertas y suavizados.' },
  { slug: 'peso-del-mouse', title: 'Peso del mouse', desc: 'Qué hace que algo controlado con el mouse se sienta pesado o liviano.' },
  { slug: 'lag', title: 'Lag en las respuestas', desc: 'Latencia, jitter y fps: dónde se rompe el control en tiempo real.' },
];

// Demos jugables, en orden de aparición. Cada una vive en `page` bajo el ancla id en minúsculas.
// devices: mouse | teclado | gamepad | tactil
// controls: [qué se hace, para qué]. Los modos (1–N) y R (reiniciar) se agregan solos en la demo.
export const DEMOS = {
  'CH01-1': {
    page: '01-definiendo-game-feel', title: 'Primera persona: con y sin espacio',
    devices: ['mouse', 'teclado'],
    controls: [
      ['Clic en el área', 'capturar el mouse (Esc lo suelta)'],
      ['Mover el mouse', 'mirar (sin captura: arrastrar)'],
      ['W A S D · flechas', 'caminar (← → también giran)'],
    ],
  },
  'CH01-2': {
    page: '01-definiendo-game-feel', title: 'Colisiones: el espacio responde',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['W A S D · flechas', 'moverse'],
      ['Stick izquierdo', 'gamepad: moverse'],
    ],
  },
  'CH01-3': {
    page: '01-definiendo-game-feel', title: 'Control, espacio y pulido: las siete combinaciones',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['W A S D · flechas', 'moverse y empujar las pelotas'],
      ['Stick izquierdo', 'gamepad: moverse'],
    ],
  },
  'CH02-1': {
    page: '02-percepcion-humana', title: 'El ciclo de corrección',
    devices: ['mouse', 'tactil'],
    controls: [
      ['Mover el mouse', 'llevar el cursor al punto y quedarse un instante'],
    ],
  },
  'EX02-1': {
    page: '02-percepcion-humana', title: 'Umbral del movimiento: de 5 a 60 fps',
    devices: ['mouse', 'tactil'],
    controls: [
      ['Mover el mouse a los lados', 'mover los cinco cuadrados a la vez (modo 1)'],
    ],
  },
  'EX03-1': {
    page: '03-modelo-de-interactividad', title: 'El bucle de interactividad, cronometrado',
    devices: ['teclado', 'mouse'],
    controls: [
      ['Espacio', 'disparar un ciclo'],
      ['Clic en una etapa', 'leer qué pasa en ella'],
    ],
  },
  'EX04-1': {
    page: '04-mecanicas', title: 'Tiempo real, clic para mover y por turnos',
    devices: ['teclado', 'mouse'],
    controls: [
      ['W A S D · flechas', 'moverse (modo 1) o dar un paso (modo 3)'],
      ['Clic en el mapa', 'elegir destino (modo 2)'],
    ],
  },
  'EX04-2': {
    page: '04-mecanicas', title: 'La animación manda o el control manda',
    devices: ['teclado'],
    controls: [
      ['A / D · ← / →', 'correr (o dar un paso corto en el modo 3)'],
    ],
  },
  'CH05-1': {
    page: '05-metricas', title: 'Teclado o stick analógico',
    devices: ['teclado', 'gamepad', 'mouse', 'tactil'],
    controls: [
      ['W A S D · flechas', 'modo 1: teclado (8 direcciones)'],
      ['Stick izquierdo', 'modo 2: analógico real'],
      ['Arrastrar en el área', 'modo 2 sin gamepad: stick virtual'],
    ],
  },
  'CH05-2': {
    page: '05-metricas', title: 'El mismo sistema, cinco pulidos',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'moverse'],
      ['Espacio · W · ↑', 'saltar'],
    ],
  },
  'EX06-1': {
    page: '06-metricas-de-input', title: 'Las señales del input',
    devices: ['teclado', 'mouse', 'gamepad', 'tactil'],
    controls: [
      ['Espacio', 'botón'],
      ['J (mantener)', 'gatillo simulado'],
      ['Arrastrar en el panel Stick', 'stick virtual'],
      ['Mover el mouse', 'deltas del mouse'],
      ['Gamepad', 'botón A, gatillo derecho y stick izquierdo reales'],
    ],
  },
  'CH07-1': {
    page: '07-metricas-de-respuesta', title: 'Cubo ADSR: aceleración, drag y velocidad máxima',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'mover el cubo'],
      ['Escribir en las cajas del panel', 'probar valores exactos'],
    ],
  },
  'CH07-2': {
    page: '07-metricas-de-respuesta', title: 'Sensibilidad del input y de la respuesta',
    devices: ['teclado', 'mouse'],
    controls: [
      ['W A S D · flechas', 'modos 1 y 2'],
      ['Mover el mouse', 'modos 3 y 4'],
    ],
  },
  'EX07-1': {
    page: '07-metricas-de-respuesta', title: 'Estados: suelo y aire',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'moverse'],
      ['Espacio · W · ↑ (mantener)', 'saltar, más alto si se mantiene'],
    ],
  },
  'EX07-2': {
    page: '07-metricas-de-respuesta', title: 'Gestos: secuencias de input',
    devices: ['teclado'],
    controls: [
      ['Flechas · W A S D', 'direcciones (↓ + → a la vez = ↘)'],
      ['J', 'botón de acción'],
    ],
  },
  'CH08-1': {
    page: '08-metricas-de-contexto', title: 'Un auto a 100 mph',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['Espacio · W · ↑ (mantener)', 'ir a la velocidad del código'],
      ['A / D · ← / →', 'cambiar de carril'],
    ],
  },
  'EX08-1': {
    page: '08-metricas-de-contexto', title: 'Espaciado frente a velocidad',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'moverse para pasar por el hueco'],
    ],
  },
  'CH09-1': {
    page: '09-metricas-de-pulido', title: '¿Se atraviesan o rebotan?',
    devices: ['mouse', 'tactil'],
    controls: [
      ['Mirar', 'las bolas se cruzan solas'],
      ['Botones bajo la demo', 'votar qué viste'],
    ],
  },
  'EX09-1': {
    page: '09-metricas-de-pulido', title: 'Un golpe, capa por capa',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['J · K · Espacio', 'golpear'],
      ['Casillas del panel', 'activar cada capa de pulido'],
    ],
  },
  'EX10-1': {
    page: '10-metricas-de-metafora', title: 'La misma física, cuatro metáforas',
    devices: ['teclado'],
    controls: [
      ['A / D · ← / →', 'moverse'],
      ['Espacio · W · ↑', 'saltar (si la metáfora lo permite)'],
    ],
  },
  'EX11-1': {
    page: '11-metricas-de-reglas', title: 'El mismo control, distintas reglas',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['W A S D · flechas', 'impulsar la nave'],
      ['Espacio', 'disparar'],
    ],
  },
  'CH12-1': {
    page: '12-asteroids', title: 'Recrea la nave: todo empieza en cero',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'girar'],
      ['W · ↑', 'empujar'],
      ['Espacio', 'disparar'],
      ['Panel', 'subir los parámetros desde cero'],
    ],
  },
  'CH12-2': {
    page: '12-asteroids', title: 'Fijar posición, trasladar o sumar empuje',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'girar'],
      ['W · ↑', 'empujar'],
      ['Espacio', 'disparar'],
    ],
  },
  'CH13-1': {
    page: '13-super-mario-bros', title: 'Un rectángulo que salta: la receta paso a paso',
    devices: ['teclado', 'gamepad', 'mouse'],
    controls: [
      ['A / D · ← / →', 'moverse'],
      ['Espacio · W · ↑', 'saltar (mantener = más alto)'],
      ['J · Shift', 'correr'],
      ['Clic en el nivel', 'poner o quitar un bloque'],
    ],
  },
  'CH13-2': {
    page: '13-super-mario-bros', title: 'Del rectángulo al personaje',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'moverse'],
      ['Espacio · W · ↑', 'saltar'],
      ['J · Shift', 'correr'],
    ],
  },
  'CH14-1': {
    page: '14-bionic-commando', title: 'Gancho, columpio y cámara con zona muerta',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'correr'],
      ['J · Espacio', 'lanzar el gancho / soltarse'],
      ['W + J', 'gancho hacia arriba'],
    ],
  },
  'CH15-1': {
    page: '15-super-mario-64', title: 'Cápsula analógica: correr, girar y encadenar saltos',
    devices: ['teclado', 'gamepad', 'mouse'],
    controls: [
      ['W A S D · flechas', 'moverse (relativo a la cámara)'],
      ['Arrastrar en el área', 'stick virtual analógico'],
      ['Stick izquierdo', 'gamepad: moverse; stick derecho: cámara'],
      ['Espacio · botón A', 'saltar (mantener = más alto)'],
      ['Shift · C', 'agacharse (corriendo: deslizarse)'],
      ['Q / E', 'girar la cámara'],
    ],
  },
  'EX16-1': {
    page: '16-raptor-safari', title: 'Jeep: suspensión por raycasts y ejes filtrados',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['W · S · ↑ · ↓', 'acelerar y frenar o retroceder'],
      ['A · D · ← · →', 'girar'],
      ['Espacio', 'freno de mano (las traseras pierden agarre)'],
      ['Stick izquierdo · gatillos', 'gamepad: girar y acelerar (entran crudos, sin filtro)'],
    ],
  },
  'CH17-2': {
    page: '17-principios', title: 'Cuatro sensaciones, sin contexto',
    devices: ['teclado', 'mouse'],
    controls: [
      ['W A S D · flechas', 'modos 1 y 2'],
      ['Mover el mouse', 'modos 3 y 4'],
    ],
  },
  'EX17-1': {
    page: '17-principios', title: 'Un interruptor por principio',
    devices: ['teclado', 'mouse'],
    controls: [
      ['P', 'aplicar o quitar el principio'],
      ['J · K (a la vez)', 'modo 1: dos botones casi simultáneos'],
      ['Mover el mouse', 'modo 2: indicar hacia dónde girar'],
      ['W A S D · flechas', 'modos 3, 5 y 6: moverse'],
      ['J · K · Espacio', 'modo 4: golpear la bolsa'],
    ],
  },
  'EX18-1': {
    page: '18-juegos-que-quiero-hacer', title: 'Cien avatares a la vez',
    devices: ['teclado', 'mouse', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'mover a todos'],
      ['Espacio · W · ↑', 'saltar (mantener = más alto)'],
      ['Mover el mouse', 'modo 2: ubicar la zona de influencia'],
    ],
  },
  'EX18-2': {
    page: '18-juegos-que-quiero-hacer', title: 'Avatar invisible',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['W A S D · flechas', 'moverse y chocar con las paredes'],
      ['Stick izquierdo', 'gamepad: moverse'],
    ],
  },
  'EX18-3': {
    page: '18-juegos-que-quiero-hacer', title: 'Afinar como juego',
    devices: ['teclado', 'mouse', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'moverse'],
      ['Espacio · W · ↑', 'saltar'],
      ['Panel de parámetros', 'el verdadero control: afinar hasta poder cumplir la meta'],
    ],
  },
  'EX19-1': {
    page: '19-futuro', title: 'Aviso de pérdida: vibración graduada o efecto especial',
    devices: ['teclado', 'gamepad', 'tactil'],
    controls: [
      ['W / S · ↑ / ↓', 'subir o bajar la nariz'],
      ['Stick izquierdo', 'gamepad: cabecear (atrás = nariz arriba); vibra si el navegador lo permite'],
      ['Arrastrar arriba / abajo', 'táctil: cabecear'],
    ],
  },
  'EX19-2': {
    page: '19-futuro', title: 'Inclinación: el aparato es el control',
    devices: ['tactil', 'mouse', 'teclado'],
    controls: [
      ['Inclinar el teléfono', 'inclinar la bandeja o mirar por la ventana'],
      ['Tocar · clic · C', 'pedir permiso al sensor (iOS) y recalibrar'],
      ['Mover el mouse', 'sin sensor: la distancia al centro es la inclinación'],
      ['Flechas · W A S D', 'inclinación por teclado'],
    ],
  },
  'LAB-C1': {
    page: 'curvas-de-respuesta', title: 'Editor de curva: del stick al volante',
    devices: ['mouse', 'teclado', 'gamepad', 'tactil'],
    controls: [
      ['Arrastrar a los lados en la pista', 'stick virtual: la distancia horizontal es la inclinación'],
      ['A / D · ← / →', 'stick por teclado, con rampa ajustable'],
      ['Stick izquierdo', 'gamepad: input analógico real'],
      ['Arrastrar las manijas', 'editar la curva bezier (modo 5)'],
    ],
  },
  'LAB-C2': {
    page: 'curvas-de-respuesta', title: 'Envolvente ADSR',
    devices: ['teclado', 'mouse', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'mover el cubo a la izquierda y a la derecha'],
      ['Stick izquierdo', 'gamepad: mover el cubo'],
      ['Arrastrar los puntos A, D/S y R', 'editar la envolvente'],
    ],
  },
  'LAB-C3': {
    page: 'curvas-de-respuesta', title: 'Zonas muertas: filtrar el stick',
    devices: ['mouse', 'teclado', 'gamepad', 'tactil'],
    controls: [
      ['Arrastrar dentro del círculo izquierdo', 'mover el stick'],
      ['W A S D · flechas', 'stick digital (8 direcciones)'],
      ['Stick izquierdo', 'gamepad real: verás su deriva y su ruido'],
    ],
  },
  'LAB-C4': {
    page: 'curvas-de-respuesta', title: 'Suavizados: cuatro maneras de llegar',
    devices: ['mouse', 'tactil'],
    controls: [
      ['Mover el mouse', 'el objetivo sigue al cursor (modo 2)'],
      ['Clic o arrastrar en el carril', 'fijar el objetivo (modo 3)'],
    ],
  },
  'LAB-M1': {
    page: 'peso-del-mouse', title: 'Cinco maneras de pesar',
    devices: ['mouse', 'tactil'],
    controls: [
      ['Mover el mouse (o arrastrar el dedo)', 'el círculo persigue al cursor'],
      ['Mover rápido y frenar en seco', 'medir retraso, sobrepaso y asentamiento'],
    ],
  },
  'LAB-M2': {
    page: 'peso-del-mouse', title: 'Agarrar y lanzar',
    devices: ['mouse', 'tactil'],
    controls: [
      ['Arrastrar un objeto', 'agarrarlo'],
      ['Soltar mientras se mueve', 'lanzarlo'],
      ['Dejarlo quieto en la zona verde', 'completar la tarea'],
    ],
  },
  'LAB-M3': {
    page: 'peso-del-mouse', title: 'Apariencia, sonido o movimiento: ¿quién manda?',
    devices: ['mouse', 'tactil'],
    controls: [
      ['Arrastrar la bola y soltarla', 'lanzarla contra las latas'],
      ['Botones Liviana / Media / Pesada', 'calificar cuánto pesa'],
      ['R', 'reacomodar las latas'],
    ],
  },
  'LAB-M4': {
    page: 'peso-del-mouse', title: 'Ratio C:D y aceleración del puntero',
    devices: ['mouse', 'tactil'],
    controls: [
      ['Clic en el área', 'capturar el mouse'],
      ['Mover el mouse', 'mover el cursor virtual (con la ganancia elegida)'],
      ['Clic sobre el objetivo', 'acertar; aparece el siguiente'],
      ['Esc', 'soltar el mouse'],
      ['Arrastrar y levantar el dedo', 'en táctil: mover y hacer clic'],
    ],
  },
  'LAB-L1': {
    page: 'lag', title: 'Retraso, jitter y fps: el mismo control, tarde',
    devices: ['mouse', 'teclado', 'tactil'],
    controls: [
      ['Mover el mouse (o arrastrar el dedo)', 'el cuadrado sigue a tu mano, con lag'],
      ['Flechas · W A S D', 'mover el cuadrado con el teclado'],
      ['Espacio', 'comparar cuándo pulsas y cuándo se entera el juego'],
    ],
  },
  'LAB-L2': {
    page: 'lag', title: 'Tareas con lag: seguir y apuntar',
    devices: ['mouse', 'tactil'],
    controls: [
      ['Clic en el área', 'empezar una ronda'],
      ['Mover el mouse', 'seguir el punto (modo 1) o llevar el cursor al objetivo (modo 2)'],
      ['Clic sobre el objetivo', 'acertar (modo 2)'],
      ['C', 'borrar los resultados del modo'],
    ],
  },
  'LAB-L3': {
    page: 'lag', title: 'Saltos con lag',
    devices: ['teclado', 'mouse', 'gamepad'],
    controls: [
      ['Espacio · W · ↑', 'saltar; también empieza la ronda'],
      ['Clic', 'saltar durante la ronda'],
      ['Botón A', 'gamepad: saltar'],
      ['C', 'borrar los resultados'],
    ],
  },
  'LAB-L4': {
    page: 'lag', title: 'Test ciego A/B: ¿cuál tiene más lag?',
    devices: ['mouse', 'teclado', 'tactil'],
    controls: [
      ['Mover el mouse', 'sentir el retraso'],
      ['A / B', 'alternar entre las dos versiones'],
      ['← / →', 'responder: A o B tiene más lag'],
      ['Botones bajo la demo', 'lo mismo, para táctil'],
    ],
  },
  'LAB-L5': {
    page: 'lag', title: 'Tiempo de reacción',
    devices: ['mouse', 'teclado', 'tactil'],
    controls: [
      ['Clic · Espacio · Enter', 'empezar, y reaccionar cuando aparezca el estímulo'],
    ],
  },
  'LAB-L6': {
    page: 'lag', title: 'Mitigaciones: que algo responda ya',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'moverse'],
      ['Espacio · W · ↑', 'saltar los barriles'],
      ['Stick izquierdo · botón A', 'gamepad: moverse y saltar'],
    ],
  },
  'LAB-L7': {
    page: 'lag', title: 'Lag elegido frente a lag impuesto',
    devices: ['teclado', 'gamepad'],
    controls: [
      ['A / D · ← / →', 'moverse y esquivar lo que cae'],
      ['J · K · Espacio', 'golpear las cajas'],
      ['Stick izquierdo · botones A / X', 'gamepad: moverse y golpear'],
    ],
  },
};

export const DEVICE_LABEL = { mouse: 'mouse', teclado: 'teclado', gamepad: 'gamepad', tactil: 'táctil' };
export const demoAnchor = (id) => id.toLowerCase();
export const demosOf = (slug) => Object.entries(DEMOS).filter(([, d]) => d.page === slug).map(([id, d]) => ({ id, ...d }));

export const chapterPath = (c) => `capitulos/${c.slug}.html`;
export const labPath = (l) => `laboratorio/${l.slug}.html`;

// Orden de lectura para prev/next: laboratorios al final.
export const SEQUENCE = [
  ...CHAPTERS.map((c) => ({ id: c.slug, path: chapterPath(c), label: `${c.n}. ${c.title}` })),
  ...LABS.map((l) => ({ id: l.slug, path: labPath(l), label: `Lab: ${l.title}` })),
];
