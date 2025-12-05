import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Modal,
  StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type BatidaTipo = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida_final';

type Batida = {
  id: string;
  tipo: BatidaTipo;
  timestamp: string;
  funcionarioId: string;
};

type Dia = {
  data: string;
  batidas: Batida[];
};

type Funcionario = {
  id: string;
  nome: string;
};

export default function PontoScreen() {
  const [dias, setDias] = useState<Dia[]>([]);
  const [diaAtual, setDiaAtual] = useState<Dia | null>(null);

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string | null>(null);

  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [batidaEditada, setBatidaEditada] = useState<Batida | null>(null);
  const [horaEdit, setHoraEdit] = useState('');

  useEffect(() => {
    carregarFuncionarios();
    carregarDias();
    pedirPermissaoNotificacao();
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarFuncionarios();
    }, [])
  );

  const carregarFuncionarios = async () => {
    const dados = await AsyncStorage.getItem('funcionarios');
    if (dados) {
      setFuncionarios(JSON.parse(dados));
    }
  };

  const pedirPermissaoNotificacao = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sem permissão para notificações');
    }
  };

  const hojeString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  const horaLocalISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const carregarDias = async () => {
    const dados = await AsyncStorage.getItem('dias');
    const hoje = hojeString();
    if (dados) {
      const parsed: Dia[] = JSON.parse(dados);
      setDias(parsed);
      const dia = parsed.find(d => d.data === hoje) || { data: hoje, batidas: [] };
      setDiaAtual(dia);
    } else {
      setDiaAtual({ data: hoje, batidas: [] });
    }
  };

  const salvarDias = async (novosDias: Dia[]) => {
    await AsyncStorage.setItem('dias', JSON.stringify(novosDias));
    setDias(novosDias);

    const hoje = hojeString();
    const diaAtualizado = novosDias.find(d => d.data === hoje) || { data: hoje, batidas: [] };
    setDiaAtual(diaAtualizado);
  };

  const ordemTipos: BatidaTipo[] = ['entrada', 'saida_almoco', 'retorno_almoco', 'saida_final'];

  const proxTipo = () => {
    if (!diaAtual || !funcionarioSelecionado) return 'entrada';
    const batidasFuncionario = diaAtual.batidas
      .filter(b => b.funcionarioId === funcionarioSelecionado)
      .map(b => b.tipo);

    for (const tipo of ordemTipos) {
      if (!batidasFuncionario.includes(tipo)) return tipo;
    }
    return null;
  };

  const baterPonto = async () => {
    if (!funcionarioSelecionado) {
      Alert.alert('Selecione um funcionário');
      return;
    }

    if (!diaAtual) return;

    const tipo = proxTipo();
    if (!tipo) {
      Alert.alert('Completo', 'Todas as batidas do funcionário já foram realizadas.');
      return;
    }

    const novaBatida: Batida = {
      id: Date.now().toString(),
      tipo,
      timestamp: horaLocalISO(),
      funcionarioId: funcionarioSelecionado,
    };

    const novoDia: Dia = {
      data: diaAtual.data,
      batidas: [...diaAtual.batidas, novaBatida],
    };

    const novosDias = [novoDia, ...dias.filter(d => d.data !== diaAtual.data)];
    await salvarDias(novosDias);

    if (tipo === 'saida_almoco') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Título',
          body: 'Mensagem'
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
          repeats: false
        }
      });
    }
  };

  const calcularTotalHorasDia = (batidas: Batida[]) => {
    const get = (t: BatidaTipo) => batidas.find(b => b.tipo === t);
    const e = get('entrada');
    const sa = get('saida_almoco');
    const ra = get('retorno_almoco');
    const sf = get('saida_final');

    if (!e || !sa || !ra || !sf) return 0;

    const t1 = new Date(e.timestamp).getTime();
    const t2 = new Date(sa.timestamp).getTime();
    const t3 = new Date(ra.timestamp).getTime();
    const t4 = new Date(sf.timestamp).getTime();

    return (t4 - t1 - (t3 - t2)) / 3600000;
  };

  const formatar = (h: number) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}min`;

  const abrirEdicao = (batida: Batida) => {
    setBatidaEditada(batida);
    setHoraEdit(batida.timestamp.slice(11, 16));
    setModalEdicaoAberto(true);
  };

  const salvarEdicao = () => {
    if (!batidaEditada || !diaAtual) return;

    const novaTimestamp = `${diaAtual.data}T${horaEdit}:00`;
    const novaBatida = { ...batidaEditada, timestamp: novaTimestamp };

    const novasBatidas = diaAtual.batidas.map(b => (b.id === novaBatida.id ? novaBatida : b));

    const novoDia = { ...diaAtual, batidas: novasBatidas };
    const novosDias = [novoDia, ...dias.filter(d => d.data !== diaAtual.data)];

    salvarDias(novosDias);
    setModalEdicaoAberto(false);
  };

  const batidasFiltradas =
    diaAtual?.batidas.filter(b => b.funcionarioId === funcionarioSelecionado) || [];

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Registro de Ponto</Text>

      <Text style={styles.subtitulo}>Funcionário</Text>
{!funcionarioSelecionado ? (


 <FlatList

    data={funcionarios}
    keyExtractor={item => item.id}
    renderItem={({ item }) => (
      <TouchableOpacity
        style={[
          styles.funcionarioBtn,
          funcionarioSelecionado === item.id && styles.funcionarioSelecionado,
        ]}
        onPress={() => setFuncionarioSelecionado(item.id)}
      >
        <Text>{item.nome}</Text>
      </TouchableOpacity>
    )}
  />
) : (
  <TouchableOpacity
    style={[styles.funcionarioBtn, styles.funcionarioSelecionado]}
    onPress={() => setFuncionarioSelecionado(null)}
  >
    <Text>
      {funcionarios.find(f => f.id === funcionarioSelecionado)?.nome}
    </Text>
  </TouchableOpacity>
)}



      <TouchableOpacity onPress={baterPonto} activeOpacity={0.8}>
        <LinearGradient colors={['#2927B4', '#12114E']} style={styles.btn}>
          <Text style={styles.btnTexto}>Bater Ponto ({proxTipo() || 'Completo'})</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.subtitulo}>Batidas de hoje</Text>

      <FlatList
        data={batidasFiltradas}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.batidaItem} onPress={() => abrirEdicao(item)}>
            <Text>{item.tipo.toUpperCase()}</Text>
            <Text>{item.timestamp.slice(11, 16)}</Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.total}>
        Total hoje: {formatar(calcularTotalHorasDia(batidasFiltradas))}
      </Text>

      <Modal visible={modalEdicaoAberto} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text>Editar horário</Text>
            <TextInput
              style={styles.input}
              value={horaEdit}
              onChangeText={setHoraEdit}
              maxLength={5}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button title="Cancelar" onPress={() => setModalEdicaoAberto(false)} />
              <Button title="Salvar" onPress={salvarEdicao} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, backgroundColor: '#fff', alignItems: 'center' },
  titulo: { fontSize: 40, fontWeight: 'bold', marginTop: 80, color: '#2927B4' },
  subtitulo: { fontSize: 25, fontWeight: 'bold', marginTop: 25,marginBottom: 25, alignSelf: 'flex-start' },
  funcionarioBtn: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: '#267cdfff',
    marginRight: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',



  },
  funcionarioSelecionado: {
    borderColor: '#2927B4',
    backgroundColor: '#e2e2ff',
    width: '85%',
  },
  btn: {
    marginTop: 20,
    width: 300,
    height: 80,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTexto: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  batidaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#eee',
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    width: '100%',
  },
  total: { fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  modal: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 10 },
  input: { borderWidth: 1, borderColor: '#999', padding: 10, borderRadius: 5, marginVertical: 10 },
});
