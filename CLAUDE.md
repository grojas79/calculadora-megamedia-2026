# Creador de Propuestas (Calculadora Megamedia 2026)

Responder siempre en español. Los mensajes de commit también van en español, en infinitivo
y describiendo el cambio (ej. "Parear por nombre, plataformas y alcance…").

## Proyecto

- `Creador de Propuestas.html`: toda la aplicación (HTML + CSS + JS en un solo archivo, sin build
  ni dependencias). Catálogo de formatos, calculadora de propuestas e importación de pautas Excel.
  Es la única copia: no hay archivos espejo que sincronizar.
- `api/propuestas.js`: función serverless de Vercel que lee/escribe el registro compartido de
  propuestas en Supabase (tabla `propuestas`, ver `supabase/propuestas.sql`).
- `assets/`: logos de plataformas.
- Los `.xlsx` y `(CSV)*.csv` de la raíz son pautas de ejemplo y no se versionan.

## Publicación

Vercel (proyecto `calculadora-megamedia-2026`) publica automáticamente desde GitHub con la raíz
del repo como Root Directory. `vercel.json` sirve `Creador de Propuestas.html` en `/` y
`.vercelignore` deja fuera los archivos de trabajo.

## Pauta Excel e importación de formatos

### El Excel manda sobre el catálogo

Al importar una pauta o al crear/actualizar un formato a partir de un Excel, usar siempre
las **plataformas**, **alcances** e **impresiones** que vienen del Excel, no los del catálogo.

- Plataformas: las del Excel reemplazan a las del catálogo (altas y bajas), conservando el nombre tal como viene.
- Impresiones por plataforma: usar la columna de impresiones por fila (`IMPRESIONES`), no `IMPACTOS TOTALES`
  (es el total × cantidad y suele venir en celda mergeada solo en la primera fila).
- Cantidad: viene de `CANTIDAD`; las impresiones del formato son por unidad.
- Formatos Web/Display (`cat.id==='web'`): se calculan con `s.webPlats` (plataforma web + impresiones por línea),
  no con `s.pautaPlats`. Mapear las plataformas del Excel a `WEB_PLATAFORMAS` (ver `pautaWebPlatsFromEntry`).
- CPM de formatos web (y Display/Paid Media LS): inversión = impresiones × CPM ÷ 1.000. Si el Excel trae
  columna `CPM` (por fila o por plataforma) se usa ese CPM; si no trae CPM pero sí inversión (`VALOR BRUTO`,
  `INVERSIÓN`; o si no, `INV. NETA FINAL`), CPM = inversión × 1.000 ÷ (impresiones × cantidad)
  (`derivePautaCpmFromInv`); si no hay ninguno, el CPM por defecto del catálogo (`f.precio`).
  Sin impresiones en el Excel se usan las impresiones por defecto del formato.
- Temática / descripción: la columna suele llamarse `CALL TO ACTION /TEMÁTICA A TRATAR` (también
  `TEMÁTICA` o `DESCRIPCIÓN`); `detectPautaHeaderMap` la reconoce por contener "temática" o "descripción".
  Al importar, esa temática reemplaza la descripción del formato elegido solo en esa propuesta
  (`s.descCustom` en `stampPautaEntryOnFmt`), sin tocar el catálogo.
- El catálogo solo rellena lo que el Excel no trae (por ejemplo, repartir un total mergeado entre plataformas).

Ejemplo (fila "Corte react digital", cantidad 4, total 208.000):

```js
pautaPlats:[
  {plat:'Instagram Mega',alc:30000},
  {plat:'Facebook Mega',alc:10000},
  {plat:'Shorts Mega',alc:2000},
  {plat:'TikTok Mega',alc:10000}
] // imp: 52000 por unidad
```

### Pareo de formatos

- El nombre del formato manda. Plataformas y alcance desempatan y, si no calzan, el pareo pide confirmación
  con las alternativas más cercanas (`pautaWeightedScore`, `pautaCandidateFirm`).
- Si falta o sobra una plataforma, la propuesta usa las del Excel (altas y bajas) sin crear un formato nuevo.
- El nombre visible de esa propuesta pasa a ser el del Excel (`nameOverride`). Un formato nuevo solo se crea
  si el nombre y la descripción no se parecen a ninguno del catálogo.
- Columnas que contienen "tipo" pero no son el formato (ej. `TIPO AUSPICIO`) no deben mapearse a `TIPO DE CONTENIDO`.
- Ids que empiezan con `vod_` se tratan como Vodcast y `prog_corte_` oculta el campo "Nombre del Programa".

### Sección React

- Todo formato cuyo nombre visible o id contiene "react" (`isReactRow`) va en secciones React propias,
  justo antes de Web, en la tabla de resultados, el Excel y el PDF, aunque tenga etapa o sea de Live Shopping.
- Una sección por programa ("React Detrás del Muro", `reactSectionsByProgram`): primero el React del programa
  y debajo sus derechos (corte react, auspicio, dinámica). El programa se compara sin mayúsculas ni tildes.
- Puede haber varios React por propuesta: al importar, el nombre del Excel separa instancias
  (`pautaInstanceKeyFromEntry`) y el programa se toma del nombre ("React VCTEx2" → "VCTEx2", `reactProgFromName`);
  a mano, con el botón "+ Agregar otro … para otro programa" (`agregarOtroReact`).
- La presencia de marca del Excel se guarda por formato en `s.marcaCustom` y se lee con `fmtMarca`.
- Todo React muestra el campo "Nombre del Programa" y es obligatorio: Excel y PDF no se generan si falta
  (`validarObligatorios`, que también exige el programa o bloque horario de DAI Tanda Programa).
  Al faltar un dato, `irACampoObligatorio` abre el formato, lleva al campo, lo marca en rojo y deja el cursor listo. Su Medio en Excel/PDF es "React [programa]" (ej. "React Detrás del Muro").

### Alcance (Sainsbury en dos niveles)

- Alcance por salida = impresiones ÷ frecuencia (1,2 RRSS; 1,3 Web).
- Nivel 1: Sainsbury dentro de cada plataforma (todas las repeticiones y formatos) con el universo de la cuenta
  (`PLAT_UNIVERSO`, followers; clave red|marca de `platUniversoKey`, Shorts = YouTube).
- Nivel 2: Sainsbury entre plataformas con `U_SAINSBURY` (universo digital).
- Plataformas sin universo propio (Facebook, web, radios, cuentas combinadas u otras marcas) usan `U_SAINSBURY`.

### DAI

- Hay 3 formatos DAI en Web: DAI SEV (`dai_sev`, genérico, CPM 5.500), DAI Tanda Programa
  (`dai_programa`, CPM 10.000) y DAI Mega Go (`dai_megago`, CPM 12.000).
- Si el Excel dice solo "DAI", pedir al usuario que elija el DAI, con DAI SEV como recomendado.
- DAI Tanda Programa pide programa o bloque horario.
