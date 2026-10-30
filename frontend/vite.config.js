import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Puertos en los que se busca el backend.
 *
 * "php artisan serve" toma el primer puerto libre desde el 8000, asi que el
 * puerto cambia segun lo que este corriendo en la maquina. En vez de fijar un
 * puerto a mano, se busca el backend en estos y se usa el que responda.
 */
const PUERTOS_CANDIDATOS = [8000, 8001, 8002, 8003, 8004]

/**
 * Busca el backend de Laravel entre los puertos candidatos.
 *
 * Se usa la ruta de salud "/up" (la que registra Laravel) para no confuse-
 * se con otro servicio que escuche en el mismo puerto: "/up" solo responde
 * en el backend de este proyecto.
 *
 * @returns {Promise<string|null>} la URL del backend, o null si no esta
 */
async function detectarBackend() {
  for (const puerto of PUERTOS_CANDIDATOS) {
    try {
      const respuesta = await fetch(`http://127.0.0.1:${puerto}/up`, {
        signal: AbortSignal.timeout(500),
      })

      if (respuesta.ok) {
        return `http://127.0.0.1:${puerto}`
      }
    } catch {
      // Este puerto no es el del backend: se sigue con el siguiente.
    }
  }

  return null
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'eltrebol:detectar-backend',

      /**
       * El proxy se resuelve antes de levantar el servidor, asi que aqui es
       * donde toca buscar el backend. Solo hace falta en desarrollo: en la
       * compilacion no hay proxy que configurar.
       */
      async config(_config, env) {
        // En este hook el comando viene en env.command (config.command todavia
        // no esta resuelto).
        if (env.command !== 'serve') {
          return {}
        }

        const objetivo = env.VITE_API_TARGET || (await detectarBackend())

        if (!objetivo) {
          console.warn(
            '\n  [El Trébol] No se encontró el backend en los puertos ' +
              `${PUERTOS_CANDIDATOS.join(', ')}.\n` +
              '  Arráncalo con "php artisan serve" en backend/, o indica el puerto\n' +
              '  en frontend/.env con VITE_API_TARGET=http://127.0.0.1:8000\n',
          )
          return {}
        }

        console.log(`\n  [El Trébol] API del backend: ${objetivo}\n`)

        return {
          server: {
            proxy: {
              // El frontend llama a "/api" (ruta relativa) y Vite reenvia
              // esa ruta al backend. Asi el puerto no se fija en el frontend.
              '/api': {
                target: objetivo,
                changeOrigin: true,
              },
            },
          },
        }
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
