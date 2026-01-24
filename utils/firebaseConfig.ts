import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias dos serviços que vamos usar
export const db = getFirestore(app);
export const storage = getStorage(app);
