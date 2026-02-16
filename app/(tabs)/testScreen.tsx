import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
  Easing,
  Modal,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

type BatidaTipo = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida_final';

type Batida = {
  id: string;
  tipo: BatidaTipo;
  timestamp: string;
  funcionarioId: string;
  photoUri?: string;
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
  pin: string;
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
  const [mostrarFeedbacks, setMostrarFeedbacks] = useState<{ [key: string]: boolean }>({});

  const [modalPinVisivel, setModalPinVisivel] = useState(false);
  const [cameraVisivel, setCameraVisivel] = useState(false);
  const [pinDigitado, setPinDigitado] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [tipoBatidaAtual, setTipoBatidaAtual] = useState<BatidaTipo | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Ciclo de carregamento corrigido para respeitar a hierarquia de dados
  useEffect(() => {
    inicializarDados();
  }, []);

  useFocusEffect(
    useCallback(() => {
      inicializarDados();
    }, [])
  );

  const inicializarDados = async () => {
    const empresaCarregada = await carregarEmpresa();
    if (empresaCarregada) {
      await carregarFuncionarios(empresaCarregada.id);
      await carregarDias(empresaCarregada.id);
    }
  };

  const carregarEmpresa = async (): Promise<Empresa | null> => {
    try {
      const dados = await AsyncStorage.getItem('empresa');
      if (dados) {
        const empresaSalva = JSON.parse(dados);
        if (empresaSalva.controleAlmoco === undefined) {
          empresaSalva.controleAlmoco = empresaSalva.temAlmocoFixo !== false;
        }
        setEmpresa(empresaSalva);
        return empresaSalva;
      }
      return null;
    } catch (error) {
      console.error('Erro ao carregar empresa:', error);
      return null;
    }
  };

  const carregarFuncionarios = async (empresaId: string) => {
    try {
      const chaveDinamica = `funcionarios_${empresaId}`;
      const dados = await AsyncStorage.getItem(chaveDinamica);
      if (dados) {
        const funcionariosCarregados = JSON.parse(dados);
        const funcionariosComPin = funcionariosCarregados.map((func: any) => ({
          ...func,
          pin: func.pin || '',
        }));
        setFuncionarios(funcionariosComPin);
      } else {
        setFuncionarios([]);
      }
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  const carregarDias = async (empresaId: string) => {
    try {
      const chaveDias = `dias_${empresaId}`;
      const dados = await AsyncStorage.getItem(chaveDias);
      const hoje = hojeString();

      if (dados) {
        const parsed: Dia[] = JSON.parse(dados);
        setDias(parsed);
        const diaEncontrado = parsed.find(d => d.data === hoje);
        setDiaAtual(diaEncontrado || { data: hoje, batidas: [] });
      } else {
        setDiaAtual({ data: hoje, batidas: [] });
      }
    } catch (error) {
      console.error('Erro ao carregar dias:', error);
    }
  };

  const salvarDias = async (novosDias: Dia[]) => {
    if (!empresa) return;
    const hoje = hojeString();
    const chaveDias = `dias_${empresa.id}`;

    await AsyncStorage.setItem(chaveDias, JSON.stringify(novosDias));
    setDias(novosDias);

    const diaAtualizado = novosDias.find(d => d.data === hoje) || { data: hoje, batidas: [] };
    setDiaAtual(diaAtualizado);
  };

  const hojeString = () => {
    const data = new Date();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  };

  const horaLocalISO = () => {
    const d = new Date();
    return `${hojeString()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const getOrdemTipos = (): BatidaTipo[] => {
    return empresa?.controleAlmoco
      ? ['entrada', 'saida_almoco', 'retorno_almoco', 'saida_final']
      : ['entrada', 'saida_final'];
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

  const iniciarBaterPonto = async () => {
    if (!funcionarioSelecionado || !empresa) return;

    const tipo = proxTipo();
    if (!tipo) {
      Alert.alert('Completo', 'Todas as batidas de hoje já foram realizadas.');
      return;
    }

    setTipoBatidaAtual(tipo);
    const funcionario = funcionarios.find(f => f.id === funcionarioSelecionado);

    if (funcionario?.pin) {
      setPinDigitado('');
      setModalPinVisivel(true);
    } else {
      if (!permission?.granted) {
        const { status } = await requestPermission();
        if (status !== 'granted') return Alert.alert('Aviso', 'Acesso à câmera negado.');
      }
      setCameraVisivel(true);
    }
  };

  const verificarPin = (pin: string) => {
    const funcionario = funcionarios.find(f => f.id === funcionarioSelecionado);
    if (funcionario?.pin === pin) {
      setModalPinVisivel(false);
      setCameraVisivel(true);
    } else {
      Alert.alert('Erro', 'PIN incorreto.');
      setPinDigitado('');
    }
  };

  const capturarFotoERegistrarPonto = async () => {
    if (cameraRef.current && tipoBatidaAtual) {
      try {
        setTimeout(async () => {
          const photo = await cameraRef.current?.takePictureAsync({ quality: 0.4 });
          if (photo) {
            setCameraVisivel(false);
            await registrarBatida(tipoBatidaAtual, photo.uri);
            setTipoBatidaAtual(null);
          }
        }, 800);
      } catch (e) {
        setCameraVisivel(false);
        Alert.alert('Erro', 'Erro ao capturar foto.');
      }
    }
  };

  const registrarBatida = async (tipo: BatidaTipo, photoUri?: string) => {
    if (!funcionarioSelecionado || !empresa || !diaAtual) return;

    const novaBatida: Batida = {
      id: Date.now().toString(),
      tipo,
      timestamp: horaLocalISO(),
      funcionarioId: funcionarioSelecionado,
      photoUri,
    };

    const novoDia: Dia = {
      ...diaAtual,
      batidas: [...diaAtual.batidas, novaBatida],
    };

    const novosDias = [novoDia, ...dias.filter(d => d.data !== diaAtual.data)];
    await salvarDias(novosDias);

    animarBotao();
    mostrarFeedback(tipo);
  };

  const animarBotao = () => {
    Animated.sequence([
      Animated.timing(animacaoPonto, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(animacaoPonto, { toValue: 1, duration: 200, useNativeDriver: true, easing: Easing.elastic(1.5) })
    ]).start();
  };

  const mostrarFeedback = (tipo: string) => {
    setMostrarFeedbacks(prev => ({ ...prev, [tipo]: true }));
    setTimeout(() => setMostrarFeedbacks(prev => ({ ...prev, [tipo]: false })), 2000);
  };

  const handlePinPress = (num: string) => {
    if (pinDigitado.length < 4) {
      const novoPin = pinDigitado + num;
      setPinDigitado(novoPin);
      if (novoPin.length === 4) setTimeout(() => verificarPin(novoPin), 300);
    }
  };

  const apagarUltimo = () => setPinDigitado(pinDigitado.slice(0, -1));

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

  const formatarData = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const funcionarioAtual = funcionarios.find(f => f.id === funcionarioSelecionado);
  const batidasFiltradas = diaAtual?.batidas.filter(b => b.funcionarioId === funcionarioSelecionado) || [];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2927B4', '#12114E']} style={styles.headerGradient}>
        <Text style={styles.titulo}>Registro de Ponto</Text>
        <Text style={styles.dataAtual}>{formatarData(hojeString())}</Text>
      </LinearGradient>

      <View style={styles.content}>
        {!empresa && (
          <View style={styles.alertBox}>
            <Ionicons name="warning-outline" size={20} color="#856404" />
            <Text style={styles.alertText}>Configure a empresa nas Configurações</Text>
          </View>
        )}

        <Text style={styles.subtitulo}>Selecione o Funcionário</Text>

        {!funcionarioSelecionado ? (
          <FlatList
            data={funcionarios}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.funcionarioCard} onPress={() => setFuncionarioSelecionado(item.id)}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.funcionarioInfo}>
                  <Text style={styles.funcionarioNome}>{item.nome}</Text>
                  <Text style={styles.funcionarioStatus}>{item.cargaDiariaHoras}h diárias</Text>
                  <Text style={item.pin ? styles.pinInfo : styles.pinInfoAviso}>
                    {item.pin ? 'PIN cadastrado' : 'Sem PIN'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            )}
            style={{ width: '100%' }}
          />
        ) : (
          <View style={styles.funcionarioSelecionadoCard}>
            <View style={styles.funcionarioSelecionadoHeader}>
              <View style={styles.avatarPlaceholderAtivo}>
                <Text style={styles.avatarTextAtivo}>{funcionarioAtual?.nome.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.funcionarioSelecionadoInfo}>
                <Text style={styles.funcionarioNomeAtivo}>{funcionarioAtual?.nome}</Text>
                <Text style={styles.funcionarioStatusAtivo}>{funcionarioAtual?.cargaDiariaHoras}h diárias</Text>
              </View>
              <TouchableOpacity style={styles.btnTrocarFuncionario} onPress={() => setFuncionarioSelecionado(null)}>
                <Ionicons name="swap-horizontal" size={20} color="#2927B4" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {empresa && funcionarioSelecionado && (
          <Animated.View style={{ transform: [{ scale: animacaoPonto }] }}>
            <TouchableOpacity onPress={iniciarBaterPonto} activeOpacity={0.9}>
              <LinearGradient colors={['#2927B4', '#12114E']} style={styles.btnPonto}>
                <View style={styles.btnPontoContent}>
                  <Ionicons name="finger-print" size={32} color="#fff" style={styles.btnPontoIcon} />
                  <View>
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
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            </View>
          )}
          style={{ marginTop: 10 }}
        />
      </View>

      {/* Modal PIN */}
      <Modal visible={modalPinVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Digite seu PIN</Text>
            <View style={styles.dotsContainer}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={[styles.dot, pinDigitado.length >= i && styles.dotActive]} />
              ))}
            </View>
            <View style={styles.teclado}>
              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['C', '0', '⌫']].map((row, i) => (
                <View key={i} style={styles.linhaTeclado}>
                  {row.map(key => (
                    <TouchableOpacity key={key} style={styles.tecla} onPress={() => {
                      if (key === '⌫') apagarUltimo();
                      else if (key === 'C') setPinDigitado('');
                      else handlePinPress(key);
                    }}>
                      <Text style={styles.textoTecla}>{key}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={() => setModalPinVisivel(false)} style={styles.btnFechar}>
              <Text style={styles.txtFechar}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Câmera */}
      <Modal visible={cameraVisivel} animationType="fade">
        <CameraView style={styles.fullCamera} facing="front" ref={cameraRef} onCameraReady={capturarFotoERegistrarPonto}>
          <View style={styles.cameraOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.cameraText}>Processando...</Text>
          </View>
        </CameraView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  headerGradient: { paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  dataAtual: { fontSize: 14, color: '#fff', textAlign: 'center', marginTop: 5, textTransform: 'capitalize' },
  content: { flex: 1, padding: 20 },
  subtitulo: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  alertBox: { backgroundColor: '#fff3cd', padding: 15, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  alertText: { color: '#856404', marginLeft: 10, fontSize: 13 },
  funcionarioCard: { backgroundColor: '#fff', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10, elevation: 2 },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#e2e2ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontWeight: 'bold', color: '#2927B4' },
  funcionarioInfo: { flex: 1 },
  funcionarioNome: { fontWeight: 'bold', color: '#333' },
  funcionarioStatus: { fontSize: 12, color: '#666' },
  pinInfo: { fontSize: 11, color: '#27ae60' },
  pinInfoAviso: { fontSize: 11, color: '#e74c3c' },
  funcionarioSelecionadoCard: { backgroundColor: '#fff', padding: 15, borderRadius: 15, borderWidth: 2, borderColor: '#2927B4', marginBottom: 15 },
  funcionarioSelecionadoHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholderAtivo: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2927B4', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarTextAtivo: { color: '#fff', fontWeight: 'bold' },
  funcionarioSelecionadoInfo: { flex: 1 },
  funcionarioNomeAtivo: { fontWeight: 'bold', fontSize: 16 },
  funcionarioStatusAtivo: { fontSize: 12, color: '#666' },
  btnTrocarFuncionario: { padding: 8, backgroundColor: '#f0f0ff', borderRadius: 8 },
  btnPonto: { padding: 20, borderRadius: 15, elevation: 4 },
  btnPontoContent: { flexDirection: 'row', alignItems: 'center' },
  btnPontoIcon: { marginRight: 15 },
  btnPontoTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  btnPontoSubtitulo: { color: '#eee', fontSize: 13 },
  batidaCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8, elevation: 1 },
  batidaIconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  batidaInfo: { flex: 1 },
  batidaTipo: { fontWeight: '600', color: '#333' },
  batidaHora: { fontSize: 12, color: '#666' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, alignItems: 'center' },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  dotsContainer: { flexDirection: 'row', marginBottom: 25 },
  dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: '#2927B4', marginHorizontal: 10 },
  dotActive: { backgroundColor: '#2927B4' },
  teclado: { width: '100%' },
  linhaTeclado: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  tecla: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  textoTecla: { fontSize: 22, fontWeight: 'bold', color: '#2927B4' },
  btnFechar: { marginTop: 15 },
  txtFechar: { color: 'red', fontWeight: 'bold' },
  fullCamera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  cameraText: { color: '#fff', marginTop: 15, fontWeight: 'bold' }
});