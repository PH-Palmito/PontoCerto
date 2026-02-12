import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router'; // IMPORTANTE
import React, { useEffect, useState, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

// FIREBASE
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../utils/firebaseConfig"; // Ajuste seu caminho

// ... (MANTENHA OS TIPOS BatidaTipo, Batida, Dia, Funcionario, Empresa IGUAIS AO ANTERIOR) ...
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
  cargo?: string;
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
  senhaAdmin?: string;
};

export default function HomeScreen() { // Mudei o nome para HomeScreen
  const router = useRouter(); // Hook de navegação

  // ESTADOS
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);
  const [carregandoApp, setCarregandoApp] = useState(true);
  const [dias, setDias] = useState<Dia[]>([]);
  const [diaAtual, setDiaAtual] = useState<Dia | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string | null>(null);

  // UI & Câmera
  const [animacaoPonto] = useState(new Animated.Value(1));
  const [mostrarFeedbacks, setMostrarFeedbacks] = useState<{[key: string]: boolean}>({});
  const [modalPinVisivel, setModalPinVisivel] = useState(false);
  const [cameraVisivel, setCameraVisivel] = useState(false);
  const [pinDigitado, setPinDigitado] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [tipoBatidaAtual, setTipoBatidaAtual] = useState<BatidaTipo | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // CARREGAMENTO INICIAL
  useEffect(() => {
    verificarLoginSalvo();
  }, []);

  const verificarLoginSalvo = async () => {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUsuarioLogado(user);
        await carregarDadosDoTotem(user.uid);
      } else {
        // Se não tiver logado, o _layout root vai jogar pro index (login), mas por segurança:
        setCarregandoApp(false);
      }
    });
  };

  const carregarDadosDoTotem = async (userId: string) => {
    try {
      // 1. Tenta pegar atualizado do Firebase
      const docRef = doc(db, "empresas", userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const dados = docSnap.data();
        await AsyncStorage.setItem('empresa', JSON.stringify(dados.empresa));
        await AsyncStorage.setItem('funcionarios', JSON.stringify(dados.funcionarios));
        setEmpresa(dados.empresa);
        setFuncionarios(dados.funcionarios || []);
      } else {
        // Fallback local
        const localEmp = await AsyncStorage.getItem('empresa');
        const localFunc = await AsyncStorage.getItem('funcionarios');
        if (localEmp) setEmpresa(JSON.parse(localEmp));
        if (localFunc) setFuncionarios(JSON.parse(localFunc));
      }
      carregarDias();
    } catch (error) {
      console.log("Erro sync:", error);
      // Fallback local em caso de erro
      const localEmp = await AsyncStorage.getItem('empresa');
      const localFunc = await AsyncStorage.getItem('funcionarios');
      if (localEmp) setEmpresa(JSON.parse(localEmp));
      if (localFunc) setFuncionarios(JSON.parse(localFunc));
      carregarDias();
    } finally {
      setCarregandoApp(false);
    }
  };

  // ... (MANTENHA AS FUNÇÕES DE LÓGICA DE PONTO IGUAIS: hojeString, horaLocalISO, carregarDias, salvarDias, etc...)
  const hojeString = () => {
    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const horaLocalISO = () => {
    const data = new Date();
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
    if (dados) {
      const parsed: Dia[] = JSON.parse(dados);
      setDias(parsed);
      const diaEncontrado = parsed.find(d => d.data === hoje);
      setDiaAtual(diaEncontrado || { data: hoje, batidas: [] });
    } else {
      setDiaAtual({ data: hoje, batidas: [] });
    }
  };

  const salvarDias = async (novosDias: Dia[]) => {
    const hoje = hojeString();
    await AsyncStorage.setItem('dias', JSON.stringify(novosDias));
    setDias(novosDias);
    setDiaAtual(novosDias.find(d => d.data === hoje) || { data: hoje, batidas: [] });
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

  const animarBotao = () => {
    Animated.sequence([
      Animated.timing(animacaoPonto, { toValue: 0.95, duration: 100, useNativeDriver: true, easing: Easing.ease }),
      Animated.timing(animacaoPonto, { toValue: 1, duration: 200, useNativeDriver: true, easing: Easing.elastic(1.5) })
    ]).start();
  };

  const mostrarFeedback = (tipo: string) => {
    setMostrarFeedbacks(prev => ({...prev, [tipo]: true}));
    setTimeout(() => setMostrarFeedbacks(prev => ({...prev, [tipo]: false})), 2000);
  };

  const iniciarBaterPonto = async () => {
    if (!funcionarioSelecionado) return Alert.alert('Selecione um funcionário');
    if (!empresa) return Alert.alert('Erro', 'Empresa não carregada');

    const tipo = proxTipo();
    if (!tipo) return Alert.alert('Completo', 'Jornada finalizada por hoje.');

    setTipoBatidaAtual(tipo);

    const funcionario = funcionarios.find(f => f.id === funcionarioSelecionado);
    if (funcionario?.pin) {
      setPinDigitado('');
      setModalPinVisivel(true);
    } else {
      if (!permission?.granted) {
        const { status } = await requestPermission();
        if (status !== 'granted') return Alert.alert('Permissão de câmera necessária');
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
      Alert.alert('PIN incorreto');
      setPinDigitado('');
    }
  };

  const capturarFotoERegistrarPonto = async () => {
    if (cameraRef.current && tipoBatidaAtual) {
      try {
        setTimeout(async () => {
            const photo = await cameraRef.current?.takePictureAsync({ quality: 0.4, base64: false });
            if (photo) {
            setPhotoUri(photo.uri);
            setCameraVisivel(false);
            await registrarBatida(tipoBatidaAtual, photo.uri);
            setTipoBatidaAtual(null);
            setPhotoUri(null);
            }
        }, 800);
      } catch (e) {
        setCameraVisivel(false);
        setTipoBatidaAtual(null);
        Alert.alert('Erro na foto');
      }
    }
  };

  const registrarBatida = async (tipo: BatidaTipo, photoUri?: string) => {
    if (!funcionarioSelecionado || !diaAtual) return;
    const novaBatida: Batida = {
      id: Date.now().toString(),
      tipo,
      timestamp: horaLocalISO(),
      funcionarioId: funcionarioSelecionado,
      photoUri: photoUri,
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

  const handlePinPress = (num: string) => {
    if (pinDigitado.length < 4) {
      const novoPin = pinDigitado + num;
      setPinDigitado(novoPin);
      if (novoPin.length === 4) setTimeout(() => verificarPin(novoPin), 300);
    }
  };
  const apagarUltimo = () => setPinDigitado(pinDigitado.slice(0, -1));

  const handleLogout = async () => {
      Alert.alert("Sair", "Deseja desconectar este Totem?", [
        { text: "Cancelar" },
        { text: "Sair", style: 'destructive', onPress: async () => {
            await signOut(auth);
            // O porteiro (app/index.tsx) vai detectar o logout e jogar pra tela de login
        }}
      ])
    };

  const formatarData = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const rotuloBatida: Record<BatidaTipo, string> = {
    entrada: 'Entrada', saida_almoco: 'Início Pausa', retorno_almoco: 'Fim Pausa', saida_final: 'Saída',
  };

  // ================= RENDERIZAR =================

  if (carregandoApp) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2927B4" /></View>;
  }

  const funcionarioAtual = funcionarios.find(f => f.id === funcionarioSelecionado);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2927B4', '#12114E']} style={styles.headerGradient}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
           <View>
             <Text style={styles.titulo}>{empresa?.nome || "Empresa"}</Text>
             <Text style={styles.dataAtual}>{formatarData(hojeString())}</Text>
           </View>
           <TouchableOpacity onPress={handleLogout} style={{padding: 5}}>
             <Ionicons name="log-out-outline" size={24} color="#fff" opacity={0.6} />
           </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.content}>

        {/* TÍTULO */}
        <Text style={styles.subtitulo}>Quem vai bater ponto?</Text>

        {/* LOGICA DO EMPTY STATE (Sem funcionários) */}
        {funcionarios.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="people-outline" size={60} color="#2927B4" />
            </View>
            <Text style={styles.emptyTitle}>Nenhum funcionário cadastrado</Text>
            <Text style={styles.emptySubtitle}>
              Para começar a usar o totem, você precisa cadastrar seus colaboradores nas configurações.
            </Text>

            <TouchableOpacity
              style={styles.btnIrConfigs}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <Text style={styles.btnIrConfigsText}>CADASTRAR AGORA</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={{marginLeft: 8}}/>
            </TouchableOpacity>
          </View>
        ) : (
          // SE TIVER FUNCIONÁRIOS, MOSTRA A LISTA OU O SELECIONADO
          <>
            {!funcionarioSelecionado ? (
              <FlatList
                data={funcionarios}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.funcionarioCard} onPress={() => setFuncionarioSelecionado(item.id)}>
                    <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text></View>
                    <View style={styles.funcionarioInfo}>
                      <Text style={styles.funcionarioNome}>{item.nome}</Text>
                      <Text style={styles.funcionarioStatus}>{item.cargo || 'Colaborador'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                )}
                style={{ width: '100%' }}
              />
            ) : (
              <View style={styles.funcionarioSelecionadoCard}>
                <View style={styles.funcionarioSelecionadoHeader}>
                  <View style={styles.avatarPlaceholderAtivo}><Text style={styles.avatarTextAtivo}>{funcionarioAtual?.nome.charAt(0).toUpperCase()}</Text></View>
                  <View style={styles.funcionarioSelecionadoInfo}>
                    <Text style={styles.funcionarioNomeAtivo}>{funcionarioAtual?.nome}</Text>
                    <Text style={styles.funcionarioStatusAtivo}>{funcionarioAtual?.cargo}</Text>
                  </View>
                  <TouchableOpacity style={styles.btnTrocarFuncionario} onPress={() => setFuncionarioSelecionado(null)}>
                    <Ionicons name="swap-horizontal" size={20} color="#2927B4" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={iniciarBaterPonto} activeOpacity={0.9}>
                    <LinearGradient colors={['#2927B4', '#12114E']} style={styles.btnPonto}>
                      <View style={styles.btnPontoContent}>
                        <Ionicons name="finger-print" size={32} color="#fff" style={{marginRight: 15}} />
                        <View>
                          <Text style={styles.btnPontoTitulo}>REGISTRAR PONTO</Text>
                          <Text style={styles.btnPontoSubtitulo}>{proxTipo() ? rotuloBatida[proxTipo() as BatidaTipo] : 'Jornada Completa'}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                </TouchableOpacity>

                {mostrarFeedbacks[proxTipo() || ''] && (
                  <View style={styles.feedbackBox}>
                    <Text style={styles.feedbackText}>Registro salvo com sucesso!</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* MANTENHA OS MODAIS IGUAIS (PIN e CÂMERA) */}
      <Modal visible={modalPinVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Digite seu PIN</Text>
            <Text style={styles.modalSubtitulo}>{funcionarioAtual?.nome}</Text>
            <View style={styles.dotsContainer}>
              {[1, 2, 3, 4].map((i) => <View key={i} style={[styles.dot, pinDigitado.length >= i && styles.dotActive]} />)}
            </View>
            <View style={styles.teclado}>
              {[['1','2','3'],['4','5','6'],['7','8','9'],['C','0','⌫']].map((row, i) => (
                <View key={i} style={styles.linhaTeclado}>
                  {row.map((key) => (
                    <TouchableOpacity key={key} style={styles.tecla} onPress={() => key === '⌫' ? apagarUltimo() : key === 'C' ? setPinDigitado('') : handlePinPress(key)}>
                      <Text style={styles.textoTecla}>{key}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={() => setModalPinVisivel(false)} style={styles.btnFechar}><Text style={styles.txtFechar}>CANCELAR</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={cameraVisivel} animationType="fade">
        <CameraView style={{flex: 1}} facing="front" ref={cameraRef} onCameraReady={() => setTimeout(capturarFotoERegistrarPonto, 800)}>
          <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)'}}>
             <Text style={{color: '#fff', fontSize: 20, marginTop: 20}}>Identificando...</Text>
             <ActivityIndicator size="large" color="#fff" style={{marginTop: 20}}/>
          </View>
        </CameraView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  headerGradient: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  dataAtual: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  content: { flex: 1, padding: 20 },
  subtitulo: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 15 },

  // Empty State Styles (Novo)
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e2e2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', maxWidth: '80%', marginBottom: 30 },
  btnIrConfigs: { flexDirection: 'row', backgroundColor: '#2927B4', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, alignItems: 'center', elevation: 5 },
  btnIrConfigsText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Styles Antigos
  funcionarioCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 2 },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#e2e2ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#2927B4' },
  funcionarioInfo: { flex: 1 },
  funcionarioNome: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  funcionarioStatus: { color: '#666' },
  funcionarioSelecionadoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 4 },
  funcionarioSelecionadoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarPlaceholderAtivo: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#2927B4', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarTextAtivo: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  funcionarioSelecionadoInfo: { flex: 1 },
  funcionarioNomeAtivo: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  funcionarioStatusAtivo: { color: '#666' },
  btnTrocarFuncionario: { padding: 10, backgroundColor: '#f0f0f0', borderRadius: 20 },
  btnPonto: { borderRadius: 15, padding: 25, elevation: 5 },
  btnPontoContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnPontoTitulo: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  btnPontoSubtitulo: { color: '#ddd', fontSize: 14 },
  feedbackBox: { marginTop: 15, backgroundColor: '#d4edda', padding: 10, borderRadius: 8, alignItems: 'center' },
  feedbackText: { color: '#155724', fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: 'center' },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalSubtitulo: { fontSize: 16, marginBottom: 20, color: '#666' },
  dotsContainer: { flexDirection: 'row', marginBottom: 20 },
  dot: { width: 15, height: 15, borderRadius: 10, borderWidth: 1, borderColor: '#2927B4', margin: 5 },
  dotActive: { backgroundColor: '#2927B4' },
  teclado: { width: '100%' },
  linhaTeclado: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  tecla: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  textoTecla: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  btnFechar: { marginTop: 10, padding: 10 },
  txtFechar: { color: 'red', fontWeight: 'bold' }
});