
// ==============================
// IMPORTAÇÕES E TIPAGENS
// ==============================


import React, { useEffect, useRef, useState } from 'react';
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
  Animated,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

type BatidaTipo = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida_final';

type Batida = {
  id: string;
  tipo: BatidaTipo;
  timestamp: string; // ISO
  funcionarioId: string;
};

type Dia = {
  data: string; // YYYY-MM-DD
  batidas: Batida[];
  folgas?: string[]; // array de funcionarioId com folga autorizada (se vazio ou undefined, sem folgas)
  fechado?: boolean; // estabelecimento fechado naquele dia (autoridade/admin)
};

type Funcionario = {
  id: string;
  nome: string;
  cargaDiariaHoras?: number;
   admissao: string // opcional (default 8)
};
// ==============================
// COMPONENTE PRINCIPAL
// ==============================
export default function HistoricoScreen() {

  // ==============================
  // ESTADOS
  // ==============================

  const [dias, setDias] = useState<Dia[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState<string>('');
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<Dia | null>(null);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>('todos');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cargaDiariaPadrao = 8;

  // ==============================
  // CARREGAMENTO INICIAL
  // ==============================


  useEffect(() => {
    (async () => {
      const dadosDias = await AsyncStorage.getItem('dias');
      const dadosFuncionarios = await AsyncStorage.getItem('funcionarios');

      if (dadosFuncionarios) {
        try {
          setFuncionarios(JSON.parse(dadosFuncionarios));
        } catch {
          setFuncionarios([]);
        }
      } else {
        setFuncionarios([]);
      }

      if (dadosDias) {
        try {
          const parsed: Dia[] = JSON.parse(dadosDias);
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
          meses.sort((a, b) => (a < b ? 1 : -1));
          setMesesDisponiveis(meses);

          const hoje = new Date();
          const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
          setMesSelecionado(meses.includes(mesAtual) ? mesAtual : meses[0] ?? mesAtual);
        } catch {
          setDias([]);
        }
      } else {
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        setMesSelecionado(mesAtual);
      }
    })();
  }, []);

    // ==============================
  // ANIMAÇÃO EM MUDANÇA DE ESTADO
  // ==============================

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [mesSelecionado, funcionarioSelecionado, dias, funcionarios]);

    // ==============================
  // FUNÇÕES DE FORMATAÇÃO
  // ==============================
  const formatarMesAno = (mesAno: string) => {
    if (!mesAno) return '';
    const [ano, mes] = mesAno.split('-');
    const nomesMeses = [
      'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
      'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
    ];
    const m = parseInt(mes, 10);
    return `${nomesMeses[m - 1] ?? mes} ${ano}`;
  };

  const calcularTotalHorasDia = (batidas: Batida[]) => {
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

    if (t2 < t1 || t3 < t2 || t4 < t3) return 0;

    return (t4 - t1 - (t3 - t2)) / (1000 * 60 * 60);
  };

  const formatarHoras = (horas: number) => {
    const negativo = horas < 0;
    const horasAbs = Math.abs(horas);
    const h = Math.floor(horasAbs);
    const m = Math.round((horasAbs - h) * 60);
    return `${negativo ? '-' : ''}${h}h ${m}min`;
  };

  // ==============================
  // CONSTANTES E UTILITÁRIOS
  // ==============================

  const icones: Record<BatidaTipo, { nome: keyof typeof Ionicons.glyphMap; cor: string }> = {
    entrada: { nome: 'log-in', cor: '#2ecc71' },
    saida_almoco: { nome: 'fast-food', cor: '#f1c40f' },
    retorno_almoco: { nome: 'return-up-forward', cor: '#3498db' },
    saida_final: { nome: 'log-out', cor: '#e74c3c' },
  };

  // gera array das datas do mês (YYYY-MM-DD)
  const gerarDiasDoMes = (mesAno: string) => {
    if (!mesAno) return [];
    const [anoS, mesS] = mesAno.split('-');
    const ano = Number(anoS);
    const mes = Number(mesS); // 1..12
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const lista: string[] = [];
    for (let d = 1; d <= ultimoDia; d++) {
      lista.push(`${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return lista;
  };

  const ehDiaUtil = (dataISO: string) => {
    const d = new Date(dataISO).getDay();
    return d !== 0 && d !== 6;
  };

  const isFuture = (dataISO: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const d = new Date(dataISO);
    d.setHours(0,0,0,0);
    return d > today;
  };
// ==============================
// PRÉ-PROCESSAMENTO POR MÊS
// ==============================

const todosDiasDoMes = gerarDiasDoMes(mesSelecionado);

type DiaComInfo = {
  data: string;
  batidas: Batida[];
  temBatida: boolean;
  registroOriginal?: Dia | undefined;
};

const diasComInfo: DiaComInfo[] = todosDiasDoMes.map(date => {
  const registro = dias.find(d => d.data === date);
  const batidasDoRegistro = registro ? registro.batidas : [];
  const batidasFiltradas = batidasDoRegistro.filter(b =>
    funcionarioSelecionado === 'todos' ? true : b.funcionarioId === funcionarioSelecionado
  );
  return {
    data: date,
    batidas: batidasFiltradas,
    temBatida: batidasFiltradas.length > 0,
    registroOriginal: registro,
  };
});

const obterCargaDiariaFuncionario = (id: string) => {
  const f = funcionarios.find(x => x.id === id);
  return f?.cargaDiariaHoras ?? cargaDiariaPadrao;
};

const admissaoDe = (id: string) => {
  const f = funcionarios.find(x => x.id === id);
  return f?.admissao ? new Date(f.admissao) : null;
};

const antesDaAdmissao = (dataDia: string, id: string) => {
  const adm = admissaoDe(id);
  if (!adm) return false;
  return new Date(dataDia) < adm;
};
// ==============================
// CÁLCULO DO RESUMO MENSAL
// ==============================

let previstasHoras = 0;
let trabalhadasHoras = 0;
let faltasCount = 0;
let folgasCount = 0;

if (funcionarioSelecionado === 'todos') {
  const somaCargaDiariaTodos = funcionarios.reduce(
    (acc, f) => acc + (f.cargaDiariaHoras ?? cargaDiariaPadrao),
    0
  );
  for (const d of diasComInfo) {
    if (isFuture(d.data)) {
      if (d.temBatida) trabalhadasHoras += calcularTotalHorasDia(d.batidas);
      continue;
    }
    if (ehDiaUtil(d.data)) {
      previstasHoras += somaCargaDiariaTodos;
      if (d.temBatida) {
        trabalhadasHoras += calcularTotalHorasDia(d.batidas);
      } else {
        const reg = d.registroOriginal;
        if (reg?.fechado) {
          folgasCount += funcionarios.length;
        } else if (reg?.folgas && reg.folgas.length > 0) {
          for (const f of funcionarios) {
            if (reg.folgas.includes(f.id)) {
              folgasCount += 1;
            } else if (!antesDaAdmissao(d.data, f.id)) {
              faltasCount += 1;
            }
          }
        } else {
          for (const f of funcionarios) {
            if (!antesDaAdmissao(d.data, f.id)) {
              faltasCount += 1;
            }
          }
        }
      }
    } else {
      folgasCount += funcionarios.length;
      if (d.temBatida) trabalhadasHoras += calcularTotalHorasDia(d.batidas);
    }
  }
} else {
  const carga = obterCargaDiariaFuncionario(funcionarioSelecionado);
  for (const d of diasComInfo) {
    if (isFuture(d.data)) {
      if (d.temBatida) trabalhadasHoras += calcularTotalHorasDia(d.batidas);
      continue;
    }
    const reg = d.registroOriginal;
    const folgaAutorizada = reg?.folgas?.includes(funcionarioSelecionado) ?? false;
    if (ehDiaUtil(d.data)) {
      previstasHoras += carga;
      if (d.temBatida) {
        trabalhadasHoras += calcularTotalHorasDia(d.batidas);
      } else if (reg?.fechado) {
        // não conta falta
      } else if (folgaAutorizada) {
        folgasCount += 1;
      } else if (!antesDaAdmissao(d.data, funcionarioSelecionado)) {
        faltasCount += 1;
      }
    } else {
      folgasCount += 1;
      if (d.temBatida) trabalhadasHoras += calcularTotalHorasDia(d.batidas);
    }
  }
}

const saldoHoras = trabalhadasHoras - previstasHoras;

  // ==============================
  // CONTROLES DE MODAL E EDIÇÃO
  // ==============================

  const abrirModalComRegistro = (registro: Dia) => {
    // clone to avoid direct mutation
    const clone: Dia = {
      data: registro.data,
      batidas: registro.batidas ? JSON.parse(JSON.stringify(registro.batidas)) : [],
      folgas: registro.folgas ? [...registro.folgas] : [],
      fechado: !!registro.fechado,
    };
    setDiaSelecionado(clone);
    setModalVisivel(true);
  };

  const abrirModalVazio = (date: string) => {
    const novo: Dia = { data: date, batidas: [], folgas: [], fechado: false };
    setDiaSelecionado(novo);
    setModalVisivel(true);
  };

  const salvarEdicao = async () => {
    if (!diaSelecionado) return;
    // se já existe, replace; se não existe e tem conteúdo relevante, adiciona
    const existe = dias.some(d => d.data === diaSelecionado.data);
    let diasAtualizados: Dia[];
    if (existe) {
      diasAtualizados = dias.map(d => (d.data === diaSelecionado.data ? diaSelecionado : d));
    } else {
      // insert preserving order (newest first)
      diasAtualizados = [diaSelecionado, ...dias.filter(d => d.data !== diaSelecionado.data)];
    }
    await AsyncStorage.setItem('dias', JSON.stringify(diasAtualizados));
    setDias(diasAtualizados);
    setModalVisivel(false);
  };

  const removerBatida = (batidaId: string) => {
    if (!diaSelecionado) return;
    const novas = diaSelecionado.batidas.filter(b => b.id !== batidaId);
    setDiaSelecionado({ ...diaSelecionado, batidas: novas });
  };

  const toggleFolgaFuncionario = (funcId: string) => {
    if (!diaSelecionado) return;
    const folgas = diaSelecionado.folgas ?? [];
    if (folgas.includes(funcId)) {
      setDiaSelecionado({ ...diaSelecionado, folgas: folgas.filter(f => f !== funcId) });
    } else {
      setDiaSelecionado({ ...diaSelecionado, folgas: [...folgas, funcId] });
    }
  };

  const toggleFechado = () => {
    if (!diaSelecionado) return;
    setDiaSelecionado({ ...diaSelecionado, fechado: !diaSelecionado.fechado });
  };

  const editarHoraBatida = (index: number, text: string) => {
    if (!diaSelecionado) return;
    const partes = text.split(':');
    if (partes.length !== 2) return;
    const hh = parseInt(partes[0], 10);
    const mm = parseInt(partes[1], 10);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return;
    const novas = [...diaSelecionado.batidas];
    const b = novas[index];
    const dt = new Date(diaSelecionado.data + 'T00:00:00');
    dt.setHours(hh, mm, 0, 0);
    novas[index] = { ...b, timestamp: dt.toISOString() };
    setDiaSelecionado({ ...diaSelecionado, batidas: novas });
  };

  const obterNomeFuncionario = (id?: string) => {
    if (!id) return '';
    const f = funcionarios.find(x => x.id === id);
    return f ? f.nome : id;
  };

  const abrirEdicao = (dia: Dia) => {
    abrirModalComRegistro(dia);
  };
  // ==============================
  // TROCA DE MÊS
  // ==============================
  const trocarMes = (direcao: 'anterior' | 'proximo') => {
    const indiceAtual = mesesDisponiveis.indexOf(mesSelecionado);
    const novoIndice = direcao === 'proximo' ? indiceAtual - 1 : indiceAtual + 1;
    if (novoIndice >= 0 && novoIndice < mesesDisponiveis.length) {
      setMesSelecionado(mesesDisponiveis[novoIndice]);
    }
  };

  // ==============================
  // RENDERIZAÇÃO DE CADA DIA
  // ==============================

  const renderDia = ({ item }: { item: DiaComInfo }) => {
    const reg = item.registroOriginal;
    const futuro = isFuture(item.data);
    const fechado = reg?.fechado ?? false;
    const folgasDoRegistro = reg?.folgas ?? [];

    // status determination
    let statusLabel: { text: string; color?: string } | null = null;
    if (futuro) {
      if (fechado) statusLabel = { text: 'Fechado (autorizado)', color: '#999' };
      else if (folgasDoRegistro.length > 0) statusLabel = { text: 'Folga autorizada', color: '#999' };
      else statusLabel = { text: 'Futuro', color: '#666' };
    } else {
      if (item.temBatida) statusLabel = null; // show batidas
      else if (fechado) statusLabel = { text: 'Estabelecimento fechado', color: '#555' };
      else if (funcionarioSelecionado === 'todos') {
        if (folgasDoRegistro.length > 0) statusLabel = { text: `Folga autorizada (${folgasDoRegistro.length})`, color: '#2a9d8f' };
        else if (ehDiaUtil(item.data)) statusLabel = { text: 'FALTA', color: 'red' };
        else statusLabel = { text: 'Folga (fim de semana)', color: '#555' };
      } else {
        // specific funcionario
        const folgaAuto = folgasDoRegistro.includes(funcionarioSelecionado);
        if (folgaAuto) statusLabel = { text: 'Folga autorizada', color: '#2a9d8f' };
        else if (ehDiaUtil(item.data)) statusLabel = { text: 'FALTA', color: 'red' };
        else statusLabel = { text: 'Folga (fim de semana)', color: '#555' };
      }
    }

    return (
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.data}>{item.data}</Text>
          {statusLabel ? <Text style={{ color: statusLabel.color, fontWeight: '700' }}>{statusLabel.text}</Text> : null}
        </View>

        {item.temBatida ? (
          <>
            {item.batidas.map((b) => (
              <View key={b.id} style={styles.linhaBatida}>
                <Ionicons name={icones[b.tipo].nome} size={16} color={icones[b.tipo].cor} style={{ marginRight: 6 }} />
                <Text style={{ flex: 1 }}>{b.tipo.replace('_', ' ').toUpperCase()} — {b.timestamp.slice(11, 16)} — {obterNomeFuncionario(b.funcionarioId)}</Text>
              </View>
            ))}
            <Text style={styles.total}>⏱ Total: {formatarHoras(calcularTotalHorasDia(item.batidas))}</Text>
          </>
        ) : null}

        <TouchableOpacity
          style={styles.btnEditar}
          onPress={() => {
            const registro = dias.find(d => d.data === item.data) || { data: item.data, batidas: [], folgas: [], fechado: false } as Dia;
            abrirModalComRegistro(registro);
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Editar</Text>
        </TouchableOpacity>
      </View>
    );
  };
  // ==============================
  // RENDER PRINCIPAL
  // ==============================

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Histórico</Text>

      <View style={styles.resumoBox}>
        <Ionicons name="calendar" size={20} color="#fff" style={{ marginRight: 8 }} />
        <View>
          <Text style={styles.resumoTexto}>{formatarMesAno(mesSelecionado)}</Text>
          <Text style={{ color: '#fff', marginTop: 4 }}>
            Trabalhadas: {formatarHoras(trabalhadasHoras)} — Previstas: {formatarHoras(previstasHoras)} — Saldo: {formatarHoras(saldoHoras)}
          </Text>
          <Text style={{ color: '#fff', marginTop: 4 }}>
            Faltas: {faltasCount} — Folgas (fins de semana/autorizadas): {folgasCount}
          </Text>
        </View>
      </View>

      <View style={{ marginBottom: 10 }}>
        <Picker
          selectedValue={funcionarioSelecionado}
          onValueChange={(valor) => setFuncionarioSelecionado(String(valor))}
        >
          <Picker.Item label="Todos" value="todos" />
          {funcionarios.map(f => (
            <Picker.Item key={f.id} label={`${f.nome} (${(f.cargaDiariaHoras ?? cargaDiariaPadrao)}h)`} value={f.id} />
          ))}
        </Picker>
      </View>

      <View style={styles.navegacaoMes}>
        <TouchableOpacity onPress={() => trocarMes('anterior')}>
          <Ionicons name="chevron-back" size={26} color="#2927B4" />
        </TouchableOpacity>
        <Text style={styles.mesSelecionado}>{formatarMesAno(mesSelecionado)}</Text>
        <TouchableOpacity onPress={() => trocarMes('proximo')}>
          <Ionicons name="chevron-forward" size={26} color="#2927B4" />
        </TouchableOpacity>
      </View>

      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <FlatList
          data={diasComInfo}
          keyExtractor={item => item.data}
          renderItem={renderDia}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>Nenhum dia neste mês.</Text>}
        />
      </Animated.View>

      <Modal visible={modalVisivel} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>{diaSelecionado?.data}</Text>

              {/* Estabelecimento fechado (toggle) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text>Estabelecimento fechado</Text>
                <Switch value={!!diaSelecionado?.fechado} onValueChange={toggleFechado} />
              </View>

              {/* Folgas por funcionário */}
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>Folgas autorizadas</Text>
              {funcionarios.length === 0 ? <Text style={{ marginBottom: 8 }}>Nenhum funcionário cadastrado</Text> : null}
              {funcionarios.map(f => {
                const marcado = (diaSelecionado?.folgas ?? []).includes(f.id);
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => toggleFolgaFuncionario(f.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
                  >
                    <Text>{f.nome} — {(f.cargaDiariaHoras ?? cargaDiariaPadrao)}h</Text>
                    <View style={[styles.checkbox, marcado ? styles.checkboxOn : styles.checkboxOff]}>
                      {marcado ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}

              <View style={{ height: 8 }} />

              {/* Batidas existentes (editar hora / remover) */}
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>Batidas</Text>
              {diaSelecionado?.batidas.length === 0 && <Text style={{ marginBottom: 10 }}>Nenhuma batida neste dia.</Text>}
              {diaSelecionado?.batidas.map((b, index) => (
                <View key={b.id} style={{ marginBottom: 12 }}>
                  <Text style={{ fontWeight: '700' }}>{b.tipo.replace('_', ' ').toUpperCase()} — {obterNomeFuncionario(b.funcionarioId)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={b.timestamp.slice(11, 16)}
                      onChangeText={text => editarHoraBatida(index, text)}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                    <TouchableOpacity onPress={() => removerBatida(b.id)} style={{ backgroundColor: '#900', padding: 8, borderRadius: 6 }}>
                      <Text style={{ color: '#fff' }}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={{ height: 8 }} />

              <Button title="Salvar" onPress={salvarEdicao} />
              <View style={{ height: 8 }} />
              <Button title="Cancelar" onPress={() => setModalVisivel(false)} color="red" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ==============================
// ESTILOS
// ==============================
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  titulo: { fontSize: 26, fontWeight: '700', marginBottom: 12 },
  resumoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2927B4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  resumoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  navegacaoMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  mesSelecionado: { fontSize: 16, fontWeight: '700', color: '#2927B4', marginHorizontal: 8 },
  card: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 10 },
  data: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  linhaBatida: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  total: { marginTop: 6, fontWeight: '700', color: '#2c3e50' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '92%', backgroundColor: '#fff', borderRadius: 8, padding: 16, maxHeight: '84%' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginTop: 6, width: 120 },
  btnEditar: { marginTop: 10, backgroundColor: '#2927B4', padding: 8, borderRadius: 6, alignItems: 'center' },
  checkbox: { width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  checkboxOn: { backgroundColor: '#2a9d8f' },
  checkboxOff: { borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff' },
});
