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
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../utils/firebaseConfig';
import { getStorageKeys } from '../../utils/storage';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { app } from '../../utils/firebaseConfig';
import NetInfo from '@react-native-community/netinfo';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
  latitude?: number;
  longitude?: number;
  raioPermitido?: number;
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

  // 🔹 Controle de processamento para evitar múltiplos toques
  const [isProcessing, setIsProcessing] = useState(false);

  // 🔹 Animação do feedback de confirmação
  const [feedbackAnim] = useState(new Animated.Value(0));

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [uid, setUid] = useState<string | null>(null);
  const db = getFirestore(app);
  const [isOnline, setIsOnline] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ciclo de carregamento
  useEffect(() => {
    if (uid) {
      inicializarDados();
    }
  }, [uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setUid(user?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return unsubscribe;
  }, []);

  // Ao ficar online, sincroniza dados e fotos pendentes
  useEffect(() => {
    if (isOnline && dias.length > 0) {
      sincronizarTudo();
      sincronizarFotosPendentes();
    }
  }, [isOnline, dias]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

  // Limpeza do timeout ao desmontar
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const sincronizarDiaFirestore = async (dia: Dia) => {
    if (!uid) return;
    try {
      const diaRef = doc(db, 'empresas', uid, 'dias', dia.data);
      await setDoc(diaRef, {
        data: dia.data,
        batidas: dia.batidas,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Erro ao sincronizar com Firestore:', error);
    }
  };

  const sincronizarTudo = async () => {
    if (!uid) return;
    try {
      for (const dia of dias) {
        await sincronizarDiaFirestore(dia);
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    }
  };

  const inicializarDados = async () => {
    const empresaCarregada = await carregarEmpresa();
    if (empresaCarregada) {
      await carregarFuncionarios(empresaCarregada.id);
      await carregarDias(empresaCarregada.id);
    }
  };

  const carregarEmpresa = async (): Promise<Empresa | null> => {
    try {
      if (!uid) return null;
      const keys = getStorageKeys(uid);
      const dados = await AsyncStorage.getItem(keys.empresa);
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
      if (!uid) return;
      const keys = getStorageKeys(uid);
      const dados = await AsyncStorage.getItem(keys.funcionarios);
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
      if (!uid) return;
      const keys = getStorageKeys(uid);
      const dados = await AsyncStorage.getItem(keys.dias);
      const hoje = hojeString();

      if (dados) {
        const parsed: Dia[] = JSON.parse(dados);
        setDias(parsed);

        let diaEncontrado = parsed.find(d => d.data === hoje);

        if (!diaEncontrado) {
          diaEncontrado = { data: hoje, batidas: [] };
          const atualizados = [diaEncontrado, ...parsed];
          await AsyncStorage.setItem(keys.dias, JSON.stringify(atualizados));
          setDias(atualizados);
        }

        setDiaAtual(diaEncontrado);
      } else {
        const novoDia = { data: hoje, batidas: [] };
        await AsyncStorage.setItem(keys.dias, JSON.stringify([novoDia]));
        setDias([novoDia]);
        setDiaAtual(novoDia);
      }
    } catch (error) {
      console.error('Erro ao carregar dias:', error);
    }
  };

  const salvarDias = async (novosDias: Dia[]) => {
    if (!empresa || !uid) return;
    const keys = getStorageKeys(uid);
    await AsyncStorage.setItem(keys.dias, JSON.stringify(novosDias));
    setDias(novosDias);

    const hoje = hojeString();
    const diaAtualizado =
      novosDias.find(d => d.data === hoje) || { data: hoje, batidas: [] };

    setDiaAtual(diaAtualizado);
    if (isOnline) {
      await sincronizarDiaFirestore(diaAtualizado);
    }
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

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Busca a hora oficial da internet (Brasília/Bahia)
  const obterHoraOficial = async (): Promise<string | null> => {
    try {
      const response = await fetch('https://worldtimeapi.org/api/timezone/America/Bahia');
      const data = await response.json();
      return data.datetime.slice(0, 19);
    } catch (error) {
      console.warn('Erro ao buscar hora oficial:', error);
      return null;
    }
  };

  // Upload de imagem para o Firebase Storage
  const uploadImageParaFirebase = async (uri: string, funcionarioId: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storage = getStorage(app);
      const fileName = `pontos/${funcionarioId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);

      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.error('Erro no upload da imagem:', error);
      return null;
    }
  };

  // Sincroniza fotos pendentes (locais) para a nuvem e apaga localmente
  const sincronizarFotosPendentes = async () => {
    if (!uid || !diaAtual) return;

    const batidasComFotoLocal = diaAtual.batidas.filter(
      b => b.photoUri && !b.photoUri.startsWith('http')
    );

    if (batidasComFotoLocal.length === 0) return;

    let houveAlteracao = false;
    const novasBatidas = [...diaAtual.batidas];

    for (let i = 0; i < novasBatidas.length; i++) {
      const batida = novasBatidas[i];
      if (batida.photoUri && !batida.photoUri.startsWith('http')) {
        const urlNuvem = await uploadImageParaFirebase(batida.photoUri, batida.funcionarioId);
        if (urlNuvem) {
          // Remove o arquivo local após upload bem-sucedido
          await FileSystem.deleteAsync(batida.photoUri, { idempotent: true });
          // Atualiza a batida com a URL da nuvem
          novasBatidas[i] = { ...batida, photoUri: urlNuvem };
          houveAlteracao = true;
        }
      }
    }

    if (houveAlteracao) {
      const novoDia = { ...diaAtual, batidas: novasBatidas };
      const novosDias = [novoDia, ...dias.filter(d => d.data !== diaAtual.data)];
      await salvarDias(novosDias);
    }
  };

  // Reset automático do totem após registro
  const resetarTotem = () => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = setTimeout(() => {
      setFuncionarioSelecionado(null);
      setPinDigitado('');
      setIsProcessing(false); // 🔹 Importante: liberar processamento
      resetTimeoutRef.current = null;
    }, 3000);
  };

  const iniciarBaterPonto = async () => {
    if (!funcionarioSelecionado || !empresa) return;
    if (isProcessing) {
      Alert.alert('Aguarde', 'Processando registro anterior...');
      return;
    }

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
      setIsProcessing(true);  // 🔹 Inicia processamento
      setCameraVisivel(true);
    }
  };

  const verificarPin = (pin: string) => {
    const funcionario = funcionarios.find(f => f.id === funcionarioSelecionado);
    if (funcionario?.pin === pin) {
      setModalPinVisivel(false);
      setIsProcessing(true);  // 🔹 Inicia processamento
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
          setIsProcessing(false); // 🔹 Finaliza processamento
        }, 800);
      } catch (e) {
        setCameraVisivel(false);
        setIsProcessing(false);
        Alert.alert('Erro', 'Erro ao capturar foto.');
      }
    }
  };

  // FUNÇÃO REGISTRAR BATIDA (com hora oficial, GPS e reset)
  const registrarBatida = async (tipo: BatidaTipo, photoUriLocal?: string) => {
    if (!funcionarioSelecionado || !empresa || !diaAtual) return;

    // 1. Validação de localização
    if (!empresa.latitude || !empresa.longitude) {
      Alert.alert('Configuração pendente', 'A localização da empresa não foi definida.');
      setIsProcessing(false);
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erro de segurança', 'A localização é obrigatória.');
      setIsProcessing(false);
      return;
    }

    const localizacao = await Location.getCurrentPositionAsync({});
    const distancia = calcularDistancia(
      localizacao.coords.latitude,
      localizacao.coords.longitude,
      empresa.latitude,
      empresa.longitude
    );

    const raio = empresa.raioPermitido || 100;
    if (distancia > raio) {
      Alert.alert('Fora do perímetro', `Você está a ${Math.round(distancia)}m da empresa.`);
      setIsProcessing(false);
      return;
    }

    // 2. Obter hora oficial (com fallback)
    let timestampFinal = horaLocalISO();
    const horaOficial = await obterHoraOficial();
    if (horaOficial) {
      timestampFinal = horaOficial;
    } else {
      console.log('Usando hora do dispositivo (modo offline)');
    }

    // 3. Criar e salvar batida
    const novaBatida: Batida = {
      id: Date.now().toString(),
      tipo,
      timestamp: timestampFinal,
      funcionarioId: funcionarioSelecionado,
      photoUri: photoUriLocal, // Pode ser local ou indefinido
    };

    const novoDia: Dia = {
      ...diaAtual,
      batidas: [...diaAtual.batidas, novaBatida],
    };

    const novosDias = [novoDia, ...dias.filter(d => d.data !== diaAtual.data)];
    await salvarDias(novosDias);

    animarBotao();
    mostrarFeedback(tipo);

    // 4. Reset automático do totem
    resetarTotem();
  };

  const animarBotao = () => {
    Animated.sequence([
      Animated.timing(animacaoPonto, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(animacaoPonto, { toValue: 1, duration: 200, useNativeDriver: true, easing: Easing.elastic(1.5) })
    ]).start();
  };

  const mostrarFeedback = (tipo: string) => {
    setMostrarFeedbacks(prev => ({ ...prev, [tipo]: true }));
    // Animação de entrada
    Animated.timing(feedbackAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Aguarda 1.5s e desaparece
      setTimeout(() => {
        Animated.timing(feedbackAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setMostrarFeedbacks(prev => ({ ...prev, [tipo]: false }));
        });
      }, 1500);
    });
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
            <TouchableOpacity onPress={iniciarBaterPonto} activeOpacity={0.9} disabled={isProcessing}>
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
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.batidaFoto} />
              ) : (
                <View style={[styles.batidaIconContainer, { backgroundColor: `${corBatida[item.tipo]}15` }]}>
                  <Ionicons name={iconeBatida[item.tipo]} size={24} color={corBatida[item.tipo]} />
                </View>
              )}
              <View style={styles.batidaInfo}>
                <Text style={styles.batidaTipo}>{rotuloBatida[item.tipo]}</Text>
                <Text style={styles.batidaHora}>{item.timestamp.slice(11, 16)}</Text>
              </View>
              {/* Indicador de sincronização da foto */}
              <Ionicons
                name={item.photoUri?.startsWith('http') ? 'cloud-done' : 'time-outline'}
                size={16}
                color={item.photoUri?.startsWith('http') ? '#4CAF50' : '#999'}
              />
            </View>
          )}
          style={{ marginTop: 10 }}
        />
      </View>

      {/* Overlay de feedback de confirmação */}
      {mostrarFeedbacks[tipoBatidaAtual!] && (
        <Animated.View style={[styles.feedbackOverlay, { opacity: feedbackAnim }]}>
          <View style={styles.feedbackContent}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <Text style={styles.feedbackText}>Ponto registrado!</Text>
          </View>
        </Animated.View>
      )}

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
  batidaCard: { backgroundColor: '#fff', padding: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8, elevation: 1 },
  batidaFoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
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
  cameraText: { color: '#fff', marginTop: 15, fontWeight: 'bold' },
  // Estilos do feedback
  feedbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  feedbackContent: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  feedbackText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});