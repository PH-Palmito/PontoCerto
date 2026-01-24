import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet, Text } from 'react-native';
import { db } from '../../utils/firebaseConfig'; // Verifique se o caminho está correto
import { collection, addDoc } from 'firebase/firestore';

export default function CadastroFuncionario() {
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');

 const salvarNoFirebase = async () => {
    console.log("Botão apertado!"); // Verifique se isso aparece no terminal do VS Code

    if (nome === '' || cargo === '') {
      Alert.alert("Erro", "Preencha todos os campos!");
      return;
    }

    try {
      console.log("Tentando conectar ao Firestore...");

      const docRef = await addDoc(collection(db, "funcionarios"), {
        nome: nome,
        cargo: cargo,
        dataCadastro: new Date().toISOString(),
      });

      console.log("Documento escrito com ID: ", docRef.id);
      Alert.alert("Sucesso!", "Funcionário cadastrado com ID: " + docRef.id);

      setNome('');
      setCargo('');
    } catch (error: any) {
      console.error("Erro detalhado:", error);
      Alert.alert("Erro!", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nome do Funcionário:</Text>
      <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: João Silva" />

      <Text style={styles.label}>Cargo:</Text>
      <TextInput style={styles.input} value={cargo} onChangeText={setCargo} placeholder="Ex: Operador" />

      <Button title="Salvar Funcionário" onPress={salvarNoFirebase} color="#2196F3" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  label: { fontSize: 16, marginBottom: 5, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 20, borderRadius: 5 }
});