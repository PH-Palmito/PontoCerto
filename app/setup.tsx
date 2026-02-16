import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SetupScreen() {
  const router = useRouter();
  const [empresaNome, setEmpresaNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [saving, setSaving] = useState(false);

  // MÁSCARA DE CNPJ
  const formatarCNPJ = (text: string) => {
    return text
      .replace(/\D/g, '') // Remove tudo o que não é dígito
      .replace(/^(\d{2})(\d)/, '$1.$2') // Coloca ponto após os dois primeiros dígitos
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3') // Coloca ponto após os três próximos
      .replace(/\.(\d{3})(\d)/, '.$1/$2') // Coloca barra após os três próximos
      .replace(/(\d{4})(\d)/, '$1-$2') // Coloca traço antes dos dois últimos
      .slice(0, 18); // Limita tamanho
  };

  const finalizarSetup = async () => {
    if (!empresaNome || !adminPin) {
      return Alert.alert("Campos obrigatórios", "Preencha o nome da empresa e a senha administrativa.");
    }
    if (adminPin.length < 4) {
      return Alert.alert("Senha insegura", "A senha administrativa deve ter pelo menos 4 números.");
    }

    setSaving(true);
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Erro", "Usuário não autenticado.");
      router.replace('/');
      return;
    }

    try {
      const empresaDados = {
        id: user.uid,
        nome: empresaNome,
        cnpj: cnpj, // Salva formatado mesmo
        email: user.email,
        controleAlmoco: true,
        horaEntrada: "08:00",
        horaSaidaFinal: "18:00",
        cargaHorariaPadrao: 8,
        senhaAdmin: adminPin
      };

      const dadosCompletos = {
        empresa: empresaDados,
        funcionarios: [],
        feriados: [],
        ultimaAtualizacao: new Date().toISOString()
      };

      await setDoc(doc(db, "empresas", user.uid), dadosCompletos);
      await AsyncStorage.setItem('empresa', JSON.stringify(empresaDados));
      await AsyncStorage.setItem('funcionarios', '[]');

      Alert.alert("Sucesso", "Configuração concluída!");
      router.replace('/(tabs)/home');

    } catch (e: any) {
      console.error(e);
      Alert.alert("Erro", "Falha ao salvar: " + e.message);
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>Configuração Inicial</Text>
      <Text style={styles.description}>
        Bem-vindo! Vamos configurar os dados da sua empresa e a senha mestra do sistema.
      </Text>

      <Text style={styles.label}>Nome da Empresa/Loja *</Text>
      <TextInput style={styles.input} value={empresaNome} onChangeText={setEmpresaNome} placeholder="Ex: Padaria do João" />

      <Text style={styles.label}>CNPJ (Opcional)</Text>
      <TextInput
        style={styles.input}
        value={cnpj}
        onChangeText={(t) => setCnpj(formatarCNPJ(t))}
        placeholder="00.000.000/0000-00"
        keyboardType="numeric"
        maxLength={18}
      />

      <Text style={styles.label}>Senha Admin (PIN) *</Text>
      <TextInput
        style={styles.input}
        value={adminPin}
        onChangeText={setAdminPin}
        placeholder="Ex: 1234 (Usada para acessar configurações)"
        keyboardType="numeric"
        maxLength={6}
      />

      <TouchableOpacity style={styles.btnFinish} onPress={finalizarSetup} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>SALVAR E ABRIR APP</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f8f9fa', padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#2927B4', marginBottom: 10, textAlign: 'center' },
  description: { color: '#666', marginBottom: 30, textAlign: 'center', lineHeight: 20 },
  label: { fontSize: 16, color: '#333', marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', marginBottom: 20, fontSize: 16 },
  btnFinish: { backgroundColor: '#27ae60', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});