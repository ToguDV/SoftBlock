# SoftBlock

Extension de Chrome (Manifest V3) para tomar una decision consciente al abrir sitios definidos por el usuario.

## Funcionalidades

- Lista de dominios bloqueados administrada desde la pagina de opciones.
- Deteccion automatica al navegar o cambiar de ruta en sitios SPA.
- Popup bloqueante en la pagina con decision obligatoria:
  - Continuar (elige 1, 5, 15 o 30 minutos para re-preguntar en la misma pestana).
  - No continuar (cierra la pestana).
- Incluye subdominios automaticamente.
- Persistencia local con `chrome.storage.local`.

## Estructura

- `manifest.json`
- `src/background/service-worker.js`
- `src/content/content-script.js`
- `src/options/options.html`
- `src/options/options.js`
- `src/options/options.css`

## Cargar en Chrome

1. Abrir `chrome://extensions`.
2. Activar modo desarrollador.
3. Click en "Load unpacked".
4. Seleccionar esta carpeta.
5. Abrir opciones de la extension y agregar dominios.

## Nota

La extension no puede ejecutarse sobre paginas internas del navegador (`chrome://`).
