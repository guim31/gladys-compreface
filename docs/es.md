# CompreFace

Lleva el **reconocimiento facial local** de [CompreFace](https://github.com/exadel-inc/CompreFace)
(Exadel, código abierto) a las imágenes de sus cámaras: Gladys sabe quién está en el encuadre entre
las personas que usted ha enseñado a CompreFace, ve los rostros que no conoce y puede iniciar una
escena cuando alguien aparece. Todo se queda en su red: las imágenes van de la cámara a la
integración, luego a su servidor CompreFace, y a ningún otro sitio. CompreFace analiza una imagen bajo
demanda; no es un grabador de vídeo.

Probada con un servidor CompreFace real en Docker (`exadel/compreface:1.2.0`, CPU) y retratos de
dominio público (una persona añadida y luego reconocida en otra foto, desconocidos, un paisaje sin
rostro, una clave errónea, el servidor detenido), aún no con cámaras reales en servicio: sus
comentarios son bienvenidos en [GitHub](https://github.com/guim31/gladys-compreface/issues) o en el
foro de Gladys.

## Qué necesita

- Gladys 5.1 o posterior.
- Un servidor CompreFace, accesible desde Gladys en su puerto (8000 por defecto), con una aplicación y
  un servicio de tipo **Recognition**: su **clave de API** es lo que necesita la integración.
- Para cada cámara, una **URL de instantánea JPEG** (la mayoría de las cámaras IP tienen una, p. ej.
  `http://usuario:contraseña@192.168.1.30/snapshot.jpg`).

Una integración no puede leer la imagen de una cámara que ya está en Gladys (las integraciones
externas no tienen ese acceso): indique la dirección propia de la cámara.

## Instalación

1. Inicie CompreFace, por ejemplo la imagen todo en uno:
   `docker run -d --restart unless-stopped -p 8000:80 exadel/compreface:1.2.0` (necesita unos 2 GB de
   memoria y una CPU con AVX). Abra `http://<servidor>:8000`, cree su cuenta, una aplicación y luego
   un servicio **Recognition**, y copie su clave de API.
2. En Gladys, **Integraciones → Instalar desde GitHub**, dirección
   `https://github.com/guim31/gladys-compreface`.
3. En la configuración, rellene **Dirección de CompreFace** y la **Clave de API del servicio Recognition**, y para cada cámara
   (cuatro como máximo) un **Nombre** y una **Dirección de la instantánea**.
4. Ejecute la acción **Comprobar la conexión**: enumera las personas que CompreFace conoce y analiza
   cada cámara una vez.
5. Abra la pestaña **Descubrir** y añada las cámaras: un dispositivo por cámara.
6. Enseñe los rostros a CompreFace: en su propia interfaz (unas fotos por persona), o con la acción
   **Añadir un rostro**: colóquese solo(a) frente a una cámara, elíjala y escriba su nombre. De tres a
   cinco ejemplos por persona, con luces y ángulos distintos, dan los mejores resultados.

Ajustes:

- **Similitud mínima**: por debajo, un rostro cuenta como desconocido. 85 % es un buen comienzo;
  súbala si se confunden personas, bájela si personas conocidas aparecen como desconocidas.
- **Umbral de detección de rostros**: hasta qué punto CompreFace debe estar seguro de que una forma es
  un rostro (80 % por defecto).
- **Intervalo de análisis**: con qué frecuencia se analiza cada cámara añadida, una tras otra. **Solo
  bajo demanda** no analiza nada por sí mismo (acción de escena, botón del widget, imagen pedida por
  Gladys).
- **Idioma de los nombres**: nombres de las funciones y textos de las escenas.

**Carga de CPU**: cada análisis tarda alrededor de medio segundo en una CPU para una imagen 1080p.
Cuatro cámaras cada 5 segundos mantienen ocupada una máquina pequeña; 30 segundos es un comienzo
razonable.

## Los dispositivos en Gladys

Un dispositivo por cámara, con:

- **Imagen**: la última imagen analizada (reducida para Gladys).
- **Última persona reconocida**: el nombre de la última persona conocida vista, hasta que se reconoce
  otra.
- **Similitud (%)**: cuánto se parecía ese rostro a los ejemplos de la persona.
- **Reconocida el**: fecha y hora de ese reconocimiento.
- **Persona conocida**: una persona conocida está en el encuadre en el último análisis (Sí/No).
- **Rostro desconocido**: un rostro que nadie conoce está en el encuadre (Sí/No).
- **Rostros**: cuántos rostros hay en el encuadre.

La insignia del dispositivo pasa a «inaccesible» cuando no se puede leer la imagen de la cámara.

## Widget del panel

**Cámara CompreFace**: la imagen analizada, las personas en el encuadre con su similitud, el número de
rostros desconocidos, la última persona reconocida y cuándo, y un botón **Analizar ahora** (el ajuste
**Ocultar el botón Analizar** lo oculta).

## Escenas

### Disparadores

- **Persona reconocida por CompreFace**: una persona conocida aparece en un análisis regular (ausente
  del anterior), en una cámara o en cualquiera. Filtro por el nombre exacto de la persona (vacío:
  cualquiera). Variables: cámara, persona, similitud. Un evento cuando la persona aparece, no uno por
  análisis. Quien ya está en el encuadre cuando se añade el dispositivo, tras un reinicio o un cambio
  de ajustes no cuenta.
- **Rostro desconocido visto por CompreFace**: aparece un rostro que nadie conoce (ninguno en el
  análisis anterior). Variables: cámara, número de rostros desconocidos.
- **Imagen de cámara no leída**: no se pudo leer la imagen de una cámara (el primer fallo seguido).

Los disparadores provienen solo de los análisis regulares: con **Solo bajo demanda**, nunca se
disparan.

### Acciones

- **Reconocer los rostros de una cámara**: analiza la cámara ahora y actualiza su imagen. Salidas:
  persona conocida vista, persona más parecida, personas reconocidas, similitud, rostros
  desconocidos, rostros, resultado en palabras. No dispara ningún disparador.

### Ideas de escenas

- Cuando suena el timbre, **Reconocer los rostros de una cámara**, y luego enviar «{{resultado}} está
  en la puerta» con la acción «Enviar una imagen de cámara» del núcleo.
- **Persona reconocida por CompreFace** (un niño, cámara de la entrada) una tarde de colegio →
  notificación «ha llegado a casa».
- **Rostro desconocido visto por CompreFace** con la alarma activada → notificación con la imagen.

## Privacidad

Los rostros son datos biométricos. La integración envía las imágenes de las cámaras solo al servidor
CompreFace configurado, en su red, y no guarda nada en disco: la última imagen de cada cámara queda en
memoria. Los rostros y los ejemplos viven en la base de datos de CompreFace. Informe a las personas que
viven con usted o le visitan de que sus rostros se analizan, y respete la ley de su país sobre la
grabación de personas.

## Solución de problemas

- **CompreFace no responde**: compruebe la dirección y el puerto (8000), y que cada contenedor de
  CompreFace funciona (`docker logs`); el primer arranque tarda unos minutos.
- **CompreFace rechaza la clave de API**: copie la clave de un servicio **Recognition**, no de un
  servicio Detection o Verification.
- **Imagen no leída**: abra la dirección de la cámara en un navegador desde la máquina de Gladys: debe
  dar una imagen JPEG, no una página. La autenticación Digest no está soportada.
- **Personas conocidas aparecen como desconocidas**: añada más ejemplos (luces y ángulos distintos), o
  baje la **Similitud mínima**.
- **Añadir un rostro** no encuentra ningún rostro: acérquese, frente a la cámara, con suficiente luz.
- Registros detallados: `LOG_LEVEL=debug`.

## Límites

- Cuatro cámaras como máximo.
- La dirección de la cámara, contraseña incluida, y la clave de API se guardan en la configuración de
  la integración, visibles para los administradores de Gladys: prefiera un usuario de cámara que solo
  pueda ver.
- Sin vídeo: una imagen por análisis; una persona que pasa entre dos análisis no se ve.
- Las imágenes de las cámaras van a Gladys como máximo cada 5 segundos por cámara.
- Sin afiliación con Exadel ni con el proyecto CompreFace. Desarrollada sin cámaras reales: sus
  comentarios son bienvenidos.
