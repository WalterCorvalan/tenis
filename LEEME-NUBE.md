# Guardar los datos en Google Sheets

Se hace **una sola vez** (unos 5 minutos). Después, todo lo que se cargue en el celular o en la computadora queda guardado en una planilla de Google Drive y se ve igual en los dos.

**No hay que crear columnas ni inventar claves**: la planilla se arma sola y la clave se genera sola.

## 1. Crear la planilla en blanco
1. Entrar a <https://sheets.new> con la cuenta de Google del entrenador.
2. Ponerle de nombre, por ejemplo, **Caja tenis**. Nada más.

## 2. Pegar el script
1. En la planilla: menú **Extensiones → Apps Script**.
2. Borrar todo lo que aparece y pegar el contenido de [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
3. Tocar **guardar** 💾.

## 3. Publicarlo
1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje ⚙ elegir **Aplicación web** y completar:
   - **Ejecutar como:** *Yo*
   - **Quién tiene acceso:** *Cualquier persona*
3. **Implementar**. Google pide permisos:
   - **Autorizar acceso** → elegir la cuenta.
   - Si aparece “Google no verificó esta aplicación”: **Configuración avanzada → Ir a (nombre del proyecto) (no seguro) → Permitir**. Es normal: el script es propio y solo toca esta planilla.
4. Copiar la **URL de la aplicación web** (termina en `/exec`).

## 4. Conectar la página
1. En la página: **Opciones ⋯ → Guardar en la nube**, o tocar el botón **Sin nube** de arriba.
2. **Pegar la URL → Guardar y conectar.** Listo.

Aparece “Conectado a Google Sheets”, el botón pasa a verde (**Guardado en la nube**) y en la planilla se crea sola la hoja **Movimientos**, ya con su estructura. Lo que ya estuviera cargado en la página se sube.

## 5. Conectar otro dispositivo (celular y computadora)
1. En el dispositivo que ya está conectado: **Opciones ⋯ → Guardar en la nube → Copiar código**.
2. En el otro dispositivo: **Opciones ⋯ → Guardar en la nube**, pegar ese **código** → **Guardar y conectar**. (Se puede mandar por WhatsApp a uno mismo.)

> El código es la URL más la clave (`https://script.google.com/…/exec#clave`). Es secreto: da acceso a los datos.

## Cómo es la planilla
La hoja **Movimientos** tiene una fila por movimiento, con encabezado y filtros:

| Columna | Qué es |
|---|---|
| `id` | identificador interno (no tocar) |
| `fecha` / `hora` | `AAAA-MM-DD` y `HH:MM` |
| `tipo` | Ingreso o Egreso |
| `monto (ARS)` | en pesos |
| `categoria`, `cliente`, `nota` | |
| `actualizado` | marca interna de la última modificación (no tocar) |
| `eliminado` | `SI` si se borró (queda para que el borrado llegue al otro dispositivo; se puede ocultar con un filtro) |
| `pendiente` | `SI` si la clase todavía no se cobró |
| `cancelada` / `motivo` | `SI` y por qué (lluvia, faltó el alumno, reprogramada…) |
| `pack (clases)` / `pack (id)` | para los packs: cuántas clases tiene el pack, y a qué pack pertenece cada clase descontada |

Se puede **corregir una fila a mano** en la planilla y el cambio llega a la página (mantener los formatos de fecha, hora y tipo). Lo más cómodo es editar desde la página.

## Cómo funciona día a día
- Cada cambio se guarda primero en el dispositivo (instantáneo) y unos segundos después sube a la planilla.
- Sin señal en la cancha se sigue cargando normalmente: queda pendiente y sube cuando vuelve internet.
- Al abrir la página o volver a ella se baja lo que se cargó en el otro dispositivo (también se revisa cada 2 minutos).
- Si dos dispositivos cambian lo mismo, gana el cambio más reciente.

## Seguridad
- Solo se puede leer o escribir con la **clave**. La clave la genera la planilla la primera vez que se pega la URL; nadie la escribe ni la ve salvo en el código de “Copiar código”.
- Mientras nadie pegó la URL en la página, la planilla todavía no tiene clave: por eso conviene hacer el paso 4 enseguida después de publicar, y no compartir la URL con nadie antes.
- **Perdí el código / quiero cambiar la clave:** en la planilla, menú **Tenis → Restablecer vinculación…** (los datos no se borran). Después volver a pegar la URL en la página (paso 4) y, si hay otro dispositivo, repetir el paso 5.

## Si algo falla
| Mensaje | Qué hacer |
|---|---|
| “Esta planilla ya está vinculada…” | Es el segundo dispositivo: pegar el **código** del primero (paso 5), no la URL sola. |
| “Clave incorrecta” | El código está desactualizado (se restableció la vinculación): copiar el código nuevo del primer dispositivo. |
| “Todavía no está vinculada” | Se restableció la vinculación: pegar la URL en la página (paso 4). |
| “La URL no respondió como se esperaba…” | En el paso 3 el acceso no quedó en *Cualquier persona*, o se copió una URL que no termina en `/exec`. |
| “No se pudo conectar” | Sin internet, o la URL está mal copiada. |
| Cambié el script y no se nota | Crear una **nueva versión**: **Implementar → Administrar implementaciones → ✏ → Versión: Nueva versión → Implementar** (la URL no cambia). |
| Ya había probado una versión anterior del script | Pegar el script nuevo y crear una nueva versión (ver arriba). Para que se vincule de nuevo hay que usar **Tenis → Restablecer vinculación…**; la hoja existente se actualiza sola. |

# Publicar la página en GitHub Pages

1. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `master` / carpeta `/ (root)` → Save**.
2. En un minuto la página queda en `https://waltercorvalan.github.io/tenis/`. Abrir ese link en el celular y agregarlo a la pantalla de inicio (en Chrome: ⋮ → *Agregar a pantalla principal*).

> GitHub Pages es gratis con repositorios públicos. En repositorios privados requiere un plan de pago de GitHub. Como el repositorio no contiene datos ni claves (solo el código), puede ser público sin problema.
