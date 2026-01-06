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

// Tipos
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
  // Controle do modelo de jornada
  controleAlmoco: boolean; // Mudado de temAlmocoFixo para controleAlmoco
  // Horários (alguns opcionais)
  horaEntrada: string;
  horaAlmocoSugeridaInicio?: string; // Sugestão, não obrigatório
  horaAlmocoSugeridaFim?: string;   // Sugestão, não obrigatório
  horaSaidaFinal: string;
  cargaHorariaPadrao: number;
};

export default function Settings() {
  // Estado para controle de qual seção está expandida
  const [secaoExpandida, setSecaoExpandida] = useState<'empresa' | 'funcionarios' | null>('empresa');

  // ========== ESTADOS DA EMPRESA ==========
  const [empresa, setEmpresa] = useState<Empresa>({
    id: '1',
    nome: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    email: '',
    controleAlmoco: true, // Padrão: com controle de almoço
    horaEntrada: '08:00',
    horaAlmocoSugeridaInicio: '12:00',
    horaAlmocoSugeridaFim: '13:00',
    horaSaidaFinal: '17:00',
    cargaHorariaPadrao: 8,
  });
  const [empresaEditando, setEmpresaEditando] = useState(false);

  // ========== ESTADOS DOS FUNCIONÁRIOS ==========
  const [nome, setNome] = useState('');
  const [cargaDiaria, setCargaDiaria] = useState('');
  const [diasSemana, setDiasSemana] = useState('');
  const [permiteExtras, setPermiteExtras] = useState(false);
  const [erro, setErro] = useState('');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  // ========== CARREGAMENTO INICIAL ==========
  useEffect(() => {
    carregarEmpresa();
    carregarFuncionarios();
  }, []);

  // ========== FUNÇÕES DA EMPRESA ==========
  const carregarEmpresa = async () => {
    try {
      const dados = await AsyncStorage.getItem('empresa');
      if (dados) {
        const empresaSalva = JSON.parse(dados);
        // Para compatibilidade com versões antigas
        if (empresaSalva.controleAlmoco === undefined) {
          // Se for dado antigo com 'temAlmocoFixo', converte
          empresaSalva.controleAlmoco = empresaSalva.temAlmocoFixo !== false;
        }
        setEmpresa(empresaSalva);
        setEmpresaEditando(true);
      }
    } catch (error) {
      console.error('Erro ao carregar empresa:', error);
    }
  };

  const salvarEmpresa = async () => {
    if (!empresa.nome.trim()) {
      Alert.alert('Atenção', 'O nome da empresa é obrigatório.');
      return;
    }

    try {
      await AsyncStorage.setItem('empresa', JSON.stringify(empresa));
      setEmpresaEditando(true);
      Alert.alert('Sucesso', empresaEditando ? 'Dados atualizados!' : 'Empresa cadastrada!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar os dados da empresa.');
    }
  };

  const removerEmpresa = async () => {
    Alert.alert(
      'Remover Cadastro',
      'Tem certeza que deseja remover os dados da empresa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('empresa');
            setEmpresa({
              id: '1',
              nome: '',
              cnpj: '',
              endereco: '',
              telefone: '',
              email: '',
              controleAlmoco: true,
              horaEntrada: '08:00',
              horaAlmocoSugeridaInicio: '12:00',
              horaAlmocoSugeridaFim: '13:00',
              horaSaidaFinal: '17:00',
              cargaHorariaPadrao: 8,
            });
            setEmpresaEditando(false);
            Alert.alert('Sucesso', 'Dados removidos!');
          },
        },
      ]
    );
  };

  // ========== FUNÇÕES DOS FUNCIONÁRIOS ==========
  const carregarFuncionarios = async () => {
    const dados = await AsyncStorage.getItem('funcionarios');
    setFuncionarios(dados ? JSON.parse(dados) : []);
  };

  const cadastrarFuncionario = async () => {
    setErro('');

    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErro('Nome vazio.');
      return;
    }

    if (funcionarios.some(f => f.nome.toLowerCase() === nomeTrim.toLowerCase())) {
      setErro('Nome já existe.');
      return;
    }

    const horas = Number(cargaDiaria);
    if (!horas || horas <= 0) {
      setErro('Carga diária inválida.');
      return;
    }

    const dias = Number(diasSemana);
    if (!dias || dias < 1 || dias > 7) {
      setErro('Dias por semana inválido.');
      return;
    }

    const novo: Funcionario = {
      id: Date.now().toString(),
      nome: nomeTrim,
      cargaDiariaHoras: horas,
      diasSemana: dias,
      permiteExtras,
      admissao: new Date().toISOString().split('T')[0],
    };

    const lista = [...funcionarios, novo];
    await AsyncStorage.setItem('funcionarios', JSON.stringify(lista));

    // Reset do formulário
    setNome('');
    setCargaDiaria('');
    setDiasSemana('');
    setPermiteExtras(false);

    carregarFuncionarios();
  };

  const removerFuncionario = async (id: string) => {
    Alert.alert(
      'Remover Funcionário',
      'Tem certeza que deseja remover este funcionário?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            const lista = funcionarios.filter(f => f.id !== id);
            await AsyncStorage.setItem('funcionarios', JSON.stringify(lista));
            carregarFuncionarios();
          }
        }
      ]
    );
  };

  // ========== FUNÇÕES DE FORMATAÇÃO ==========
  const formatarCNPJ = (text: string) => {
    const nums = text.replace(/\D/g, '');
    if (nums.length <= 2) return nums;
    if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`;
    if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`;
    if (nums.length <= 12)
      return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`;
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12, 14)}`;
  };

  const formatarTelefone = (text: string) => {
    const nums = text.replace(/\D/g, '');
    if (nums.length <= 10) {
      if (nums.length <= 2) return `(${nums}`;
      if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
      return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
    } else {
      if (nums.length <= 2) return `(${nums}`;
      if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
      return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.tituloPrincipal}>Configurações</Text>

      {/* SEÇÃO DE FUNCIONÁRIOS */}
      <TouchableOpacity
        style={styles.secaoCabecalho}
        onPress={() => setSecaoExpandida(secaoExpandida === 'funcionarios' ? null : 'funcionarios')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name={secaoExpandida === 'funcionarios' ? 'chevron-down' : 'chevron-forward'}
            size={24}
            color="#2927B4"
          />
          <Ionicons name="people" size={24} color="#2927B4" style={{ marginLeft: 8 }} />
          <Text style={styles.secaoTitulo}>Funcionários</Text>
        </View>
        <Text style={{ color: '#666', fontSize: 12 }}>({funcionarios.length} cadastrados)</Text>
      </TouchableOpacity>

      {secaoExpandida === 'funcionarios' && (
        <View style={styles.secaoConteudo}>
          <Text style={styles.subtitulo}>Novo Funcionário</Text>
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          <TextInput
            placeholder="Nome completo"
            value={nome}
            onChangeText={setNome}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <TextInput
                placeholder="Carga diária (h)"
                keyboardType="numeric"
                value={cargaDiaria}
                onChangeText={setCargaDiaria}
                style={styles.input}
              />
            </View>
            <View style={styles.halfInput}>
              <TextInput
                placeholder="Dias/semana"
                keyboardType="numeric"
                value={diasSemana}
                onChangeText={setDiasSemana}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.switchContainer}>
            <Text>Permite horas extras</Text>
            <Switch value={permiteExtras} onValueChange={setPermiteExtras} />
          </View>

          <TouchableOpacity style={styles.botaoAdicionar} onPress={cadastrarFuncionario}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.botaoAdicionarTexto}>ADICIONAR FUNCIONÁRIO</Text>
          </TouchableOpacity>

          <Text style={[styles.subtitulo, { marginTop: 20 }]}>
            Lista de Funcionários ({funcionarios.length})
          </Text>

          {funcionarios.length === 0 ? (
            <Text style={styles.semRegistros}>Nenhum funcionário cadastrado</Text>
          ) : (
            <FlatList
              data={funcionarios}
              scrollEnabled={false} // Pois já está dentro de um ScrollView
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.cardFuncionario}>
                  <View style={styles.funcionarioInfo}>
                    <Text style={styles.funcionarioNome}>{item.nome}</Text>
                    <Text style={styles.funcionarioDetalhes}>
                      {item.cargaDiariaHoras}h/dia • {item.diasSemana} dias/semana •{' '}
                      {item.permiteExtras ? 'Com extras' : 'Sem extras'}
                    </Text>
                    <Text style={styles.funcionarioAdmissao}>
                      Admitido em: {item.admissao}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removerFuncionario(item.id)}
                    style={styles.botaoRemoverFuncionario}
                  >
                    <Ionicons name="trash" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      )}
  {/* SEPARADOR */}
      <View style={styles.separador} />

      {/* SEÇÃO DA EMPRESA */}
      <TouchableOpacity
        style={styles.secaoCabecalho}
        onPress={() => setSecaoExpandida(secaoExpandida === 'empresa' ? null : 'empresa')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name={secaoExpandida === 'empresa' ? 'chevron-down' : 'chevron-forward'}
            size={24}
            color="#2927B4"
          />
          <Ionicons name="business" size={24} color="#2927B4" style={{ marginLeft: 8 }} />
          <Text style={styles.secaoTitulo}>Cadastro da Empresa</Text>
        </View>
        <Text style={{ color: '#666', fontSize: 12 }}>
          {empresaEditando ? '(Cadastrada)' : '(Não cadastrada)'}
        </Text>
      </TouchableOpacity>

      {secaoExpandida === 'empresa' && (
        <View style={styles.secaoConteudo}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome da Empresa *</Text>
            <TextInput
              style={styles.input}
              value={empresa.nome}
              onChangeText={(text) => setEmpresa({ ...empresa, nome: text })}
              placeholder="Digite o nome da empresa"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CNPJ</Text>
            <TextInput
              style={styles.input}
              value={empresa.cnpj}
              onChangeText={(text) => setEmpresa({ ...empresa, cnpj: formatarCNPJ(text) })}
              placeholder="00.000.000/0000-00"
              keyboardType="numeric"
              maxLength={18}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={empresa.email}
              onChangeText={(text) => setEmpresa({ ...empresa, email: text })}
              placeholder="email@empresa.com"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={empresa.telefone}
              onChangeText={(text) => setEmpresa({ ...empresa, telefone: formatarTelefone(text) })}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>

          <Text style={styles.subtitulo}>Configuração da Jornada</Text>

          <View style={styles.switchContainer}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', marginBottom: 4 }}>
  Controle de pausa
</Text>
<Text style={{ fontSize: 12, color: '#666' }}>
  {empresa.controleAlmoco
    ? 'Funcionário DEVE bater ponto ao iniciar e encerrar a pausa'
    : 'Apenas entrada e saída - sem controle de pausa'}
</Text>

            </View>
            <Switch
              value={empresa.controleAlmoco}
              onValueChange={(value) => setEmpresa({...empresa, controleAlmoco: value})}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Hora de Entrada</Text>
              <TextInput
                style={styles.input}
                value={empresa.horaEntrada}
                onChangeText={(text) => setEmpresa({...empresa, horaEntrada: text})}
                placeholder="08:00"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Hora de Saída</Text>
              <TextInput
                style={styles.input}
                value={empresa.horaSaidaFinal}
                onChangeText={(text) => setEmpresa({...empresa, horaSaidaFinal: text})}
                placeholder="17:00"
              />
            </View>
          </View>

          {empresa.controleAlmoco && (
            <>
              <Text style={[styles.subtitulo, { fontSize: 14, marginTop: 0 }]}>
  Horário Sugerido de Pausa (não obrigatório)
</Text>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Início Sugerido</Text>
                  <TextInput
                    style={styles.input}
                    value={empresa.horaAlmocoSugeridaInicio || '12:00'}
                    onChangeText={(text) => setEmpresa({...empresa, horaAlmocoSugeridaInicio: text})}
                    placeholder="12:00"
                  />
                </View>
                <View style={styles.halfInput}>

<Text style={styles.label}>Retorno da Pausa</Text>

                  <TextInput
                    style={styles.input}
                    value={empresa.horaAlmocoSugeridaFim || '13:00'}
                    onChangeText={(text) => setEmpresa({...empresa, horaAlmocoSugeridaFim: text})}
                    placeholder="13:00"
                  />
                </View>
              </View>
              <Text style={styles.infoBox}>
  <Ionicons name="information-circle" size={16} color="#3498db" />
  {' '}O funcionário pode fazer a pausa em qualquer horário, mas DEVE bater ponto ao iniciar e ao retornar.
</Text>

            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Carga Horária Diária (horas)</Text>
            <TextInput
              style={styles.input}
              value={empresa.cargaHorariaPadrao.toString()}
              onChangeText={(text) => {
                const num = parseInt(text) || 8;
                setEmpresa({ ...empresa, cargaHorariaPadrao: num });
              }}
              placeholder="8"
              keyboardType="numeric"
            />
            <Text style={styles.helperText}>

            </Text>
          </View>

          <TouchableOpacity style={styles.botaoSalvar} onPress={salvarEmpresa}>
            <Text style={styles.botaoSalvarTexto}>
              {empresaEditando ? 'ATUALIZAR EMPRESA' : 'SALVAR EMPRESA'}
            </Text>
          </TouchableOpacity>

          {empresaEditando && (
            <TouchableOpacity style={styles.botaoRemover} onPress={removerEmpresa}>
              <Ionicons name="trash-outline" size={20} color="#e74c3c" />
              <Text style={styles.botaoRemoverTexto}>REMOVER CADASTRO</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* SEPARADOR */}
      <View style={styles.separador} />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,

  },
  tituloPrincipal: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2927B4',
    marginBottom: 30,
    marginTop: 40,
    textAlign: 'center',
  },
  secaoCabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  secaoTitulo: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 8,
  },
  secaoConteudo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  separador: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  subtitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfInput: {
    width: '48%',
  },
  botaoSalvar: {
    backgroundColor: '#2927B4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  botaoSalvarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  botaoRemover: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e74c3c',
    backgroundColor: '#fff',
    marginTop: 12,
  },
  botaoRemoverTexto: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  erro: {
    color: 'red',
    marginBottom: 12,
    textAlign: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  botaoAdicionar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2ecc71',
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  botaoAdicionarTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  cardFuncionario: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  funcionarioDetalhes: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  funcionarioAdmissao: {
    fontSize: 12,
    color: '#888',
  },
  botaoRemoverFuncionario: {
    backgroundColor: '#e74c3c',
    padding: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  semRegistros: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 20,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  infoBox: {
    backgroundColor: '#e8f4fc',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
    marginBottom: 16,
    fontSize: 13,
    color: '#2c3e50',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});