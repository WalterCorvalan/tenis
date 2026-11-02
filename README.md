# Agenda y caja · Clases de tenis

Sistema simple para un entrenador de tenis: **calendario** + **ingresos y egresos por día**, con resumen semanal, mensual y anual.

## Cómo usarlo

Abrir `index.html` en el navegador (doble clic). No necesita instalar nada ni conexión a internet.

- **Calendario**: cada día muestra lo cobrado (verde) y lo gastado (oscuro). Tocar un día (o moverse con las flechas del teclado) para ver su **agenda con horarios** y cargar un **ingreso** (clase cobrada) o un **egreso** (cancha, pelotas, transporte…).
- **Horarios**: cada movimiento puede llevar cualquier hora (06:30, 07:30, 14:33…). La agenda del día se ordena sola por horario. Con “Guardar y agregar otra clase” se sugiere la hora siguiente (1 h después).
- **Pendiente de cobro**: al cargar una clase se puede tildar “Todavía no me pagó”. No suma a los ingresos hasta marcarla como cobrada; mientras tanto aparece como **Por cobrar** (en el calendario, en la agenda del día y en el Resumen, con el total que debe cada cliente).
- **Aviso de clases que se pisan**: al cargar una clase avisa si ya hay otra ese día a la misma hora o a menos de 1 hora.
- **Resumen**: ingresos, egresos y balance por **semana / mes / año**, gráfico día por día, **ranking de clientes que más ingresos dejan**, en qué se gasta y **horarios y días con más clases**.
- **Modo claro / oscuro**: botón con sol o luna en el encabezado. Recuerda la elección; en el menú “Copia ⋯” se puede volver al modo automático (el del celular).
- **Copia ⋯**: descargar/restaurar copia de seguridad (JSON), exportar a Excel (CSV) o borrar todo.

## Dónde se guardan los datos

- Siempre **en el navegador del dispositivo** (así abre rápido y funciona sin señal).
- Opcional, recomendado: **Google Sheets** en la cuenta del entrenador. Se sincroniza solo entre celular y computadora y los datos se pueden abrir como planilla. Pasos en [`LEEME-NUBE.md`](LEEME-NUBE.md) (también explica cómo publicar la página en GitHub Pages).
- Todo en **pesos argentinos (ARS)**.

Conviene igual descargar una copia de seguridad de vez en cuando (menú “Copia ⋯”).

## Archivos

- `index.html` – estructura
- `styles.css` – estilos (arcilla y líneas de cancha; claro/oscuro automático; adaptado a celular)
- `fonts/` – tipografías Barlow y Barlow Condensed (licencia SIL OFL), incluidas para que funcione sin internet
- `app.js` – lógica y sincronización
- `apps-script/Codigo.gs` – script de Google que conecta con la planilla
- `LEEME-NUBE.md` – guía de configuración
