# Agenda y caja · Clases de tenis

Sistema simple para un entrenador de tenis: **calendario** + **ingresos y egresos por día**, con resumen semanal, mensual y anual.

## Cómo usarlo

Abrir `index.html` en el navegador (doble clic). No necesita instalar nada ni conexión a internet.

- **Calendario**: cada día muestra lo cobrado (verde) y lo gastado (rojo). Tocar un día para ver su detalle y cargar un **ingreso** (clase cobrada) o un **egreso** (cancha, pelotas, transporte…).
- **Resumen**: ingresos, egresos y balance por **semana / mes / año**, gráfico día por día, **ranking de clientes que más ingresos dejan** y en qué se gasta.
- **Copia ⋯**: descargar/restaurar copia de seguridad (JSON), exportar a Excel (CSV) o borrar todo.

## Dónde se guardan los datos

- Siempre **en el navegador del dispositivo** (así abre rápido y funciona sin señal).
- Opcional, recomendado: **Google Sheets** en la cuenta del entrenador. Se sincroniza solo entre celular y computadora y los datos se pueden abrir como planilla. Pasos en [`LEEME-NUBE.md`](LEEME-NUBE.md) (también explica cómo publicar la página en GitHub Pages).
- Todo en **pesos argentinos (ARS)**.

Conviene igual descargar una copia de seguridad de vez en cuando (menú “Copia ⋯”).

## Archivos

- `index.html` – estructura
- `styles.css` – estilos (claro/oscuro automático, adaptado a celular)
- `app.js` – lógica y sincronización
- `apps-script/Codigo.gs` – script de Google que conecta con la planilla
- `LEEME-NUBE.md` – guía de configuración
