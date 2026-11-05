/**
 * Se carga antes de cada corrida de `bun test` (ver bunfig.toml).
 * Fija las variables de entorno para que las pruebas den lo mismo en
 * cualquier compu y en CI, sin importar lo que tenga el .env de cada quien.
 */
process.env.JWT_SECRET = 'clave-solo-para-pruebas'
process.env.GOOGLE_CLIENT_ID = 'mosaic-test.apps.googleusercontent.com'
process.env.RESEND_API_KEY = '' // nunca mandar correos de verdad
process.env.TRUST_PROXY = 'false'
