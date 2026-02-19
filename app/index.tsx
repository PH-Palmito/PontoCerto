import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../utils/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorageKeys } from '../utils/storage';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setSenha] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const storedUid = await AsyncStorage.getItem('@last_uid');

      if (storedUid && storedUid !== user.uid) {
        await AsyncStorage.clear();
      }

      await AsyncStorage.setItem('@last_uid', user.uid);

      const docRef = doc(db, "empresas", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const keys = getStorageKeys(user.uid);

        if (data.empresa) {
          await AsyncStorage.setItem(
            keys.empresa,
            JSON.stringify(data.empresa)
          );
        }

        if (Array.isArray(data.funcionarios)) {
          await AsyncStorage.setItem(
            keys.funcionarios,
            JSON.stringify(data.funcionarios)
          );
        }

        if (Array.isArray(data.feriados)) {
          await AsyncStorage.setItem(
            keys.feriados,
            JSON.stringify(data.feriados)
          );
        }

        router.replace('/(tabs)/home');
      } else {
        router.replace('/setup');
      }

    } catch (e) {
      console.error("Erro ao carregar dados:", e);
      setLoading(false);
    }
  });

  return unsubscribe;
}, []);


  const handleAuth = async () => {
    if (!email || !password) {
      return Alert.alert("Erro", "Preencha e-mail e senha");
    }

    setLoading(true);

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // redirecionamento ocorre via onAuthStateChanged
    } catch (error: any) {
      let msg = error.message;

      if (error.code === 'auth/email-already-in-use') msg = "E-mail já cadastrado.";
      if (error.code === 'auth/invalid-email') msg = "E-mail inválido.";
      if (error.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
      if (error.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";

      Alert.alert("Atenção", msg);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#2927B4' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#2927B4', '#12114E']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <View style={styles.header}>
          <Ionicons name="time" size={80} color="#fff" />
          <Text style={styles.title}>Ponto Certo</Text>
          <Text style={styles.subtitle}>Gestão de Ponto Inteligente</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isRegistering ? 'Criar Conta' : 'Acessar Totem'}
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              value={password}
              onChangeText={setSenha}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleAuth}>
            <Text style={styles.buttonText}>
              {isRegistering ? 'CADASTRAR' : 'ENTRAR'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsRegistering(!isRegistering)}
            style={styles.switchButton}
          >
            <Text style={styles.switchText}>
              {isRegistering
                ? 'Já tem conta? Faça Login'
                : 'Não tem conta? Crie agora'}
            </Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  subtitle: { fontSize: 16, color: '#ccd6f6', marginTop: 5 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 30, elevation: 10 },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
    paddingBottom: 5
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  button: {
    backgroundColor: '#2927B4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
    padding: 10
  },
  switchText: {
    color: '#2927B4',
    fontSize: 14,
    fontWeight: '600'
  }
});
