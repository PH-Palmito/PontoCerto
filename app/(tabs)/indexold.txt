import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList,
  Alert, Modal, TextInput, Button
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';

// Configuração global das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, // iOS 16+
    shouldShowList: true,   // iOS 16+
  }),
});

type BatidaTipo = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida_final';

type Batida = {
  id: string;
  tipo: BatidaTipo;
  timestamp: string;
};

type Dia = {
  data: string;
  batidas: Batida[];
};

export default function PontoScreen() {
  const [dias, setDias] = useState<Dia[]>([]);
  const [diaAtual, setDiaAtual] = useState<Dia | null>(null);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [batidaEditada, setBatidaEditada] = useState<Batida | null>(null);
  const [horaEdit, setHoraEdit] = useState('');

  useEffect(() => {
    pedirPermissaoNotificacao();
    carregarDados();
  }, []);

  const pedirPermissaoNotificacao = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'Não será possível enviar notificações.');
    }
  };

  const hojeString = () => {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const horaLocalISO = () => {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');
    const segundos = String(d.getSeconds()).padStart(2, '0');
    return `${ano}-${mes}-${dia}T${horas}:${minutos}:${segundos}`;
  };

  const carregarDados = async () => {
    try {
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
    } catch (e) {
      console.log('Erro ao carregar dados', e);
    }
  };

  const salvarDados = async (novosDias: Dia[]) => {
    try {
      await AsyncStorage.setItem('dias', JSON.stringify(novosDias));
      setDias(novosDias);
      const hoje = hojeString();
      const dia = novosDias.find(d => d.data === hoje) || { data: hoje, batidas: [] };
      setDiaAtual(dia);
    } catch (e) {
      console.log('Erro ao salvar dados', e);
    }
  };

  const ordemTipos: BatidaTipo[] = ['entrada', 'saida_almoco', 'retorno_almoco', 'saida_final'];

  const proxTipo = () => {
    if (!diaAtual) return 'entrada';
    const batidasHoje = diaAtual.batidas.map(b => b.tipo);
    for (const tipo of ordemTipos) {
      if (!batidasHoje.includes(tipo)) return tipo;
    }
    return null;
  };

  const baterPonto = async () => {
    if (!diaAtual) return;
    const tipo = proxTipo();
    if (!tipo) {
      Alert.alert('Info', 'Você já bateu todos os pontos do dia.');
      return;
    }
    const novaBatida: Batida = {
      id: Date.now().toString(),
      tipo,
      timestamp: horaLocalISO(),
    };
    const novoDia: Dia = {
      data: diaAtual.data,
      batidas: [...diaAtual.batidas, novaBatida],
    };
    const novosDias = [novoDia, ...dias.filter(d => d.data !== diaAtual.data)];
    salvarDados(novosDias);

    // Se for saída para almoço, agenda notificação para 50 minutos depois
    if (tipo === 'saida_almoco') {
     await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Hora de voltar!',
    body: 'Seu intervalo de almoço acabou. Retorne ao trabalho.',
    sound: true,
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, // 👈 constante oficial
    seconds: 50 * 60,
    repeats: false,
  },
});

    }
  };

  const calcularTotalHorasDia = (batidas: Batida[]): number => {
    const getBatida = (tipo: BatidaTipo) => batidas.find(b => b.tipo === tipo);
    const e = getBatida('entrada');
    const sAlmoco = getBatida('saida_almoco');
    const rAlmoco = getBatida('retorno_almoco');
    const sFinal = getBatida('saida_final');
    if (!e || !sAlmoco || !rAlmoco || !sFinal) return 0;

    const tEntrada = new Date(e.timestamp).getTime();
    const tSaidaAlmoco = new Date(sAlmoco.timestamp).getTime();
    const tRetornoAlmoco = new Date(rAlmoco.timestamp).getTime();
    const tSaidaFinal = new Date(sFinal.timestamp).getTime();

    if (tSaidaAlmoco < tEntrada || tRetornoAlmoco < tSaidaAlmoco || tSaidaFinal < tRetornoAlmoco) return 0;

    return (tSaidaFinal - tEntrada - (tRetornoAlmoco - tSaidaAlmoco)) / (1000 * 60 * 60);
  };

  const formatarHoras = (horas: number) => {
    const h = Math.floor(horas);
    const m = Math.round((horas - h) * 60);
    return `${h}h ${m}min`;
  };

  const calcularSaldoSemanal = () => {
    const hoje = new Date();
    const diaSemana = hoje.getDay() || 7;
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - (diaSemana - 1));

    const diasSemana = dias.filter(d => {
      const dData = new Date(d.data + 'T00:00:00');
      return dData >= inicioSemana && dData <= hoje;
    });

    let totalHoras = 0;
    diasSemana.forEach(d => {
      totalHoras += calcularTotalHorasDia(d.batidas);
    });

    return totalHoras - 44;
  };

  const abrirModalEdicao = (batida: Batida) => {
    setBatidaEditada(batida);
    setHoraEdit(batida.timestamp.slice(11, 16));
    setModalEdicaoAberto(true);
  };

  const salvarEdicao = () => {
    if (!batidaEditada || !diaAtual) return;
    if (!horaEdit.match(/^\d{2}:\d{2}$/)) {
      Alert.alert('Erro', 'Hora inválida. Use formato HH:mm.');
      return;
    }
    const novaTimestamp = `${diaAtual.data}T${horaEdit}:00`;
    const novaBatida: Batida = { ...batidaEditada, timestamp: novaTimestamp };
    const novasBatidas = diaAtual.batidas.map(b => b.id === novaBatida.id ? novaBatida : b);
    const novoDia: Dia = { ...diaAtual, batidas: novasBatidas };
    const novosDias = [novoDia, ...dias.filter(d => d.data !== diaAtual.data)];
    salvarDados(novosDias);
    setModalEdicaoAberto(false);
    setBatidaEditada(null);
  };

  const renderBatida = ({ item }: { item: Batida }) => (
    <TouchableOpacity style={styles.batidaItem} onPress={() => abrirModalEdicao(item)}>
      <Text>{item.tipo.replace('_', ' ').toUpperCase()}</Text>
      <Text>{item.timestamp.slice(11, 16)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Registro de Ponto</Text>

      <TouchableOpacity onPress={baterPonto} activeOpacity={0.8}>
        <LinearGradient colors={['#2927B4', '#12114E']} style={styles.btn}>
          <Text style={styles.btnTexto}>Bater Ponto ({proxTipo() || 'Completo'})</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.subtitulo}>Batidas de hoje ({diaAtual?.data})</Text>
      <FlatList
        data={diaAtual?.batidas || []}
        keyExtractor={item => item.id}
        renderItem={renderBatida}
        style={{ width: '100%' }}
      />

      <Text style={styles.total}>
        Total hoje: {formatarHoras(calcularTotalHorasDia(diaAtual?.batidas || []))}
      </Text>
      <Text style={styles.total}>
        Saldo semanal: {formatarHoras(calcularSaldoSemanal())} {calcularSaldoSemanal() < 0 ? '(Atraso)' : '(Extra)'}
      </Text>

      <Modal visible={modalEdicaoAberto} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text>Editar horário ({batidaEditada?.tipo.replace('_', ' ')})</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:mm"
              value={horaEdit}
              onChangeText={setHoraEdit}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
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
  container: { flex: 1, padding: 25, backgroundColor: '#fff', alignItems: 'center' },
  titulo: { fontSize: 32, fontWeight: 'bold', marginBottom: 20, marginTop: 90, color: '#2927B4', textTransform: 'uppercase' },
  btn: { marginTop: 20, width: 300, height: 90, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  btnTexto: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  subtitulo: { fontSize: 20, fontWeight: 'bold', marginVertical: 10, alignSelf: 'flex-start' },
  batidaItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#eee', padding: 15, borderRadius: 10, marginBottom: 8 },
  total: { fontSize: 20, fontWeight: 'bold', marginTop: 15 },
  modal: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 5, padding: 10, marginTop: 10, fontSize: 18, textAlign: 'center' },
});
