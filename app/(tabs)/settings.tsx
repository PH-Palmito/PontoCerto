import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// 1. Tipagem Atualizada
type Funcionario = {
  id: string;
  nome: string;
  cpf?: string;        // Opcional
  pis?: string;        // Opcional
  cargo?: string;      // Opcional
  cargaDiariaHoras: number;
  diasSemana: number;
  permiteExtras: boolean;
  admissao: string;
  pin: string;
};

export default function Settings() {
  const [secaoExpandida, setSecaoExpandida] = useState<'empresa' | 'funcionarios' | null>('funcionarios');

  // ========== ESTADOS DOS FUNCIONÁRIOS ==========
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [pis, setPis] = useState('');
  const [cargo, setCargo] = useState('');
  const [pin, setPin] = useState('');
  const [cargaDiaria, setCargaDiaria] = useState('');
  const [diasSemana, setDiasSemana] = useState('');
  const [permiteExtras, setPermiteExtras] = useState(false);
  const [erro, setErro] = useState('');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  useEffect(() => { carregarFuncionarios(); }, []);

  // ========== MÁSCARAS DE FORMATAÇÃO ==========
  const formatarCPF = (text: string) => {
    const nums = text.replace(/\D/g, '');
    return nums
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .substring(0, 14);
  };

  const formatarPIS = (text: string) => {
    const nums = text.replace(/\D/g, '');
    return nums
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{5})(\d)/, '$1.$2')
      .replace(/(\d{2})(\d{1})/, '$1-$2')
      .substring(0, 14);
  };

  // ========== LOGICA DE NEGOCIO ==========
  const carregarFuncionarios = async () => {
    const dados = await AsyncStorage.getItem('funcionarios');
    setFuncionarios(dados ? JSON.parse(dados) : []);
  };

  const prepararEdicao = (f: Funcionario) => {
    setIdEditando(f.id);
    setNome(f.nome);
    setCpf(f.cpf || '');
    setPis(f.pis || '');
    setCargo(f.cargo || '');
    setPin(f.pin);
    setCargaDiaria(f.cargaDiariaHoras.toString());
    setDiasSemana(f.diasSemana.toString());
    setPermiteExtras(f.permiteExtras);
  };

  const cancelarEdicao = () => {
    setIdEditando(null);
    setNome(''); setCpf(''); setPis(''); setCargo('');
    setPin(''); setCargaDiaria(''); setDiasSemana('');
    setPermiteExtras(false);
    setErro('');
  };

  const salvarFuncionario = async () => {
    setErro('');
    if (!nome.trim() || !pin || !cargaDiaria) {
      setErro('Nome, PIN e Carga Horária são obrigatórios.');
      return;
    }

    try {
      let novaLista: Funcionario[];
      const dadosFuncionario = {
        nome: nome.trim(),
        cpf: cpf.trim(),
        pis: pis.trim(),
        cargo: cargo.trim(),
        pin,
        cargaDiariaHoras: Number(cargaDiaria),
        diasSemana: Number(diasSemana) || 5,
        permiteExtras,
      };

      if (idEditando) {
        novaLista = funcionarios.map(f =>
          f.id === idEditando ? { ...f, ...dadosFuncionario } : f
        );
      } else {
        const novo: Funcionario = {
          id: Date.now().toString(),
          admissao: new Date().toLocaleDateString('pt-BR'),
          ...dadosFuncionario,
        };
        novaLista = [...funcionarios, novo];
      }

      await AsyncStorage.setItem('funcionarios', JSON.stringify(novaLista));
      Alert.alert("Sucesso", idEditando ? "Atualizado!" : "Cadastrado!");
      cancelarEdicao();
      carregarFuncionarios();
    } catch (e) { Alert.alert("Erro", "Falha ao salvar."); }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.tituloPrincipal}>Configurações</Text>

      <TouchableOpacity
        style={styles.secaoCabecalho}
        onPress={() => setSecaoExpandida(secaoExpandida === 'funcionarios' ? null : 'funcionarios')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="people" size={24} color="#2927B4" />
          <Text style={styles.secaoTitulo}>Funcionários ({funcionarios.length})</Text>
        </View>
        <Ionicons name={secaoExpandida === 'funcionarios' ? 'chevron-down' : 'chevron-forward'} size={20} color="#666" />
      </TouchableOpacity>

      {secaoExpandida === 'funcionarios' && (
        <View style={styles.secaoConteudo}>
          <Text style={styles.subtitulo}>{idEditando ? 'Editar Cadastro' : 'Novo Funcionário'}</Text>
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          <TextInput placeholder="Nome completo *" value={nome} onChangeText={setNome} style={styles.input} />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <TextInput
                placeholder="CPF (Opcional)"
                value={cpf}
                onChangeText={(t) => setCpf(formatarCPF(t))}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={styles.halfInput}>
              <TextInput
                placeholder="PIS (Opcional)"
                value={pis}
                onChangeText={(t) => setPis(formatarPIS(t))}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          <TextInput
            placeholder="Cargo / Função (Opcional)"
            value={cargo}
            onChangeText={setCargo}
            style={[styles.input, { marginTop: 10 }]}
          />

          <TextInput
            placeholder="PIN de acesso *"
            value={pin}
            onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
            style={[styles.input, { marginTop: 10 }]}
            keyboardType="numeric"
            maxLength={6}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <TextInput placeholder="Carga (h) *" keyboardType="numeric" value={cargaDiaria} onChangeText={setCargaDiaria} style={styles.input} />
            </View>
            <View style={styles.halfInput}>
              <TextInput placeholder="Dias/Semana" keyboardType="numeric" value={diasSemana} onChangeText={setDiasSemana} style={styles.input} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.botaoAdicionar, idEditando ? { backgroundColor: '#f39c12' } : null]}
            onPress={salvarFuncionario}
          >
            <Text style={styles.botaoAdicionarTexto}>{idEditando ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR'}</Text>
          </TouchableOpacity>

          {idEditando && (
            <TouchableOpacity onPress={cancelarEdicao} style={{ marginTop: 15, alignItems: 'center' }}>
              <Text style={{ color: '#e74c3c' }}>CANCELAR</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.subtitulo, { marginTop: 25 }]}>Lista</Text>
          {funcionarios.map((item) => (
            <View key={item.id} style={styles.cardFuncionario}>
              <View style={{ flex: 1 }}>
                <Text style={styles.funcionarioNome}>{item.nome}</Text>
                <Text style={styles.funcionarioDetalhes}>
                  {item.cargo || 'Sem cargo'} • {item.cpf || 'Sem CPF'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity onPress={() => prepararEdicao(item)} style={[styles.acaoBtn, { backgroundColor: '#2927B4' }]}>
                  <Ionicons name="pencil" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 16 },
  tituloPrincipal: { fontSize: 22, fontWeight: '700', color: '#2927B4', marginVertical: 20, textAlign: 'center' },
  secaoCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 10, marginBottom: 8, elevation: 2 },
  secaoTitulo: { fontSize: 16, fontWeight: '600', marginLeft: 10 },
  secaoConteudo: { backgroundColor: '#fff', padding: 16, borderRadius: 10, marginBottom: 20 },
  input: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, marginTop: 8 },
  subtitulo: { fontSize: 15, fontWeight: '700', color: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%' },
  botaoAdicionar: { backgroundColor: '#2ecc71', padding: 14, borderRadius: 8, marginTop: 15, alignItems: 'center' },
  botaoAdicionarTexto: { color: '#fff', fontWeight: 'bold' },
  cardFuncionario: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  funcionarioNome: { fontWeight: '600', fontSize: 14 },
  funcionarioDetalhes: { fontSize: 12, color: '#777' },
  acaoBtn: { padding: 8, borderRadius: 5, marginLeft: 5 },
  erro: { color: 'red', fontSize: 12, textAlign: 'center' }
});