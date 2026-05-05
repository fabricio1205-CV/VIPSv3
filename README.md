# Casa Victor - Seguimiento VIP

Versión MVP en HTML, CSS y JavaScript puro.

## Qué hace

- Login por usuario + PIN
- Perfil vendedor y perfil administrador
- Lectura de base desde CSV
- Soporta meses en texto: Enero, Febrero, Marzo, etc.
- Marca en rojo los clientes con venta en 0 o menor
- Exige motivo obligatorio en esos casos
- Guarda feedback en `localStorage`
- Habilita **Enviar Informe** cuando no quedan pendientes
- Permite refrescar la base semanalmente con un botón

## Cómo actualizar la base cada semana

Tenés dos opciones:

### Opción 1: reemplazar el archivo local
1. Guardá el nuevo CSV con el nombre `vips de prueba.csv`
2. Reemplazalo dentro de `/data`
3. Subí los cambios a GitHub o Netlify
4. En la app, apretá **Actualizar base desde CSV**

### Opción 2: leerlo desde GitHub Raw
1. Subí el CSV a tu repositorio
2. Copiá la URL raw pública
3. Pegala en `config.js` dentro de `remoteCsvUrl`
4. Dejá `baseCsvPath` como respaldo
5. Apretá **Actualizar base desde CSV**

Ejemplo:

```js
window.APP_CONFIG = {
  mode: 'mock',
  appsScriptUrl: '',
  baseCsvPath: 'data/vips de prueba.csv',
  remoteCsvUrl: 'https://raw.githubusercontent.com/USUARIO/REPO/main/data/vips%20de%20prueba.csv'
};
```

## Formato del CSV

La app soporta separador `;` o `,`.

Columnas esperadas:

- CLIENTE
- VENDEDOR
- NOMBRE ALTERNATIVO (opcional)
- Fx Compra 2025
- Status 2025
- VALUE $
- MES
- AÑO

### Mes
Puede venir como:
- Enero
- Febrero
- Marzo
- etc.

También soporta 1, 2, 3, etc., pero ya está preparado para texto.

### Vendedor
La app convierte automáticamente:
- Paola / Paola Balado -> Paola Balado
- Tucu / Dario Lopez -> Dario Lopez
- Gaston / Gaston Rodriguez -> Gaston Rodriguez
- Diego / Diego Daniel Ponce -> Diego Daniel Ponce
- Martin / Martin Aguilar -> Martin Aguilar
- Leandro / Leandro del Hoyo -> Leandro del Hoyo

## Cómo probarlo

### Local
Abrí `index.html` con Live Server o subilo a Netlify/GitHub Pages.

### Usuarios
- Fabricio / 12051205
- Seba / 1207
- Paola / 1201
- Tucu / 1202
- Gaston / 1203
- Diego / 1204
- Martin / 1205
- Leandro / 1206

## Próximo paso
Cuando lo quieras dejar productivo, el paso correcto es conectar el guardado a Google Sheets + Apps Script.
