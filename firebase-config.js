// ============================================================
// CONFIGURACIÓN DE FIREBASE — Agenda Serrano
// ============================================================
// 1. Ve a https://console.firebase.google.com → crea un proyecto
// 2. Dentro del proyecto: "Compilación" → Firestore Database → crear
//    base de datos (modo producción, región la más cercana, ej. us-east1)
// 3. Dentro del proyecto: "Compilación" → Authentication → "Comenzar"
//    → habilita el proveedor "Correo electrónico/contraseña"
// 4. En Authentication → Users, crea manualmente una cuenta por cada
//    persona que vaya a usar la app (correo + contraseña)
// 5. Ve a ⚙️ Configuración del proyecto → General → baja hasta
//    "Tus apps" → agrega una app web (</>) → copia el objeto
//    firebaseConfig que te muestra Firebase y pégalo abajo,
//    reemplazando TODO este objeto de ejemplo.
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDhpCOdm0JUkJmSqmM4sPv6-4UpMFduuXw",
  authDomain: "agenda-serrano.firebaseapp.com",
  projectId: "agenda-serrano",
  storageBucket: "agenda-serrano.firebasestorage.app",
  messagingSenderId: "136272243663",
  appId: "1:136272243663:web:eb893067b09cea23bdc0ba"
};

// Nota de seguridad: estas claves NO son secretas — Firebase está
// diseñado para que este objeto sea público en el navegador. Lo que
// protege tus datos son las Reglas de seguridad de Firestore
// (archivo firestore.rules de este proyecto), no este archivo.
