// -----------------------------------------------------------------------------
// Texts the integration sends to Gladys outside the widget (src/widgets.js):
// connection status, action messages and failures, the "Check the
// connection" report. Four languages, the four of the Gladys interface;
// German says "du", Spanish "usted". test/i18n.test.js checks every table.
// -----------------------------------------------------------------------------

/**
 * A failure shown in red by Gladys: the message is the multi-language object
 * (a returned value is shown in green, a thrown one in red).
 */
export class ActionFailure extends Error {
  constructor(text) {
    super(text.en);
    this.name = 'ActionFailure';
    this.message = text;
  }
}

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

// Shown by Gladys under the integration name when it is not connected.
export const CONNECTION_TEXT = {
  noUrl: {
    en: 'Enter the address of your CompreFace server (e.g. 192.168.1.20, port 8000 by default) in the configuration.',
    fr: "Saisissez l'adresse de votre serveur CompreFace (ex. 192.168.1.20, port 8000 par défaut) dans la configuration.",
    de: 'Gib die Adresse deines CompreFace-Servers (z. B. 192.168.1.20, standardmäßig Port 8000) in der Konfiguration ein.',
    es: 'Introduzca la dirección de su servidor CompreFace (p. ej. 192.168.1.20, puerto 8000 por defecto) en la configuración.',
  },
  noKey: {
    en: 'Enter the API key of a CompreFace recognition service in the configuration.',
    fr: "Saisissez la clé d'API d'un service de reconnaissance CompreFace dans la configuration.",
    de: 'Gib den API-Schlüssel eines CompreFace-Erkennungsdienstes in der Konfiguration ein.',
    es: 'Introduzca la clave de API de un servicio de reconocimiento de CompreFace en la configuración.',
  },
  auth: {
    en: 'CompreFace refuses the API key: copy the key of a Recognition service (not Detection or Verification).',
    fr: "CompreFace refuse la clé d'API : copiez la clé d'un service Recognition (pas Detection ni Verification).",
    de: 'CompreFace lehnt den API-Schlüssel ab: Kopiere den Schlüssel eines Recognition-Dienstes (nicht Detection oder Verification).',
    es: 'CompreFace rechaza la clave de API: copie la clave de un servicio Recognition (no Detection ni Verification).',
  },
  unreachable: {
    en: 'CompreFace does not answer at this address.',
    fr: 'CompreFace ne répond pas à cette adresse.',
    de: 'CompreFace antwortet unter dieser Adresse nicht.',
    es: 'CompreFace no responde en esta dirección.',
  },
  error: {
    en: 'Something answers, but not like CompreFace: check the address and port, and the logs.',
    fr: "Quelque chose répond, mais pas comme CompreFace : vérifiez l'adresse, le port et les logs.",
    de: 'Etwas antwortet, aber nicht wie CompreFace: Prüfe Adresse, Port und die Protokolle.',
    es: 'Algo responde, pero no como CompreFace: compruebe la dirección, el puerto y los registros.',
  },
};

// Failures of an analysis asked by the user or a scene (thrown: shown in red).
export const FAILURE = {
  notConfigured: {
    en: 'The CompreFace server is not configured or does not answer.',
    fr: "Le serveur CompreFace n'est pas configuré ou ne répond pas.",
    de: 'Der CompreFace-Server ist nicht konfiguriert oder antwortet nicht.',
    es: 'El servidor CompreFace no está configurado o no responde.',
  },
  pickCamera: {
    en: 'Choose a camera.',
    fr: 'Choisissez une caméra.',
    de: 'Wähle eine Kamera aus.',
    es: 'Elija una cámara.',
  },
  pickName: {
    en: 'Enter the name of the person (100 characters at most).',
    fr: 'Saisissez le nom de la personne (100 caractères au plus).',
    de: 'Gib den Namen der Person ein (höchstens 100 Zeichen).',
    es: 'Introduzca el nombre de la persona (100 caracteres como máximo).',
  },
  unknownCamera: {
    en: 'This camera is no longer in the CompreFace configuration.',
    fr: "Cette caméra n'est plus dans la configuration CompreFace.",
    de: 'Diese Kamera ist nicht mehr in der CompreFace-Konfiguration.',
    es: 'Esta cámara ya no está en la configuración de CompreFace.',
  },
  camera: {
    en: 'The camera image could not be read: check its address, user and password.',
    fr: "L'image de la caméra n'a pas pu être lue : vérifiez son adresse, l'utilisateur et le mot de passe.",
    de: 'Das Kamerabild konnte nicht gelesen werden: Prüfe Adresse, Benutzer und Passwort.',
    es: 'No se pudo leer la imagen de la cámara: compruebe su dirección, usuario y contraseña.',
  },
  auth: CONNECTION_TEXT.auth,
  server: {
    en: 'CompreFace did not answer, or not in time: check the server and its logs.',
    fr: "CompreFace n'a pas répondu, ou pas à temps : vérifiez le serveur et ses logs.",
    de: 'CompreFace hat nicht oder nicht rechtzeitig geantwortet: Prüfe den Server und seine Protokolle.',
    es: 'CompreFace no respondió, o no a tiempo: compruebe el servidor y sus registros.',
  },
  noFace: {
    en: 'No face in the camera image: stand facing the camera, close enough, and try again.',
    fr: "Aucun visage sur l'image de la caméra : placez-vous face à la caméra, assez près, et réessayez.",
    de: 'Kein Gesicht im Kamerabild: Stell dich nah genug vor die Kamera und versuche es erneut.',
    es: 'Ningún rostro en la imagen de la cámara: colóquese frente a la cámara, lo bastante cerca, y vuelva a intentarlo.',
  },
  manyFaces: {
    en: 'Several faces in the camera image: only the person to add must be in view.',
    fr: "Plusieurs visages sur l'image de la caméra : seule la personne à ajouter doit être dans le champ.",
    de: 'Mehrere Gesichter im Kamerabild: Nur die hinzuzufügende Person darf im Bild sein.',
    es: 'Varios rostros en la imagen de la cámara: solo la persona que se va a añadir debe estar en el encuadre.',
  },
};

/** The message of a successful analysis ("Front door: Alice (97 %)"). */
export function analysisMessage(name, text) {
  return `${name}: ${text}`.slice(0, 200);
}

/** The face added to a person. */
export function faceAdded(subject, isNew, camera) {
  return isNew
    ? {
        en: `${subject} added to CompreFace with the face seen by ${camera}.`,
        fr: `${subject} ajouté(e) à CompreFace avec le visage vu par ${camera}.`,
        de: `${subject} mit dem von ${camera} gesehenen Gesicht zu CompreFace hinzugefügt.`,
        es: `${subject} añadido(a) a CompreFace con el rostro visto por ${camera}.`,
      }
    : {
        en: `New example of ${subject} added, from ${camera}.`,
        fr: `Nouvel exemple de ${subject} ajouté, depuis ${camera}.`,
        de: `Neues Beispiel von ${subject} hinzugefügt, von ${camera}.`,
        es: `Nuevo ejemplo de ${subject} añadido, desde ${camera}.`,
      };
}

const MAX_LISTED = 4;
const MAX_PEOPLE = 10;

// The pieces of the "Check the connection" report, one table per language.
export const CHECK_TEXT = {
  en: {
    connected: (url, count) => `CompreFace answers at ${url}, ${count} known person(s).`,
    people: (list) => `Known: ${list}.`,
    nobody: 'Nobody known yet: add faces (action below, or the CompreFace interface).',
    camera: (name, text) => `- ${name}: ${text}`,
    failed: 'image not read',
    noCamera: 'No camera configured yet.',
  },
  fr: {
    connected: (url, count) => `CompreFace répond à ${url}, ${count} personne(s) connue(s).`,
    people: (list) => `Connues : ${list}.`,
    nobody:
      "Personne de connu pour l'instant : ajoutez des visages (action ci-dessous, ou l'interface de CompreFace).",
    camera: (name, text) => `- ${name} : ${text}`,
    failed: 'image non lue',
    noCamera: 'Aucune caméra configurée pour le moment.',
  },
  de: {
    connected: (url, count) => `CompreFace antwortet unter ${url}, ${count} bekannte Person(en).`,
    people: (list) => `Bekannt: ${list}.`,
    nobody:
      'Noch niemand bekannt: Füge Gesichter hinzu (Aktion unten oder die CompreFace-Oberfläche).',
    camera: (name, text) => `- ${name}: ${text}`,
    failed: 'Bild nicht gelesen',
    noCamera: 'Noch keine Kamera konfiguriert.',
  },
  es: {
    connected: (url, count) => `CompreFace responde en ${url}, ${count} persona(s) conocida(s).`,
    people: (list) => `Conocidas: ${list}.`,
    nobody:
      'Aún no hay nadie conocido: añada rostros (acción de abajo, o la interfaz de CompreFace).',
    camera: (name, text) => `- ${name}: ${text}`,
    failed: 'imagen no leída',
    noCamera: 'Aún no hay ninguna cámara configurada.',
  },
};

/**
 * The report of the "Check the connection" action, in the four languages.
 * @param {{ url: string, subjects: string[],
 *   cameras: Array<{ name: string, text?: Record<string, string>, failed?: boolean }> }} report
 */
export function checkMessage(report) {
  const message = {};
  for (const [language, text] of Object.entries(CHECK_TEXT)) {
    const lines = [text.connected(report.url, report.subjects.length)];
    if (report.subjects.length > 0) {
      const shown = report.subjects.slice(0, MAX_PEOPLE).join(', ');
      lines.push(text.people(report.subjects.length > MAX_PEOPLE ? `${shown}…` : shown));
    } else {
      lines.push(text.nobody);
    }
    if (report.cameras.length === 0) {
      lines.push(text.noCamera);
    }
    for (const camera of report.cameras.slice(0, MAX_LISTED)) {
      lines.push(text.camera(camera.name, camera.failed ? text.failed : camera.text[language]));
    }
    message[language] = lines.join('\n');
  }
  return message;
}
