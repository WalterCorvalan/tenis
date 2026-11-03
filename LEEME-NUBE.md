# Guardar los datos en Google Sheets (paso a paso)

Se hace **una sola vez** y lleva unos 5 minutos. Al terminar, todo lo que se cargue en el celular o en la computadora queda guardado en una planilla de Google Drive y se ve igual en los dos.

## 1. Crear la planilla
1. Entrar a <https://sheets.new> con la cuenta de Google del entrenador.
2. Ponerle de nombre, por ejemplo, **Caja tenis**.

## 2. Pegar el script
1. En la planilla: menú **Extensiones → Apps Script**.
2. Borrar todo lo que aparece y pegar el contenido de [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
3. En la **primera línea de código** cambiar la clave:
   ```js
   const CLAVE = 'cambiar-esta-clave';
   ```
   por una clave larga y propia (mínimo 8 caracteres; mejor 3 o 4 palabras + un número, sin espacios). Anotarla: se usa en el paso 4.
4. Tocar el ícono de **guardar** 💾.

## 3. Publicarlo
1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje ⚙ elegir **Aplicación web**.
3. Completar:
   - **Ejecutar como:** *Yo*
   - **Quién tiene acceso:** *Cualquier persona*
4. **Implementar**. Google va a pedir permisos:
   - **Autorizar acceso** → elegir la cuenta.
   - Si aparece “Google no verificó esta aplicación”: **Configuración avanzada → Ir a (nombre del proyecto) (no seguro) → Permitir**. Es normal: el script es propio y solo toca esta planilla.
5. Copiar la **URL de la aplicación web** (termina en `/exec`).

## 4. Conectar la página
1. Abrir la página → botón **Sin nube** (arriba) → pegar la **URL** y la **clave** → **Guardar y conectar**.
2. Si todo sale bien aparece “Conectado a Google Sheets ✓” y el botón pasa a verde (**Guardado en la nube**).
3. Repetir este paso en el celular (misma URL y misma clave). Los datos se juntan solos.

En la planilla se crea sola una hoja llamada **Movimientos**, con las columnas `id, fecha, hora, tipo, monto (ARS), categoria, cliente, nota, actualizado, eliminado, pendiente, cancelada, motivo, pack (clases), pack (id)` (no cambiarle el nombre ni mover las columnas).

> Si ya se había probado una versión anterior del script: pegar de nuevo el script nuevo y crear una **nueva versión** de la implementación (ver *Seguridad*). La hoja existente se actualiza sola (se agregan las columnas nuevas: *pendiente*, *cancelada*, *motivo* y las de *pack*). Si se había creado con la versión que todavía no tenía la columna *hora*, es más simple borrar la hoja *Movimientos* y dejar que se vuelva a crear: en la página, “Sincronizar ahora” vuelve a subir todo.

## Cómo funciona día a día
- Cada cambio se guarda primero en el dispositivo (instantáneo) y unos segundos después sube a la planilla.
- Sin señal en la cancha se sigue cargando normalmente: queda pendiente y sube cuando vuelve internet.
- Al abrir la página o volver a ella, se baja lo que se cargó en el otro dispositivo (también se revisa cada 2 minutos).
- Si dos dispositivos cambian el mismo movimiento, gana el cambio más reciente.
- Los movimientos borrados quedan en la planilla con **SI** en la columna *eliminado* (así el borrado llega al otro dispositivo). Se pueden ocultar con un filtro.
- Se puede corregir una fila a mano en la planilla: el cambio llega a la página. Mantener el formato de fecha `AAAA-MM-DD`, la hora como `HH:MM` (por ejemplo `14:33`) y el tipo `Ingreso` / `Egreso`. Lo más cómodo es editar desde la página.

## Seguridad
- Cualquiera que tenga **la URL y la clave** podría leer y escribir los datos. No compartirlas ni publicarlas. La URL y la clave **no están en el repositorio**: se escriben en cada dispositivo.
- Para cambiar la clave: cambiarla en el script, **Implementar → Administrar implementaciones → ✏ → Versión: Nueva versión → Implementar** (la URL no cambia) y volver a ponerla en la página de cada dispositivo.

## Si algo falla
| Mensaje | Qué hacer |
|---|---|
| “Clave incorrecta” | La clave de la página no es igual a la del script. |
| “Falta definir CLAVE en el script” | No se cambió `cambiar-esta-clave` (paso 2.3). |
| “La URL no respondió como se esperaba…” | En el paso 3 el acceso no quedó en *Cualquier persona*, o se copió una URL que no termina en `/exec`. |
| “No se pudo conectar” | Sin internet, o la URL está mal copiada. |
| Cambié el script y no se nota | Hay que crear una **nueva versión** de la implementación (ver Seguridad). |

# Publicar la página en GitHub Pages

1. Pasar los cambios a la rama principal (`main`) del repositorio.
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / carpeta `/ (root)` → Save**.
3. En un minuto la página queda en `https://waltercorvalan.github.io/tenis/`. Abrir ese link en el celular y agregarlo a la pantalla de inicio (en Chrome: ⋮ → *Agregar a pantalla principal*).

> GitHub Pages es gratis con repositorios públicos. En repositorios privados requiere un plan de pago de GitHub. Como el repositorio no contiene datos ni claves (solo el código), puede ser público sin problema.
