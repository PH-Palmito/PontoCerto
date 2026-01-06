import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  cargaDiariaHoras: number;
  diasSemana: number;
  permiteExtras: boolean;
  admissao: string;
};

type Empresa = {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  controleAlmoco: boolean;
  horaEntrada: string;
  horaAlmocoSugeridaInicio?: string;
  horaAlmocoSugeridaFim?: string;
  horaSaidaFinal: string;
  cargaHorariaPadrao: number;
};

const { width } = Dimensions.get('window');

export default function PontoScreen() {
  const [dias, setDias] = useState<Dia[]>([]);
  const [diaAtual, setDiaAtual] = useState<Dia | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string | null>(null);
  const [animacaoPonto] = useState(new Animated.Value(1));
  const [mostrarFeedbacks, setMostrarFeedbacks] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    carregarEmpresa();
    carregarFuncionarios();
    carregarDias();
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarFuncionarios();
      carregarEmpresa();
    }, [])
  );

  const carregarEmpresa = async () => {
    try {
      const dados = await AsyncStorage.getItem('empresa');
      if (dados) {
        const empresaSalva = JSON.parse(dados);
        if (empresaSalva.controleAlmoco === undefined) {
          empresaSalva.controleAlmoco = empresaSalva.temAlmocoFixo !== false;
        }
        setEmpresa(empresaSalva);
      }
    } catch (error) {
      console.error('Erro ao carregar empresa:', error);
    }
  };

  const carregarFuncionarios = async () => {
    const dados = await AsyncStorage.getItem('funcionarios');
    if (dados) {
      setFuncionarios(JSON.parse(dados));
    }
  };

  // CORREÇÃO: Função para obter data atual no formato YYYY-MM-DD (fuso horário local)
  const hojeString = () => {
    const data = new Date();

    // Ajusta para o fuso horário local
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
  };

  const horaLocalISO = () => {
    const data = new Date();

    // Cria uma string ISO sem o Z (para usar horário local)
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    const horas = String(data.getHours()).padStart(2, '0');
    const minutos = String(data.getMinutes()).padStart(2, '0');
    const segundos = String(data.getSeconds()).padStart(2, '0');

    return `${ano}-${mes}-${dia}T${horas}:${minutos}:${segundos}`;
  };

  const carregarDias = async () => {
    const dados = await AsyncStorage.getItem('dias');
    const hoje = hojeString();

    console.log('Data atual:', hoje); // Para debug

    if (dados) {
      const parsed: Dia[] = JSON.parse(dados);
      setDias(parsed);

      // Procura o dia atual
      const diaEncontrado = parsed.find(d => d.data === hoje);

      if (diaEncontrado) {
        setDiaAtual(diaEncontrado);
        console.log('Dia encontrado:', diaEncontrado.data);
      } else {
        // Se não encontrar, cria um novo dia
        const novoDia = { data: hoje, batidas: [] };
        setDiaAtual(novoDia);
        console.log('Novo dia criado:', novoDia.data);
      }
    } else {
      // Se não houver dados, cria um novo dia
      const novoDia = { data: hoje, batidas: [] };
      setDiaAtual(novoDia);
      console.log('Primeiro dia criado:', novoDia.data);
    }
  };

  const salvarDias = async (novosDias: Dia[]) => {
    const hoje = hojeString();
    await AsyncStorage.setItem('dias', JSON.stringify(novosDias));
    setDias(novosDias);

    // Atualiza o dia atual
    const diaAtualizado = novosDias.find(d => d.data === hoje) || { data: hoje, batidas: [] };
    setDiaAtual(diaAtualizado);
  };

  const getOrdemTipos = (): BatidaTipo[] => {
    if (empresa?.controleAlmoco) {
      return ['entrada', 'saida_almoco', 'retorno_almoco', 'saida_final'];
    } else {
      return ['entrada', 'saida_final'];
    }
  };

  const proxTipo = () => {
    if (!diaAtual || !funcionarioSelecionado) return 'entrada';
    const batidasFuncionario = diaAtual.batidas
      .filter(b => b.funcionarioId === funcionarioSelecionado)
      .map(b => b.tipo);

    const ordem = getOrdemTipos();
    for (const tipo of ordem) {
      if (!batidasFuncionario.includes(tipo)) return tipo;
    }
    return null;
  };

  const animarBotao = () => {
    Animated.sequence([
      Animated.timing(animacaoPonto, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.ease,
      }),
      Animated.timing(animacaoPonto, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.elastic(1.5),
      })
    ]).start();
  };

  const mostrarFeedback = (tipo: string) => {
    setMostrarFeedbacks(prev => ({...prev, [tipo]: true}));
    setTimeout(() => {
      setMostrarFeedbacks(prev => ({...prev, [tipo]: false}));
    }, 2000);
  };

  const baterPonto = async () => {
    if (!funcionarioSelecionado) {
      Alert.alert('Selecione um funcionário');
      return;
    }

    if (!empresa) {
      Alert.alert('Configuração necessária', 'Cadastre os dados da empresa primeiro nas configurações.');
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

    animarBotao();
    mostrarFeedback(tipo);
  };

  const calcularTotalHorasDia = (batidas: Batida[]) => {
    if (!empresa) return 0;

    if (empresa.controleAlmoco) {
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
    } else {
      const e = batidas.find(b => b.tipo === 'entrada');
      const sf = batidas.find(b => b.tipo === 'saida_final');

      if (!e || !sf) return 0;

      const t1 = new Date(e.timestamp).getTime();
      const t4 = new Date(sf.timestamp).getTime();

      return (t4 - t1) / 3600000;
    }
  };

  const formatar = (h: number) => {
    const horas = Math.floor(h);
    const minutos = Math.round((h % 1) * 60);
    return `${horas}h ${minutos}m`;
  };

  const rotuloBatida: Record<BatidaTipo, string> = {
    entrada: 'Entrada',
    saida_almoco: 'Início Pausa',
    retorno_almoco: 'Fim Pausa',
    saida_final: 'Saída',
  };

  const iconeBatida: Record<BatidaTipo, keyof typeof Ionicons.glyphMap> = {
    entrada: 'enter-outline',
    saida_almoco: 'restaurant-outline',
    retorno_almoco: 'return-up-back-outline',
    saida_final: 'exit-outline',
  };

  const corBatida: Record<BatidaTipo, string> = {
    entrada: '#4CAF50',
    saida_almoco: '#FF9800',
    retorno_almoco: '#2196F3',
    saida_final: '#F44336',
  };

  const feedbackTexto: Record<BatidaTipo, string> = {
    entrada: 'Entrada registrada!',
    saida_almoco: 'Pausa iniciada!',
    retorno_almoco: 'Pausa finalizada!',
    saida_final: 'Saída registrada!',
  };

  const batidasFiltradas =
    diaAtual?.batidas.filter(b => b.funcionarioId === funcionarioSelecionado) || [];

  // Função para formatar a data no formato brasileiro
  const formatarData = (dataStr: string) => {
  const [ano, mes, dia] = dataStr.split('-').map(Number);

  const dataLocal = new Date(ano, mes - 1, dia);

  return dataLocal.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};


  const funcionarioAtual = funcionarios.find(f => f.id === funcionarioSelecionado);

  // Obtém a meta diária do funcionário atual
  const getMetaDiaria = () => {
    if (!funcionarioAtual) return 0;
    return funcionarioAtual.cargaDiariaHoras;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2927B4', '#12114E']}
        style={styles.headerGradient}
      >
        <Text style={styles.titulo}>Registro de Ponto</Text>
        <Text style={styles.dataAtual}>{formatarData(hojeString())}</Text>
      </LinearGradient>

      <View style={styles.content}>
        {!empresa && (
          <View style={styles.alertBox}>
            <Ionicons name="warning-outline" size={20} color="#856404" />
            <Text style={styles.alertText}>
              Configure os dados da empresa nas Configurações
            </Text>
          </View>
        )}

        <Text style={styles.subtitulo}>Selecione o Funcionário</Text>

        {!funcionarioSelecionado ? (
          <FlatList
            data={funcionarios}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.funcionarioCard}
                onPress={() => setFuncionarioSelecionado(item.id)}
              >
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.funcionarioInfo}>
                  <Text style={styles.funcionarioNome}>{item.nome}</Text>
                  <Text style={styles.funcionarioStatus}>
                    Carga diária: {item.cargaDiariaHoras}h • {item.diasSemana} dias/semana
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            )}
            style={{ width: '100%' }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.funcionarioSelecionadoCard}>
            <View style={styles.funcionarioSelecionadoHeader}>
              <View style={styles.avatarPlaceholderAtivo}>
                <Text style={styles.avatarTextAtivo}>{funcionarioAtual?.nome.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.funcionarioSelecionadoInfo}>
                <Text style={styles.funcionarioNomeAtivo}>{funcionarioAtual?.nome}</Text>
                <Text style={styles.funcionarioStatusAtivo}>
                  Carga diária: {funcionarioAtual?.cargaDiariaHoras}h • {funcionarioAtual?.diasSemana} dias/semana
                </Text>
              </View>
              <TouchableOpacity
                style={styles.btnTrocarFuncionario}
                onPress={() => setFuncionarioSelecionado(null)}
              >
                <Ionicons name="swap-horizontal" size={20} color="#2927B4" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mostrarFeedbacks[proxTipo() || ''] && (
          <View style={styles.feedbackBox}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.feedbackText}>
              {feedbackTexto[proxTipo() as BatidaTipo] || 'Ponto registrado!'}
            </Text>
          </View>
        )}

        {/* Botão de Bater Ponto - Aparece apenas quando empresa e funcionário estão selecionados */}
        {empresa && funcionarioSelecionado && (
          <Animated.View style={{ transform: [{ scale: animacaoPonto }] }}>
            <TouchableOpacity
              onPress={baterPonto}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#2927B4', '#12114E']}
                style={styles.btnPonto}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.btnPontoContent}>
                  <View style={styles.btnPontoIcon}>
                    <Ionicons name="time-outline" size={32} color="#fff" />
                  </View>
                  <View style={styles.btnPontoTextContainer}>
                    <Text style={styles.btnPontoTitulo}>BATER PONTO</Text>
                    <Text style={styles.btnPontoSubtitulo}>
                      {proxTipo() ? rotuloBatida[proxTipo() as BatidaTipo] : 'Jornada Completa'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {batidasFiltradas.length > 0 && (
          <>
            <View style={styles.secaoTituloContainer}>
              <Ionicons name="list-outline" size={20} color="#2927B4" />
              <Text style={styles.secaoTitulo}>Batidas de Hoje</Text>
              <View style={styles.contadorBatidas}>
                <Text style={styles.contadorBatidasText}>{batidasFiltradas.length}</Text>
              </View>
            </View>

            <FlatList
              data={[...batidasFiltradas].reverse()}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.batidaCard}>
                  <View style={[styles.batidaIconContainer, { backgroundColor: `${corBatida[item.tipo]}15` }]}>
                    <Ionicons name={iconeBatida[item.tipo]} size={24} color={corBatida[item.tipo]} />
                  </View>
                  <View style={styles.batidaInfo}>
                    <Text style={styles.batidaTipo}>{rotuloBatida[item.tipo]}</Text>
                    <Text style={styles.batidaHora}>{item.timestamp.slice(11, 16)}</Text>
                  </View>
                  <View style={styles.batidaStatus}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  </View>
                </View>
              )}
              style={{ width: '100%', marginBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.totalCard}>
              <Ionicons name="analytics-outline" size={24} color="#27ae60" />
              <View style={styles.totalInfo}>
                <Text style={styles.totalLabel}>Total de horas hoje</Text>
                <Text style={styles.totalHoras}>
                  {formatar(calcularTotalHorasDia(batidasFiltradas))}
                </Text>
              </View>
              <View style={styles.totalMeta}>
                <Text style={styles.totalMetaLabel}>Meta diária</Text>
                <Text style={styles.totalMetaHoras}>
                  {getMetaDiaria()}h
                </Text>
              </View>
            </View>
          </>
        )}

        {batidasFiltradas.length === 0 && funcionarioSelecionado && empresa && (
          <View style={styles.semBatidasCard}>
            <Ionicons name="time-outline" size={48} color="#ddd" />
            <Text style={styles.semBatidasTexto}>Nenhuma batida registrada hoje</Text>
            <Text style={styles.semBatidasSubtitulo}>
              Clique no botão acima para registrar sua primeira batida
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  dataAtual: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 8,
    textTransform: 'capitalize',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 30,
  },
  subtitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
    marginLeft: 5,
  },
  alertBox: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  alertText: {
    color: '#856404',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  funcionarioCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e2e2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2927B4',
  },
  funcionarioInfo: {
    flex: 1,
  },
  funcionarioNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  funcionarioStatus: {
    fontSize: 13,
    color: '#666',
  },
  funcionarioSelecionadoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#2927B4',
  },
  funcionarioSelecionadoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholderAtivo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2927B4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarTextAtivo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  funcionarioSelecionadoInfo: {
    flex: 1,
  },
  funcionarioNomeAtivo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  funcionarioStatusAtivo: {
    fontSize: 14,
    color: '#666',
  },
  btnTrocarFuncionario: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f0f0ff',
  },
  feedbackBox: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    color: '#155724',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  btnPonto: {
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#2927B4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPontoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnPontoIcon: {
    marginRight: 15,
  },
  btnPontoTextContainer: {
    flex: 1,
  },
  btnPontoTitulo: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  btnPontoSubtitulo: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  secaoTituloContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  secaoTitulo: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 10,
  },
  contadorBatidas: {
    backgroundColor: '#2927B4',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  contadorBatidasText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  batidaCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  batidaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  batidaInfo: {
    flex: 1,
  },
  batidaTipo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  batidaHora: {
    fontSize: 14,
    color: '#666',
  },
  batidaStatus: {
    marginLeft: 10,
  },
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderTopWidth: 3,
    borderTopColor: '#27ae60',
  },
  totalInfo: {
    flex: 1,
    marginLeft: 15,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalHoras: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  totalMeta: {
    alignItems: 'flex-end',
  },
  totalMetaLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  totalMetaHoras: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  semBatidasCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    borderStyle: 'dashed',
  },
  semBatidasTexto: {
    fontSize: 18,
    color: '#999',
    marginTop: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  semBatidasSubtitulo: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
});