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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../utils/firebaseConfig';
import { getStorageKeys } from '../../utils/storage';

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
  nome: string;
  controleAlmoco: boolean;
};

const { width } = Dimensions.get('window');

export default function PontoScreen() {
  const [uid, setUid] = useState<string | null>(null);

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [dias, setDias] = useState<Dia[]>([]);
  const [diaAtual, setDiaAtual] = useState<Dia | null>(null);

  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string | null>(null);
  const [modalPinVisivel, setModalPinVisivel] = useState(false);
  const [pinDigitado, setPinDigitado] = useState('');
  const [cameraVisivel, setCameraVisivel] = useState(false);
  const [tipoBatidaAtual, setTipoBatidaAtual] = useState<BatidaTipo | null>(null);

  const animacaoPonto = useRef(new Animated.Value(1)).current;
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  /* ================= AUTH ================= */

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setUid(user?.uid ?? null);
    });
    return unsub;
  }, []);

  /* ================= LOAD ================= */

  const hojeString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const horaISO = () => {
    const d = new Date();
    return `${hojeString()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const carregarDados = async (uid: string) => {
    const keys = getStorageKeys(uid);

    const empresaRaw = await AsyncStorage.getItem(keys.empresa);
    const funcsRaw = await AsyncStorage.getItem(keys.funcionarios);
    const diasRaw = await AsyncStorage.getItem(keys.dias);

    if (empresaRaw) setEmpresa(JSON.parse(empresaRaw));
    if (funcsRaw) setFuncionarios(JSON.parse(funcsRaw));
    if (diasRaw) {
      const parsed: Dia[] = JSON.parse(diasRaw);
      setDias(parsed);
      const hoje = hojeString();
      setDiaAtual(parsed.find(d => d.data === hoje) || { data: hoje, batidas: [] });
    } else {
      setDiaAtual({ data: hojeString(), batidas: [] });
    }
  };

  useEffect(() => {
    if (uid) carregarDados(uid);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      if (uid) carregarDados(uid);
    }, [uid])
  );

  if (!uid) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  /* ================= LOGIC ================= */

  const ordemBatidas = (): BatidaTipo[] =>
    empresa?.controleAlmoco
      ? ['entrada', 'saida_almoco', 'retorno_almoco', 'saida_final']
      : ['entrada', 'saida_final'];

  const proximaBatida = (): BatidaTipo | null => {
    if (!diaAtual || !funcionarioSelecionado) return null;
    const feitas = diaAtual.batidas
      .filter(b => b.funcionarioId === funcionarioSelecionado)
      .map(b => b.tipo);

    return ordemBatidas().find(t => !feitas.includes(t)) || null;
  };

  const salvarDias = async (novosDias: Dia[]) => {
    const keys = getStorageKeys(uid);
    await AsyncStorage.setItem(keys.dias, JSON.stringify(novosDias));
    setDias(novosDias);
    setDiaAtual(novosDias.find(d => d.data === hojeString()) || null);
  };

  const registrarBatida = async (tipo: BatidaTipo) => {
    if (!diaAtual || !funcionarioSelecionado) return;

    const nova: Batida = {
      id: Date.now().toString(),
      tipo,
      timestamp: horaISO(),
      funcionarioId: funcionarioSelecionado,
    };

    const atualizado: Dia = {
      ...diaAtual,
      batidas: [...diaAtual.batidas, nova],
    };

    const novosDias = [atualizado, ...dias.filter(d => d.data !== diaAtual.data)];
    await salvarDias(novosDias);

    Animated.sequence([
      Animated.timing(animacaoPonto, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(animacaoPonto, { toValue: 1, duration: 200, easing: Easing.elastic(1.3), useNativeDriver: true }),
    ]).start();
  };

  const iniciarBatida = async () => {
    const tipo = proximaBatida();
    if (!tipo) return Alert.alert('Aviso', 'Jornada completa.');

    setTipoBatidaAtual(tipo);
    const func = funcionarios.find(f => f.id === funcionarioSelecionado);

    if (func?.pin) {
      setPinDigitado('');
      setModalPinVisivel(true);
    } else {
      if (!permission?.granted) await requestPermission();
      setCameraVisivel(true);
    }
  };

  const verificarPin = (pin: string) => {
    const func = funcionarios.find(f => f.id === funcionarioSelecionado);
    if (func?.pin === pin) {
      setModalPinVisivel(false);
      setCameraVisivel(true);
    } else {
      Alert.alert('Erro', 'PIN incorreto');
      setPinDigitado('');
    }
  };

  /* ================= UI ================= */

  const funcionarioAtual = funcionarios.find(f => f.id === funcionarioSelecionado);
  const batidasHoje = diaAtual?.batidas.filter(b => b.funcionarioId === funcionarioSelecionado) || [];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2927B4', '#12114E']} style={styles.header}>
        <Text style={styles.title}>Registro de Ponto</Text>
        <Text style={styles.date}>{hojeString()}</Text>
      </LinearGradient>

      <View style={styles.content}>
        {!funcionarioSelecionado ? (
          <FlatList
            data={funcionarios}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.funcCard} onPress={() => setFuncionarioSelecionado(item.id)}>
                <Text style={styles.funcName}>{item.nome}</Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <>
            <Text style={styles.funcName}>{funcionarioAtual?.nome}</Text>

            <Animated.View style={{ transform: [{ scale: animacaoPonto }] }}>
              <TouchableOpacity onPress={iniciarBatida}>
                <LinearGradient colors={['#2927B4', '#12114E']} style={styles.btn}>
                  <Text style={styles.btnText}>
                    {proximaBatida() ? proximaBatida() : 'Finalizado'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <FlatList
              data={[...batidasHoje].reverse()}
              keyExtractor={b => b.id}
              renderItem={({ item }) => (
                <Text style={styles.batida}>{item.tipo} - {item.timestamp.slice(11, 16)}</Text>
              )}
            />
          </>
        )}
      </View>

      {/* PIN */}
      <Modal visible={modalPinVisivel} transparent>
        <View style={styles.modal}>
          <Text>Digite o PIN</Text>
          <Text>{pinDigitado}</Text>
          <TouchableOpacity onPress={() => verificarPin(pinDigitado)}>
            <Text>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* CAMERA */}
      <Modal visible={cameraVisivel}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="front"
          onCameraReady={async () => {
            setTimeout(async () => {
              await registrarBatida(tipoBatidaAtual!);
              setCameraVisivel(false);
              setTipoBatidaAtual(null);
            }, 800);
          }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 30, alignItems: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  date: { color: '#fff' },
  content: { flex: 1, padding: 20 },
  funcCard: { backgroundColor: '#fff', padding: 15, marginBottom: 10, borderRadius: 10 },
  funcName: { fontSize: 16, fontWeight: 'bold' },
  btn: { padding: 20, borderRadius: 15, marginVertical: 20, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  batida: { padding: 8 },
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0008' },
});
