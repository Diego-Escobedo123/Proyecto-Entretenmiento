# Cotización y modelo de cobro de Mosaic

## 1. ¿Cuál es el modelo para el producto?

Mosaic es **freemium**: usar la app es gratis y gana dinero de dos formas.

### Retainer: cobrar suscripciones

Un plan **Premium** opcional, con pago recurrente (ver sección 4).

### Por valor: cobrar un porcentaje sobre las ventas

Comisiones por las compras que los usuarios hacen desde Mosaic en tiendas aliadas. El primer aliado propuesto es la librería **Sophos** (ver sección 5).

## 2. Productos de software de referencia: Letterboxd y Goodreads

Elegimos dos apps del mismo rubro que Mosaic, una para cada fuente de ingreso.

**Letterboxd** (registro y reseñas de películas) respalda la suscripción. Es gratis con anuncios, y sus planes Pro y Patron (desde unos US$19 al año) quitan los anuncios y suman estadísticas personales. Es lo mismo que ofrece nuestro Premium con el ADN cultural avanzado, y nuestro plan anual de US$18 queda alineado con su precio.

**Goodreads** (registro y reseñas de libros) respalda las comisiones. Es gratis para el usuario, pertenece a Amazon y cada libro tiene un botón para comprarlo en Amazon. Mosaic hace lo mismo con el botón de Sophos, pero con una librería local.

## 3. Modelo que no se usaría

### Precio fijo

Mosaic no es un producto que se le venda a un solo cliente. Es más un servicio que sigue vivo y con usuarios que siguen llegando, por lo que este modelo no es útil.

## 4. Planes y precios

| | Gratis | Premium mensual | Premium anual |
|---|---|---|---|
| Precio | US$0 | **US$2 / mes** (≈ Q15) | **US$18 / año** (≈ Q139) |
| Incluye | Todo lo que la app hace hoy: registrar películas, series, libros, juegos y música; diario, calificaciones y reseñas; listas y metas anuales; seguir perfiles; ADN cultural | Todo lo del plan Gratis, más: ADN cultural avanzado (estadísticas por año y comparación con amigos), resumen del año cultural, insignia Premium en el perfil y temas de color extra | Lo mismo que el mensual. Equivale a 3 meses gratis (25 % de ahorro) |

- Los precios están en dólares; el monto en quetzales es aproximado (US$1 ≈ Q7.70).
- Se eligió un precio bajo porque Mosaic compite con apps gratuitas: el plan Gratis tiene que ser bueno por sí solo y Premium sólo suma extras.

**Estado en la app:** la pantalla de planes ya existe (`/premium`, accesible desde el menú lateral y desde Ajustes → Cuenta). Todos los usuarios están en el plan Gratis. El botón "Mejorar a Premium" avisa que los pagos llegan en la siguiente fase: no pide datos de pago ni cambia la cuenta, y los beneficios de Premium todavía no están construidos.

## 5. Comisiones por venta: Sophos (aliado propuesto)

1. El usuario ve un libro en Mosaic (o la reseña de un amigo).
2. En la ficha del libro toca **"Sophos"** y llega al buscador de la tienda en línea con ese título y autor. El enlace lleva `ref=mosaic` para identificar que la visita vino de Mosaic.
3. Si compra, Sophos le paga a Mosaic un porcentaje de la venta.

Ejemplo: un libro de Q150 con 5 % de comisión le deja **Q7.50** a Mosaic, sin costo extra para el usuario.

**Estado en la app:** el botón "Sophos · Disponible en Guatemala" ya aparece primero en la sección "Dónde leerlo" de cada libro, sólo cuando el dispositivo está en Guatemala (se detecta por su zona horaria). Hoy no hay acuerdo con Sophos, así que `ref=mosaic` no genera comisiones todavía.

**Siguiente paso:** el mismo modelo se puede aplicar a los enlaces de "dónde verla / escucharla" que la app ya muestra en películas, series y música, a través de programas de afiliados como Amazon Associates.

## 6. Ejemplo de ingresos al mes (escenario hipotético)

| Fuente | Cálculo | Ingreso al mes |
|---|---|---|
| Premium | 1,000 usuarios activos × 3 % que paga × US$2 | US$60 ≈ Q462 |
| Comisiones Sophos | 50 libros × Q150 × 5 % | Q375 |
| **Total** | | **≈ Q837** |

Ninguna de las dos fuentes alcanza sola: por eso el modelo combina suscripción y comisiones.

## 7. Supuestos

Las cifras de las secciones 5 y 6 son **hipotéticas**:

- **Sophos es un aliado propuesto.** No hay ningún acuerdo y Sophos no tiene un programa de afiliados público.
- **La comisión del 5 % es una estimación,** basada en programas similares (Amazon Associates paga alrededor de 4.5 % en libros; otros programas de libros y medios pagan entre 5 % y 10 %). El porcentaje real se definiría al negociar con Sophos.
- **El 3 % de usuarios que paga Premium** es una tasa típica en apps freemium (entre 2 % y 5 %), no un dato medido en Mosaic.
- **1,000 usuarios activos y 50 libros vendidos al mes** son cantidades de ejemplo para mostrar el cálculo, no una proyección.

## 8. Cotización estimada del proyecto

Estimamos el backlog en story points y cotizamos por hora, con un colchón para el riesgo. Son las mismas cifras de la diapositiva 10 de la presentación (`docs/index.html`).

| Concepto | Valor |
|---|---|
| Story points totales | 343 |
| Equivalencia | 1 story point = 1 hora |
| Horas totales | 343 horas |
| Precio por hora | Q120.00 |
| Subtotal (343 h × Q120) | Q41,160.00 |
| Colchón de riesgo (20 %) | Q8,232.00 |
| **Total a cotizar (redondeado)** | **Q50,000.00** |

El subtotal más el colchón da Q49,392.00, que se redondea a Q50,000.00.
