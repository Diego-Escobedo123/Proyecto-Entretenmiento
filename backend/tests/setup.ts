/**
 * Se carga antes de cada corrida de `bun test` (ver bunfig.toml).
 * Fija las variables de entorno para que las pruebas den lo mismo en
 * cualquier compu y en CI, sin importar lo que tenga el .env de cada quien.
 */
process.env.JWT_SECRET = 'clave-solo-para-pruebas'
process.env.GOOGLE_CLIENT_ID = 'mosaic-test.apps.googleusercontent.com'
process.env.RESEND_API_KEY = '' // nunca mandar correos de verdad
process.env.TRUST_PROXY = 'false'

// Las pruebas NUNCA usan la base del .env (podría ser la de producción):
// las de integración usan TEST_DATABASE_URL y las unitarias no usan base.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://sin-base@localhost:1/sin_base_test'
