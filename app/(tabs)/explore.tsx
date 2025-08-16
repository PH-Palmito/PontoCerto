import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Button,
  ScrollView,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

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

export default function HistoricoScreen() {
  const [dias, setDias] = useState<Dia[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState<string>('');
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<Dia | null>(null);

  // Animação da lista
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const dados = await AsyncStorage.getItem('dias');
      if (dados) {
        const parsed: Dia[] = JSON.parse(dados);
        const ordenados = parsed.sort((a, b) => (a.data < b.data ? 1 : -1));
        setDias(ordenados);

        const meses = Array.from(
          new Set(
            ordenados.map(d => {
              const date = new Date(d.data);
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            })
          )
        );
        setMesesDisponiveis(meses);

        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        setMesSelecionado(mesAtual);
      }
    })();
  }, []);

  useEffect(() => {
    // Sempre que o mês muda, anima a lista
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true
    }).start();
  }, [mesSelecionado]);

  const formatarMesAno = (mesAno: string) => {
    const [ano, mes] = mesAno.split('-');
    const nomesMeses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${nomesMeses[parseInt(mes) - 1]} ${ano}`;
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
    const negativo = horas < 0;
    const horasAbs = Math.abs(horas);
    const h = Math.floor(horasAbs);
    const m = Math.round((horasAbs - h) * 60);
    return `${negativo ? '-' : ''}${h}h ${m}min`;
  };

  const icones: Record<BatidaTipo, { nome: keyof typeof Ionicons.glyphMap; cor: string }> = {
    entrada: { nome: 'log-in', cor: '#2ecc71' },
    saida_almoco: { nome: 'fast-food', cor: '#f1c40f' },
    retorno_almoco: { nome: 'return-up-forward', cor: '#3498db' },
    saida_final: { nome: 'log-out', cor: '#e74c3c' }
  };

  const diasDoMes = dias.filter(d => {
    const date = new Date(d.data);
    const mesAno = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return mesAno === mesSelecionado;
  });

  const totalHorasMes = () => diasDoMes.reduce((acc, dia) => acc + calcularTotalHorasDia(dia.batidas), 0);
  const diasTrabalhadosMes = () => diasDoMes.filter(dia => calcularTotalHorasDia(dia.batidas) > 0).length;

  const saldoMensal = () => {
    const totalHoras = totalHorasMes();
    const cargaHorariaSemanal = 44;
    const semanasNoMes = diasTrabalhadosMes() / 5; // aproximado
    return totalHoras - cargaHorariaSemanal * semanasNoMes;
  };

  const saldoSemanal = () => {
    const hoje = new Date();
    const primeiroDiaSemana = new Date(hoje);
    const diaSemana = hoje.getDay();
    const segunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    primeiroDiaSemana.setDate(hoje.getDate() + segunda);
    primeiroDiaSemana.setHours(0, 0, 0, 0);

    const ultimoDiaSemana = new Date(primeiroDiaSemana);
    ultimoDiaSemana.setDate(primeiroDiaSemana.getDate() + 6);
    ultimoDiaSemana.setHours(23, 59, 59, 999);

    const diasSemanaAtual = dias.filter(dia => {
      const dataDia = new Date(dia.data);
      return dataDia >= primeiroDiaSemana && dataDia <= ultimoDiaSemana;
    });

    const totalHorasSemana = diasSemanaAtual.reduce(
      (acc, dia) => acc + calcularTotalHorasDia(dia.batidas),
      0
    );

    const cargaHorariaSemanal = 44;
    return totalHorasSemana - cargaHorariaSemanal;
  };

  const abrirEdicao = (dia: Dia) => {
    setDiaSelecionado(dia);
    setModalVisivel(true);
  };

  const salvarEdicao = async () => {
    if (!diaSelecionado) return;
    const diasAtualizados = dias.map(d => d.data === diaSelecionado.data ? diaSelecionado : d);
    setDias(diasAtualizados);
    await AsyncStorage.setItem('dias', JSON.stringify(diasAtualizados));
    setModalVisivel(false);
  };

  const renderDia = ({ item }: { item: Dia }) => (
    <View style={styles.card}>
      <Text style={styles.data}>{item.data}</Text>
      {item.batidas.map(b => (
        <View key={b.id} style={styles.linhaBatida}>
          <Ionicons name={icones[b.tipo].nome} size={18} color={icones[b.tipo].cor} style={{ marginRight: 5 }} />
          <Text>{b.tipo.replace('_', ' ').toUpperCase()} - {b.timestamp.slice(11, 16)}</Text>
        </View>
      ))}
      <Text style={styles.total}>⏱ Total: {formatarHoras(calcularTotalHorasDia(item.batidas))}</Text>
      <TouchableOpacity style={styles.btnEditar} onPress={() => abrirEdicao(item)}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Editar</Text>
      </TouchableOpacity>
    </View>
  );

  const trocarMes = (direcao: 'anterior' | 'proximo') => {
    const indiceAtual = mesesDisponiveis.indexOf(mesSelecionado);
    const novoIndice = direcao === 'proximo' ? indiceAtual - 1 : indiceAtual + 1;
    if (novoIndice >= 0 && novoIndice < mesesDisponiveis.length) {
      setMesSelecionado(mesesDisponiveis[novoIndice]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Histórico</Text>

      {/* Resumo Mensal/Semanal */}
      <View style={styles.resumoBox}>
        <Ionicons name="calendar" size={24} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.resumoTexto}>
          {formatarMesAno(mesSelecionado)} • {diasTrabalhadosMes()} dias
          {"\n"}Total mês: {formatarHoras(totalHorasMes())}
          {"\n"}Saldo mensal: {formatarHoras(saldoMensal())}
          {"\n"}Saldo semanal: {formatarHoras(saldoSemanal())}
        </Text>
      </View>

      {/* Navegação entre meses */}
      <View style={styles.navegacaoMes}>
        <TouchableOpacity onPress={() => trocarMes('anterior')}>
          <Ionicons name="chevron-back" size={28} color="#2927B4" />
        </TouchableOpacity>
        <Text style={styles.mesSelecionado}>{formatarMesAno(mesSelecionado)}</Text>
        <TouchableOpacity onPress={() => trocarMes('proximo')}>
          <Ionicons name="chevron-forward" size={28} color="#2927B4" />
        </TouchableOpacity>
      </View>

      {/* Lista de dias animada */}
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <FlatList
          data={diasDoMes}
          keyExtractor={item => item.data}
          renderItem={renderDia}
        />
      </Animated.View>

      {/* Modal de edição */}
      <Modal visible={modalVisivel} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <ScrollView>
              {diaSelecionado?.batidas.map((b, index) => (
                <View key={b.id} style={{ marginBottom: 15 }}>
                  <Text>{b.tipo.replace('_', ' ').toUpperCase()}</Text>
                  <TextInput
                    value={b.timestamp.slice(11, 16)}
                    onChangeText={text => {
                      const horas = text.split(':');
                      if (horas.length === 2 && diaSelecionado) {
                        const novaData = new Date(diaSelecionado.data);
                        novaData.setHours(parseInt(horas[0]), parseInt(horas[1]));
                        const novasBatidas = [...diaSelecionado.batidas];
                        novasBatidas[index] = { ...b, timestamp: novaData.toISOString() };
                        setDiaSelecionado({ ...diaSelecionado, batidas: novasBatidas });
                      }
                    }}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
              ))}
              <Button title="Salvar" onPress={salvarEdicao} />
              <Button title="Cancelar" onPress={() => setModalVisivel(false)} color="red" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
  resumoBox:{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2927B4', padding: 12, borderRadius: 8, marginBottom: 15 },
  resumoTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  navegacaoMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  mesSelecionado: { fontSize: 18, fontWeight: 'bold', color: '#2927B4', marginHorizontal: 10 },
  card: { backgroundColor:'#f8f9fa', padding: 15, borderRadius: 8, marginBottom: 10, elevation: 2 },
  data: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  linhaBatida: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  total: { marginTop: 8, fontWeight: 'bold', color: '#2c3e50' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: '#fff', borderRadius: 8, padding: 20, maxHeight: '80%' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 8, marginTop: 5 },
  btnEditar: { marginTop: 10, backgroundColor: '#2927B4', padding: 8, borderRadius: 5, alignItems: 'center' }
});
