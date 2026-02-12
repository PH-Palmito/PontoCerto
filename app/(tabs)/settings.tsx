import { useState, useEffect } from "react";
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
  Modal,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from 'expo-router'; // ADICIONADO: useLocalSearchParams

// IMPORTS DO FIREBASE
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../utils/firebaseConfig";

// ================= TYPES =================
type Funcionario = {
  id: string;
  nome: string;
  cargo?: string;
  cpf?: string;
  pis?: string;
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

type Feriado = {
  id: string;
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: "nacional" | "customizado";
};

// ================= UTILS DE FERIADOS =================
const HolidayUtils = {
  getPascoa(ano: number): Date {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  },

  addDays(data: Date, dias: number): Date {
    const result = new Date(data);
    result.setDate(result.getDate() + dias);
    return result;
  },

  formatIso(data: Date): string {
    return data.toISOString().split("T")[0];
  },

  getFeriadosNacionais(ano: number): Feriado[] {
    const fixos: Feriado[] = [
      { id: "nac_confrat", data: `${ano}-01-01`, nome: "Confraternização Universal", tipo: "nacional" },
      { id: "nac_tira", data: `${ano}-04-21`, nome: "Tiradentes", tipo: "nacional" },
      { id: "nac_trab", data: `${ano}-05-01`, nome: "Dia do Trabalho", tipo: "nacional" },
      { id: "nac_indep", data: `${ano}-09-07`, nome: "Independência do Brasil", tipo: "nacional" },
      { id: "nac_nsa", data: `${ano}-10-12`, nome: "Nossa Sra. Aparecida", tipo: "nacional" },
      { id: "nac_finados", data: `${ano}-11-02`, nome: "Finados", tipo: "nacional" },
      { id: "nac_proc", data: `${ano}-11-15`, nome: "Proclamação da República", tipo: "nacional" },
      { id: "nac_cons", data: `${ano}-11-20`, nome: "Dia da Consciência Negra", tipo: "nacional" },
      { id: "nac_natal", data: `${ano}-12-25`, nome: "Natal", tipo: "nacional" },
    ];
    return fixos.sort((a, b) => a.data.localeCompare(b.data));
  },

  getFacultativosComuns(ano: number): Feriado[] {
    const pascoa = this.getPascoa(ano);
    const carnaval = this.addDays(pascoa, -47);
    const sextaSanta = this.addDays(pascoa, -2);
    const corpusChristi = this.addDays(pascoa, 60);

    const facultativos: Feriado[] = [
      { id: "fac_carnaval", data: this.formatIso(carnaval), nome: "Carnaval (Facultativo)", tipo: "customizado" },
      { id: "fac_sexta", data: this.formatIso(sextaSanta), nome: "Sexta-feira Santa (Comum)", tipo: "customizado" },
      { id: "fac_corpus", data: this.formatIso(corpusChristi), nome: "Corpus Christi (Facultativo)", tipo: "customizado" },
    ];
    return facultativos;
  }
};

export default function Settings() {
  const params = useLocalSearchParams(); // RECUPERA O PARÂMETRO 'novoCadastro'

  const [secaoExpandida, setSecaoExpandida] = useState<"empresa" | "funcionarios" | "feriados" | null>("empresa");
  const [acessoLiberado, setAcessoLiberado] = useState(false);
  const [senhaInput, setSenhaInput] = useState("");
  const [modalVisivel, setModalVisivel] = useState(false);
  const [funcionarioEditando, setFuncionarioEditando] = useState<Funcionario | null>(null);
  const [novoPin, setNovoPin] = useState("");

  // Estado de Sincronização
  const [sincronizando, setSincronizando] = useState(false);

  // Estados de Dados
  const [empresa, setEmpresa] = useState<Empresa>({
    id: "1", nome: "", cnpj: "", endereco: "", telefone: "", email: "",
    controleAlmoco: true, horaEntrada: "08:00", horaAlmocoSugeridaInicio: "12:00",
    horaAlmocoSugeridaFim: "13:00", horaSaidaFinal: "17:00", cargaHorariaPadrao: 8, senhaAdmin: "1234",
  });
  const [empresaEditando, setEmpresaEditando] = useState(false);

  // Funcionários
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [cpf, setCpf] = useState("");
  const [pis, setPis] = useState("");
  const [pin, setPin] = useState("");
  const [cargaDiaria, setCargaDiaria] = useState("");
  const [diasSemana, setDiasSemana] = useState("");
  const [permiteExtras, setPermiteExtras] = useState(false);
  const [erro, setErro] = useState("");
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  // Feriados
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [novoFeriadoNome, setNovoFeriadoNome] = useState("");
  const [novoFeriadoData, setNovoFeriadoData] = useState("");

  // EFEITO PARA LIBERAR ACESSO SE FOR NOVO CADASTRO
  useEffect(() => {
    if (params.novoCadastro === 'true') {
      setAcessoLiberado(true);
    }
  }, [params.novoCadastro]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const dadosEmpresa = await AsyncStorage.getItem("empresa");
      if (dadosEmpresa) {
        setEmpresa(JSON.parse(dadosEmpresa));
        setEmpresaEditando(true);
      }
      const dadosFunc = await AsyncStorage.getItem("funcionarios");
      setFuncionarios(dadosFunc ? JSON.parse(dadosFunc) : []);
      carregarFeriados();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const carregarFeriados = async () => {
    const anoAtual = new Date().getFullYear();
    const nacionais = HolidayUtils.getFeriadosNacionais(anoAtual);
    const dadosCustom = await AsyncStorage.getItem("feriadosPersonalizados");
    const customizados: Feriado[] = dadosCustom ? JSON.parse(dadosCustom) : [];
    const todos = [...nacionais, ...customizados].sort((a, b) => a.data.localeCompare(b.data));
    setFeriados(todos);
  }

  // ========== SINCRONIZAÇÃO AUTOMÁTICA (FIREBASE) ==========
  const sincronizarAutomaticamente = async () => {
    if (!empresa.nome) return;

    setSincronizando(true);
    try {
      const empresaRef = doc(db, "empresas", "config_geral");

      const dadosBackup = {
        empresa: empresa,
        funcionarios: funcionarios,
        feriados: feriados.filter(f => f.tipo === 'customizado'),
        ultimaAtualizacao: new Date().toISOString()
      };

      await setDoc(empresaRef, dadosBackup);
      console.log("Dados sincronizados com o Firebase!");
    } catch (error) {
      console.error("Erro ao sincronizar com Firebase:", error);
    } finally {
      setSincronizando(false);
    }
  };

  // ========== LÓGICA DE SEGURANÇA ==========
  const tentarDesbloquear = () => {
    const senhaCorreta = empresa.senhaAdmin || "1234";
    if (senhaInput === senhaCorreta) {
      setAcessoLiberado(true);
      setSenhaInput("");
    } else {
      Alert.alert("Acesso Negado", "Senha incorreta.");
    }
  };

  // ========== FUNÇÕES DA EMPRESA ==========
  const salvarEmpresa = async () => {
    if (!empresa.nome.trim()) {
      Alert.alert("Atenção", "Nome da empresa obrigatório.");
      return;
    }
    try {
      await AsyncStorage.setItem("empresa", JSON.stringify(empresa));
      setEmpresaEditando(true);
      await sincronizarAutomaticamente(); // CHAMA O FIREBASE AQUI
      Alert.alert("Sucesso", "Dados salvos e sincronizados!");
    } catch (error) {
      Alert.alert("Erro", "Falha ao salvar.");
    }
  };

  const removerEmpresa = async () => {
    Alert.alert("Remover", "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => {
          await AsyncStorage.removeItem("empresa");
          setEmpresa({ id: "1", nome: "", cnpj: "", endereco: "", telefone: "", email: "", controleAlmoco: true, horaEntrada: "08:00", horaSaidaFinal: "17:00", cargaHorariaPadrao: 8, senhaAdmin: "1234" });
          setEmpresaEditando(false);
          await sincronizarAutomaticamente(); // ATUALIZA O FIREBASE (LIMPA)
      }}
    ]);
  };

  // ========== FUNÇÕES DOS FUNCIONÁRIOS ==========
  const cadastrarFuncionario = async () => {
    setErro("");
    if (!nome.trim()) { setErro("Nome vazio."); return; }

    const novo: Funcionario = {
      id: Date.now().toString(),
      nome: nome.trim(),
      cargo: cargo.trim(),
      cpf: cpf.replace(/\D/g, ""),
      pis: pis.replace(/\D/g, ""),
      cargaDiariaHoras: Number(cargaDiaria) || 8,
      diasSemana: Number(diasSemana) || 5,
      permiteExtras,
      admissao: new Date().toISOString().split("T")[0],
      pin: pin || "",
    };

    const lista = [...funcionarios, novo];
    await AsyncStorage.setItem("funcionarios", JSON.stringify(lista));
    setFuncionarios(lista);

    // Reset inputs
    setNome(""); setCargo(""); setCpf(""); setPis(""); setPin("");
    setCargaDiaria(""); setDiasSemana(""); setPermiteExtras(false);

    await sincronizarAutomaticamente(); // CHAMA O FIREBASE AQUI
    Alert.alert("Sucesso", "Funcionário salvo.");
  };

  const removerFuncionario = async (id: string) => {
    const lista = funcionarios.filter((f) => f.id !== id);
    await AsyncStorage.setItem("funcionarios", JSON.stringify(lista));
    setFuncionarios(lista);
    await sincronizarAutomaticamente(); // CHAMA O FIREBASE AQUI
  };

  const abrirModalEditarSenha = (f: Funcionario) => {
    setFuncionarioEditando(f);
    setNovoPin(f.pin || "");
    setModalVisivel(true);
  };

  const salvarNovaSenha = async () => {
    if (!funcionarioEditando) return;
    const lista = funcionarios.map(f => f.id === funcionarioEditando.id ? { ...f, pin: novoPin } : f);
    await AsyncStorage.setItem("funcionarios", JSON.stringify(lista));
    setFuncionarios(lista);
    setModalVisivel(false);
    await sincronizarAutomaticamente(); // CHAMA O FIREBASE AQUI
    Alert.alert("Sucesso", "PIN atualizado");
  };

  const fecharModal = () => { setModalVisivel(false); setFuncionarioEditando(null); };

  // ========== FERIADOS ==========
  const adicionarFeriadoCustom = async () => {
    if (!novoFeriadoNome || !novoFeriadoData) return;
    const [dia, mes] = novoFeriadoData.split("/");
    const ano = new Date().getFullYear();
    const novo: Feriado = { id: Date.now().toString(), data: `${ano}-${mes}-${dia}`, nome: novoFeriadoNome, tipo: "customizado" };

    const custom = feriados.filter(f => f.tipo === "customizado");
    const novaLista = [...custom, novo];
    await AsyncStorage.setItem("feriadosPersonalizados", JSON.stringify(novaLista));

    carregarFeriados();
    setNovoFeriadoNome(""); setNovoFeriadoData("");
    await sincronizarAutomaticamente(); // CHAMA O FIREBASE AQUI
  };

  const importarFacultativos = async () => {
    const facultativos = HolidayUtils.getFacultativosComuns(new Date().getFullYear());
    const atuais = feriados.filter(f => f.tipo === "customizado");
    const novos = facultativos.filter(fac => !atuais.some(c => c.data === fac.data));

    if (novos.length > 0) {
      const final = [...atuais, ...novos];
      await AsyncStorage.setItem("feriadosPersonalizados", JSON.stringify(final));
      carregarFeriados();
      await sincronizarAutomaticamente(); // CHAMA O FIREBASE AQUI
      Alert.alert("Sucesso", "Feriados importados!");
    }
  };

  const removerFeriado = async (id: string) => {
    const custom = feriados.filter(f => f.tipo === "customizado" && f.id !== id);
    await AsyncStorage.setItem("feriadosPersonalizados", JSON.stringify(custom));
    carregarFeriados();
    await sincronizarAutomaticamente(); // CHAMA O FIREBASE AQUI
  };

  // UTILS UI
  const formatarCNPJ = (t: string) => t.replace(/\D/g, "").replace(/^(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, "$1.$2.$3/$4-$5");
  const formatarTelefone = (t: string) => t.replace(/\D/g, "").replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");

  // RENDER - TELA DE BLOQUEIO
  if (!acessoLiberado) {
    return (
      <View style={styles.containerLock}>
        <View style={styles.lockContent}>
          <Ionicons name="lock-closed-outline" size={80} color="#2927B4" />
          <Text style={styles.lockTitle}>Área Restrita</Text>
          <TextInput style={styles.inputLock} placeholder="Senha Admin" secureTextEntry keyboardType="numeric" value={senhaInput} onChangeText={setSenhaInput} maxLength={6} />
          <TouchableOpacity style={styles.btnUnlock} onPress={tentarDesbloquear}><Text style={styles.btnUnlockText}>ACESSAR</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  // RENDER - CONTEÚDO
  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerTitleContainer}>
        <Text style={styles.tituloPrincipal}>Configurações</Text>
        {sincronizando && (
           <View style={styles.syncIndicator}>
             <ActivityIndicator size="small" color="#2927B4" />
             <Text style={styles.syncText}>Sincronizando com nuvem...</Text>
           </View>
        )}
      </View>

      {/* SEÇÃO 1: FUNCIONÁRIOS */}
      <TouchableOpacity style={styles.secaoCabecalho} onPress={() => setSecaoExpandida(secaoExpandida === "funcionarios" ? null : "funcionarios")}>
        <View style={styles.headerRow}>
          <Ionicons name={secaoExpandida === "funcionarios" ? "chevron-down" : "chevron-forward"} size={24} color="#2927B4" />
          <Text style={styles.secaoTitulo}>Funcionários ({funcionarios.length})</Text>
        </View>
      </TouchableOpacity>

      {secaoExpandida === "funcionarios" && (
        <View style={styles.secaoConteudo}>
          <Text style={styles.subtitulo}>Novo Funcionário</Text>
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          <TextInput placeholder="Nome completo *" value={nome} onChangeText={setNome} style={[styles.input, styles.campoPrincipal]} />
          <View style={styles.row}>
            <TextInput placeholder="CPF" value={cpf} onChangeText={setCpf} style={[styles.input, styles.halfInput]} keyboardType="numeric" maxLength={14} />
            <TextInput placeholder="PIS" value={pis} onChangeText={setPis} style={[styles.input, styles.halfInput]} keyboardType="numeric" maxLength={14} />
          </View>
          <TextInput placeholder="PIN (4 dígitos)" value={pin} onChangeText={setPin} style={styles.input} keyboardType="numeric" maxLength={6} />
          <View style={styles.row}>
            <TextInput placeholder="Horas/dia *" value={cargaDiaria} onChangeText={setCargaDiaria} style={[styles.input, styles.halfInput]} keyboardType="numeric" />
            <TextInput placeholder="Dias/semana *" value={diasSemana} onChangeText={setDiasSemana} style={[styles.input, styles.halfInput]} keyboardType="numeric" />
          </View>
          <View style={styles.switchContainer}>
            <Text>Permite horas extras?</Text>
            <Switch value={permiteExtras} onValueChange={setPermiteExtras} />
          </View>
          <TouchableOpacity style={styles.botaoAdicionar} onPress={cadastrarFuncionario}>
            <Text style={styles.botaoAdicionarTexto}>ADICIONAR</Text>
          </TouchableOpacity>

          <Text style={[styles.subtitulo, {marginTop: 20}]}>Lista</Text>
          {funcionarios.map(f => (
            <View key={f.id} style={styles.cardFuncionario}>
              <View style={styles.funcionarioInfo}>
                <Text style={styles.funcionarioNome}>{f.nome}</Text>
                <Text style={styles.funcionarioDetalhes}>{f.cargo || "Sem cargo"} • {f.cargaDiariaHoras}h</Text>
              </View>
              <View style={styles.botoesFuncionario}>
                <TouchableOpacity onPress={() => {setFuncionarioEditando(f); setNovoPin(f.pin||""); setModalVisivel(true)}} style={styles.botaoEditarSenha}><Ionicons name="key" size={18} color="#fff" /></TouchableOpacity>
                <TouchableOpacity onPress={() => removerFuncionario(f.id)} style={styles.botaoRemoverFuncionario}><Ionicons name="trash" size={18} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* SEÇÃO 2: EMPRESA */}
      <View style={styles.separador} />
      <TouchableOpacity style={styles.secaoCabecalho} onPress={() => setSecaoExpandida(secaoExpandida === "empresa" ? null : "empresa")}>
        <View style={styles.headerRow}>
          <Ionicons name={secaoExpandida === "empresa" ? "chevron-down" : "chevron-forward"} size={24} color="#2927B4" />
          <Text style={styles.secaoTitulo}>Dados da Empresa</Text>
        </View>
      </TouchableOpacity>

      {secaoExpandida === "empresa" && (
        <View style={styles.secaoConteudo}>
          <TextInput style={styles.input} value={empresa.nome} onChangeText={t => setEmpresa({...empresa, nome: t})} placeholder="Nome Fantasia" />
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.halfInput]} value={empresa.cnpj} onChangeText={t => setEmpresa({...empresa, cnpj: formatarCNPJ(t)})} placeholder="CNPJ" keyboardType="numeric" />
            <TextInput style={[styles.input, styles.halfInput]} value={empresa.telefone} onChangeText={t => setEmpresa({...empresa, telefone: formatarTelefone(t)})} placeholder="Telefone" keyboardType="phone-pad" />
          </View>
          <Text style={styles.label}>Jornada</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.halfInput]} value={empresa.horaEntrada} onChangeText={t => setEmpresa({...empresa, horaEntrada: t})} placeholder="Entrada (08:00)" />
            <TextInput style={[styles.input, styles.halfInput]} value={empresa.horaSaidaFinal} onChangeText={t => setEmpresa({...empresa, horaSaidaFinal: t})} placeholder="Saída (17:00)" />
          </View>
          <View style={styles.switchContainer}>
            <Text>Controle de Almoço?</Text>
            <Switch value={empresa.controleAlmoco} onValueChange={v => setEmpresa({...empresa, controleAlmoco: v})} />
          </View>
          <Text style={styles.label}>Segurança</Text>
          <TextInput style={styles.input} value={empresa.senhaAdmin} onChangeText={t => setEmpresa({...empresa, senhaAdmin: t})} placeholder="Senha Admin" secureTextEntry keyboardType="numeric" />

          <TouchableOpacity style={styles.botaoSalvar} onPress={salvarEmpresa}>
            <Text style={styles.botaoSalvarTexto}>SALVAR TUDO</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SEÇÃO 3: FERIADOS */}
      <View style={styles.separador} />
      <TouchableOpacity style={styles.secaoCabecalho} onPress={() => setSecaoExpandida(secaoExpandida === "feriados" ? null : "feriados")}>
        <View style={styles.headerRow}>
          <Ionicons name={secaoExpandida === "feriados" ? "chevron-down" : "chevron-forward"} size={24} color="#2927B4" />
          <Text style={styles.secaoTitulo}>Feriados</Text>
        </View>
      </TouchableOpacity>

      {secaoExpandida === "feriados" && (
        <View style={styles.secaoConteudo}>
          <TouchableOpacity style={styles.btnImportarFacultativo} onPress={importarFacultativos}>
            <Text style={styles.btnImportarFacultativoText}>Importar Carnaval/Corpus Christi</Text>
          </TouchableOpacity>
          <View style={styles.addFeriadoContainer}>
            <TextInput style={[styles.input, {flex: 1, marginRight: 8}]} placeholder="DD/MM" value={novoFeriadoData} onChangeText={setNovoFeriadoData} maxLength={5} keyboardType="numeric" />
            <TextInput style={[styles.input, {flex: 2}]} placeholder="Nome" value={novoFeriadoNome} onChangeText={setNovoFeriadoNome} />
          </View>
          <TouchableOpacity style={styles.btnAddFeriado} onPress={adicionarFeriadoCustom}>
            <Text style={styles.btnAddFeriadoText}>+ Adicionar</Text>
          </TouchableOpacity>
          <FlatList
            data={feriados}
            scrollEnabled={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.feriadoItem}>
                <Text style={styles.feriadoData}>{item.data.split('-').reverse().slice(0,2).join('/')}</Text>
                <Text style={styles.feriadoNome}>{item.nome}</Text>
                {item.tipo === "customizado" && <TouchableOpacity onPress={() => removerFeriado(item.id)}><Ionicons name="trash-outline" size={20} color="#e74c3c" /></TouchableOpacity>}
              </View>
            )}
          />
        </View>
      )}

      {/* Modal Senha */}
      <Modal visible={modalVisivel} transparent animationType="fade" onRequestClose={() => setModalVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Novo PIN</Text>
            <TextInput style={styles.modalInput} placeholder="Novo PIN" value={novoPin} onChangeText={setNovoPin} keyboardType="numeric" maxLength={6} />
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoCancelar]} onPress={() => setModalVisivel(false)}><Text>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoSalvar]} onPress={salvarNovaSenha}><Text style={{color: '#fff'}}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  containerLock: { flex: 1, backgroundColor: "#f0f2f5", justifyContent: "center", alignItems: "center", padding: 20 },
  lockContent: { backgroundColor: "#fff", width: "100%", maxWidth: 400, padding: 30, borderRadius: 20, alignItems: "center", elevation: 5 },
  lockTitle: { fontSize: 24, fontWeight: "bold", color: "#2927B4", marginTop: 20 },
  inputLock: { backgroundColor: "#f8f9fa", width: "100%", padding: 15, borderRadius: 10, fontSize: 20, textAlign: "center", borderWidth: 1, borderColor: "#ddd", marginBottom: 20, marginTop: 20 },
  btnUnlock: { backgroundColor: "#2927B4", width: "100%", padding: 15, borderRadius: 10, alignItems: "center" },
  btnUnlockText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 16 },
  headerTitleContainer: { marginTop: 40, marginBottom: 20, alignItems: 'center' },
  tituloPrincipal: { fontSize: 24, fontWeight: "700", color: "#2927B4" },
  syncIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  syncText: { fontSize: 12, color: "#2927B4", marginLeft: 5 },
  secaoCabecalho: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 10, borderWidth: 1, borderColor: "#e0e0e0", marginBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  secaoTitulo: { fontSize: 18, fontWeight: "600", color: "#2c3e50", marginLeft: 8 },
  secaoConteudo: { backgroundColor: "#fff", padding: 16, borderRadius: 10, borderWidth: 1, borderColor: "#e0e0e0", marginBottom: 16 },
  separador: { height: 1, marginVertical: 8 },
  label: { fontSize: 14, fontWeight: "600", color: "#34495e", marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#f8f9fa", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, fontSize: 16, color: "#2c3e50", marginBottom: 10 },
  campoPrincipal: { borderColor: "#2927B4" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  halfInput: { flex: 1 },
  subtitulo: { fontSize: 16, fontWeight: "700", color: "#2c3e50", marginBottom: 12 },
  erro: { color: "red", marginBottom: 10 },
  botaoAdicionar: { backgroundColor: "#2ecc71", padding: 12, borderRadius: 8, marginTop: 10, alignItems: "center" },
  botaoAdicionarTexto: { color: "#fff", fontWeight: "bold" },
  botaoSalvar: { backgroundColor: "#2927B4", padding: 16, borderRadius: 8, alignItems: "center", marginTop: 20 },
  botaoSalvarTexto: { color: "#fff", fontWeight: "bold" },
  botaoRemover: { marginTop: 10, padding: 10, alignItems: "center" },
  botaoRemoverTexto: { color: "#e74c3c", fontWeight: "bold" },
  switchContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8f9fa", padding: 12, borderRadius: 8, marginBottom: 10 },
  cardFuncionario: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f8f9fa", padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#2927B4" },
  funcionarioInfo: { flex: 1 },
  funcionarioNome: { fontWeight: "bold", fontSize: 16, color: "#2c3e50" },
  funcionarioDetalhes: { color: "#666", fontSize: 12 },
  botoesFuncionario: { flexDirection: "row", gap: 10 },
  botaoEditarSenha: { backgroundColor: "#3498db", padding: 6, borderRadius: 4 },
  botaoRemoverFuncionario: { backgroundColor: "#e74c3c", padding: 6, borderRadius: 4 },
  addFeriadoContainer: { flexDirection: "row", marginBottom: 10 },
  btnAddFeriado: { backgroundColor: "#e0e0e0", padding: 10, borderRadius: 8, alignItems: "center", marginBottom: 15 },
  btnAddFeriadoText: { color: "#333", fontWeight: "600" },
  btnImportarFacultativo: { backgroundColor: "#fff3cd", padding: 10, borderRadius: 8, alignItems: "center", marginBottom: 15, borderWidth: 1, borderColor: '#ffecb3' },
  btnImportarFacultativoText: { color: "#856404", fontWeight: "600", fontSize: 12 },
  feriadoItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  feriadoData: { fontWeight: "bold", color: "#2927B4", width: 60 },
  feriadoNome: { color: "#555", flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 12, width: '100%', maxWidth: 350 },
  modalTitulo: { fontSize: 18, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  modalInput: { backgroundColor: "#f8f9fa", borderWidth: 1, borderColor: "#ddd", padding: 15, borderRadius: 8, fontSize: 20, textAlign: "center", marginBottom: 20 },
  modalBotoes: { flexDirection: "row", gap: 10 },
  modalBotao: { flex: 1, padding: 15, borderRadius: 8, alignItems: "center" },
  modalBotaoCancelar: { backgroundColor: "#eee" },
  modalBotaoSalvar: { backgroundColor: "#2927B4" },
});