# Agenda y caja · Clases de tenis

Sistema simple para un entrenador de tenis: **calendario** + **ingresos y egresos por día**, con resumen semanal, mensual y anual.

## Cómo usarlo

Abrir `index.html` en el navegador (doble clic). No necesita instalar nada ni conexión a internet.

- **Calendario**: cada día muestra lo cobrado (verde) y lo gastado (rojo). Tocar un día para ver su detalle y cargar un **ingreso** (clase cobrada) o un **egreso** (cancha, pelotas, transporte…).
- **Resumen**: ingresos, egresos y balance por **semana / mes / año**, gráfico día por día, **ranking de clientes que más ingresos dejan** y en qué se gasta.
- **Copia ⋯**: descargar/restaurar copia de seguridad (JSON), exportar a Excel (CSV) o borrar todo.

## Importante

Los datos se guardan **en el navegador de ese dispositivo** (localStorage). No se sincronizan entre celular y computadora: para pasar los datos, descargar una copia y restaurarla en el otro dispositivo. Conviene descargar una copia de vez en cuando.

## Archivos

- `index.html` – estructura
- `styles.css` – estilos (claro/oscuro automático, adaptado a celular)
- `app.js` – lógica
