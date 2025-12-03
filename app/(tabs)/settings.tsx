import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Settings() {
  const [nome, setNome] = useState('');
 const [funcionarios, setFuncionarios] = useState<
  { id: string; nome: string }[]
>([]);

  async function carregar() {
    const dados = await AsyncStorage.getItem('funcionarios');
    setFuncionarios(dados ? JSON.parse(dados) : []);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function cadastrar() {
    if (!nome.trim()) return;

    const novo = {
      id: Date.now().toString(),
      nome,
    };

    const atual = await AsyncStorage.getItem('funcionarios');
    const lista = atual ? JSON.parse(atual) : [];

    lista.push(novo);

    await AsyncStorage.setItem('funcionarios', JSON.stringify(lista));

    setNome('');
    carregar();
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>

      <Text>Registrar Funcionário</Text>

      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Nome"
        style={{
          borderWidth: 1,
          padding: 8,
          borderRadius: 6
        }}
      />

      <Button title="Cadastrar" onPress={cadastrar} />

      <View style={{ marginTop: 24 }}>
        <Text>Funcionários cadastrados</Text>

        <FlatList
          data={funcionarios}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ paddingVertical: 8, borderBottomWidth: 1 }}>
              <Text>{item.nome}</Text>
            </View>
          )}
        />
      </View>

    </View>
  );
}
