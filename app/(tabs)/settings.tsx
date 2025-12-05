import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Funcionario = {
  id: string;
  nome: string;
  cargaDiariaHoras: number;      // horas por dia
  diasSemana: number;            // ex: 6 = trabalha 6 dias por semana
  permiteExtras: boolean;
  admissao: string;
};

export default function Settings() {
  const [nome, setNome] = useState('');
  const [cargaDiaria, setCargaDiaria] = useState('');
  const [diasSemana, setDiasSemana] = useState('');
  const [permiteExtras, setPermiteExtras] = useState(false);
  const [erro, setErro] = useState('');

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  async function carregar() {
    const dados = await AsyncStorage.getItem('funcionarios');
    setFuncionarios(dados ? JSON.parse(dados) : []);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function cadastrar() {
    setErro('');

    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErro('Nome vazio.');
      return;
    }

    if (funcionarios.some(f => f.nome.toLowerCase() === nomeTrim.toLowerCase())) {
      setErro('Nome já existe.');
      return;
    }

    const horas = Number(cargaDiaria);
    if (!horas || horas <= 0) {
      setErro('Carga diária inválida.');
      return;
    }

    const dias = Number(diasSemana);
    if (!dias || dias < 1 || dias > 7) {
      setErro('Dias por semana inválido.');
      return;
    }

    const novo: Funcionario = {
      id: Date.now().toString(),
      nome: nomeTrim,
      cargaDiariaHoras: horas,
      diasSemana: dias,
      permiteExtras,
      admissao: new Date().toISOString().split('T')[0]
    };

    const lista = [...funcionarios, novo];
    await AsyncStorage.setItem('funcionarios', JSON.stringify(lista));

    setNome('');
    setCargaDiaria('');
    setDiasSemana('');
    setPermiteExtras(false);

    carregar();
  }

  async function remover(id: string) {
    const lista = funcionarios.filter(f => f.id !== id);
    await AsyncStorage.setItem('funcionarios', JSON.stringify(lista));
    carregar();
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 20 }}>

      <Text style={{ fontSize: 18 }}>Cadastro de Funcionário</Text>

      {erro ? <Text style={{ color: 'red' }}>{erro}</Text> : null}

      <TextInput
        placeholder="Nome"
        value={nome}
        onChangeText={setNome}
        style={{ borderWidth: 1, padding: 8, borderRadius: 6 }}
      />

      <TextInput
        placeholder="Carga diária em horas (ex: 8)"
        keyboardType="numeric"
        value={cargaDiaria}
        onChangeText={setCargaDiaria}
        style={{ borderWidth: 1, padding: 8, borderRadius: 6 }}
      />

      <TextInput
        placeholder="Dias trabalhados por semana (ex: 6)"
        keyboardType="numeric"
        value={diasSemana}
        onChangeText={setDiasSemana}
        style={{ borderWidth: 1, padding: 8, borderRadius: 6 }}
      />

      <TouchableOpacity
        onPress={() => setPermiteExtras(!permiteExtras)}
        style={{
          padding: 10,
          backgroundColor: permiteExtras ? '#090' : '#777',
          borderRadius: 6
        }}
      >
        <Text style={{ color: '#fff' }}>
          {permiteExtras ? 'Permite horas extras' : 'Não permite horas extras'}
        </Text>
      </TouchableOpacity>

      <Button title="Cadastrar" onPress={cadastrar} />

      <View style={{ marginTop: 30 }}>
        <Text style={{ fontSize: 18 }}>Funcionários</Text>

        <FlatList
          data={funcionarios}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View
              style={{
                paddingVertical: 10,
                borderBottomWidth: 1,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <View>
                <Text>{item.nome}</Text>
                <Text>Carga diária: {item.cargaDiariaHoras}h</Text>
                <Text>Dias por semana: {item.diasSemana}</Text>
                <Text>Extras: {item.permiteExtras ? 'Sim' : 'Não'}</Text>
              </View>

              <TouchableOpacity
                onPress={() => remover(item.id)}
                style={{
                  backgroundColor: '#900',
                  padding: 10,
                  borderRadius: 6
                }}
              >
                <Text style={{ color: '#fff' }}>Remover</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>

    </View>
  );
}
