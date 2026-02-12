import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../utils/firebaseConfig"; // Ajuste o caminho se necessário

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Não logado -> Vai para Login
        router.replace("/login");
        setLoading(false);
      } else {
        // Logado -> Verifica se já tem empresa configurada
        try {
          const docRef = doc(db, "empresas", "config_geral"); // Em produção use user.uid
          const docSnap = await getDoc(docRef);

          if (docSnap.exists() && docSnap.data().empresa?.nome) {
            // Tudo configurado -> Vai para o App (Tabs)
            router.replace("/(tabs)/registro"); // ou a tela inicial que preferir
          } else {
            // Falta configurar -> Vai para o Guia
            router.replace("/setup");
          }
        } catch (e) {
          console.error("Erro ao verificar configuração", e);
          // Fallback seguro
          router.replace("/(tabs)/registro");
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#2927B4" }}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}