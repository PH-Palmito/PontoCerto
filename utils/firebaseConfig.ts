import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 1. Importações de Autenticação
import {
  initializeAuth,
  getAuth,
  // @ts-ignore: Ignora erro de tipagem caso a versão do TS não encontre a definição
  getReactNativePersistence
} from "firebase/auth";

import AsyncStorage from "@react-native-async-storage/async-storage";

// Suas credenciais oficiais
const firebaseConfig = {
  apiKey: "AIzaSyD6_1KzK42O0K9dKCkDF8vLNHvJnbgutIM",
  authDomain: "pontocerto-8d014.firebaseapp.com",
  projectId: "pontocerto-8d014",
  storageBucket: "pontocerto-8d014.firebasestorage.app",
  messagingSenderId: "806750010479",
  appId: "1:806750010479:web:c085a5368d8df0d33e219a",
  measurementId: "G-ZM8XWD00EB"
};

// Inicializa o App
const app = initializeApp(firebaseConfig);

// 2. Inicializa Auth com persistência e tipagem 'any' para evitar bloqueios
let auth: any;

try {
  // Tenta inicializar a persistência com AsyncStorage
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  // Se falhar (ex: já inicializado no hot-reload), pega a instância existente
  auth = getAuth(app);
}

// Inicializa banco e storage
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };