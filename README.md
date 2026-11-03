# Agenda y caja · Clases de tenis

Sistema simple para un entrenador de tenis: **calendario** + **ingresos y egresos por día**, con resumen semanal, mensual y anual.

## Cómo usarlo

Abrir `index.html` en el navegador (doble clic). No necesita instalar nada ni conexión a internet.

- **En el celular**: al tocar un día, el detalle y la agenda suben desde abajo (se cierran con ✕ o tocando el fondo), sin tener que hacer scroll. El formulario para cargar un ingreso o egreso también sube desde abajo, como en Android, y se cierra bajándolo con el dedo. Se puede instalar como app (ver `LEEME-NUBE.md`).
- **Calendario**: cada día muestra lo cobrado (verde) y lo gastado (oscuro). Tocar un día (o moverse con las flechas del teclado) para ver su **agenda con horarios** y cargar un **ingreso** (clase cobrada) o un **egreso** (cancha, pelotas, transporte…).
- **Horarios**: cada movimiento puede llevar cualquier hora (06:30, 07:30, 14:33…). La agenda del día se ordena sola por horario. Con “Guardar y agregar otra clase” se sugiere la hora siguiente (1 h después).
- **Pendiente de cobro**: al cargar una clase se puede tildar “Todavía no me pagó”. No suma a los ingresos hasta marcarla como cobrada; mientras tanto aparece como **Por cobrar** (en el calendario, en la agenda del día y en el Resumen, con el total que debe cada cliente).
- **Clases canceladas y reprogramadas**: una clase se puede marcar como *Cancelada* (con motivo: lluvia, faltó el alumno…). Queda en la agenda tachada y no suma plata. Con **Reprogramar** la clase original queda como cancelada y se crea la nueva en otra fecha/hora. El Resumen muestra cuántas se cancelaron, por qué y cuánta plata no se cobró.
- **Packs / abonos**: el alumno paga un pack (por ejemplo 8 clases) como ingreso con categoría “Pack de clases”. Después, al cargar una clase de ese alumno, se ofrece **descontar de su pack** (“quedan 5 de 8”) y esa clase no vuelve a sumar plata. El Resumen lista los packs con clases por usar y avisa cuándo hay que renovar.
- **Meta mensual**: se define desde el menú “Opciones ⋯” o desde el Resumen. Muestra una barra con lo cobrado (y lo que falta por cobrar) y cuántas clases más hacen falta para llegar. La meta se guarda en cada dispositivo y va en la copia de seguridad.
- **Aviso de clases que se pisan**: al cargar una clase avisa si ya hay otra ese día a la misma hora o a menos de 1 hora.
- **Resumen**: ingresos, egresos y balance por **semana / mes / año**, gráfico día por día, **ranking de clientes que más ingresos dejan**, en qué se gasta y **horarios y días con más clases**.
- **Modo claro / oscuro**: botón con sol o luna en el encabezado. Recuerda la elección; en el menú “Opciones ⋯” se puede volver al modo automático (el del celular).
- **Opciones ⋯**: descargar/restaurar copia de seguridad (JSON), exportar a Excel (CSV) o borrar todo.

## Dónde se guardan los datos

- Siempre **en el navegador del dispositivo** (así abre rápido y funciona sin señal).
- Opcional, recomendado: **Google Sheets** en la cuenta del entrenador. Se sincroniza solo entre celular y computadora y los datos se pueden abrir como planilla. Pasos en [`LEEME-NUBE.md`](LEEME-NUBE.md): se pega un script en la planilla, se publica, y en la página solo se pega la URL (la clave se genera sola). También explica cómo publicar la página en GitHub Pages.
- Todo en **pesos argentinos (ARS)**.

Conviene igual descargar una copia de seguridad de vez en cuando (menú “Opciones ⋯”).

## Archivos

- `index.html` – estructura
- `styles.css` – estilos (arcilla y líneas de cancha; claro/oscuro automático; adaptado a celular)
- `fonts/` – tipografías Barlow y Barlow Condensed (licencia SIL OFL), incluidas para que funcione sin internet
- `app.js` – lógica y sincronización
- `sw.js`, `manifest.webmanifest`, `icons/` – para instalarla como app y que abra al instante y sin señal
- `apps-script/Codigo.gs` – script de Google que conecta con la planilla
- `LEEME-NUBE.md` – guía de configuración
