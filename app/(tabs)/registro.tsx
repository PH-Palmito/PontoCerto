import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Dimensions,
  Alert,
  Share,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { auth } from '../../utils/firebaseConfig';
import { getStorageKeys } from '../../utils/storage';
import { useFocusEffect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';

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
  folgas?: string[];
  fechado?: boolean;
};

type Funcionario = {
  id: string;
  nome: string;
  cargaDiariaHoras?: number;
  admissao: string;
};

const { width } = Dimensions.get('window');

const rotuloBatida: Record<BatidaTipo, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Início da Pausa',
  retorno_almoco: 'Fim da Pausa',
  saida_final: 'Saída',
};

export default function HistoricoScreen() {
  const [dias, setDias] = useState<Dia[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState<string>('');
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<Dia | null>(null);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>('todos');
  const [horasEditando, setHorasEditando] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<'todos' | 'presente' | 'ausente' | 'folga'>('todos');
  const [resumoExpandido, setResumoExpandido] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Estados para o modal de foto ampliada (agora com info do funcionário)
  const [fotoInfo, setFotoInfo] = useState<{ uri: string; funcionarioId: string } | null>(null);
  const [modalFotoVisivel, setModalFotoVisivel] = useState(false);

  const alturaAnim = useRef(new Animated.Value(0)).current;
  const rotacaoAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cargaDiariaPadrao = 8;
  const [uid, setUid] = useState<string | null>(null);
  // Adicione junto aos outros states
  const [empresa, setEmpresa] = useState<any>(null);

  // ========== FUNÇÃO DE CARREGAMENTO (memoizada) ==========
  const carregarDados = useCallback(async () => {
    if (!uid) return;
    const keys = getStorageKeys(uid);

    const dadosDias = await AsyncStorage.getItem(keys.dias);
    const dadosFuncionarios = await AsyncStorage.getItem(keys.funcionarios);

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

        const mesesFromData = Array.from(
          new Set(
            ordenados.map(d => {
              const [ano, mes] = d.data.split('-');
              return `${ano}-${mes}`;
            })
          )
        );

        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const todosMeses = Array.from(new Set([...mesesFromData, mesAtual]));

        todosMeses.sort((a, b) => {
          const [anoA, mesA] = a.split('-').map(Number);
          const [anoB, mesB] = b.split('-').map(Number);
          if (anoA !== anoB) return anoB - anoA;
          return mesB - mesA;
        });

        setMesesDisponiveis(todosMeses);
        setMesSelecionado(mesAtual);
      } catch {
        setDias([]);
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        setMesesDisponiveis([mesAtual]);
        setMesSelecionado(mesAtual);
      }
    } else {
      const hoje = new Date();
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      setMesesDisponiveis([mesAtual]);
      setMesSelecionado(mesAtual);
    }
  }, [uid]);

  // Carrega na montagem inicial
  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Carrega sempre que a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [carregarDados])
  );

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [mesSelecionado, funcionarioSelecionado, dias, funcionarios]);

  useEffect(() => {
    Animated.timing(alturaAnim, {
      toValue: resumoExpandido ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    Animated.timing(rotacaoAnim, {
      toValue: resumoExpandido ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [resumoExpandido]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setUid(user?.uid ?? null);
    });
    return unsub;
  }, []);

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

  const horaDeTimestamp = (ts: string) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatarData = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia);
    const opcoes: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };
    return data.toLocaleDateString('pt-BR', opcoes);
  };

  const formatarDataSimples = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia);
    return data.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      weekday: 'short'
    }).replace(',', '');
  };

  const icones: Record<BatidaTipo, { nome: keyof typeof Ionicons.glyphMap; cor: string }> = {
    entrada: { nome: 'log-in', cor: '#4CAF50' },
    saida_almoco: { nome: 'fast-food', cor: '#FF9800' },
    retorno_almoco: { nome: 'return-up-forward', cor: '#2196F3' },
    saida_final: { nome: 'log-out', cor: '#F44336' },
  };

  const gerarDiasDoMes = (mesAno: string) => {
    if (!mesAno) return [];
    const [anoS, mesS] = mesAno.split('-');
    const ano = Number(anoS);
    const mes = Number(mesS);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const lista: string[] = [];
    for (let d = 1; d <= ultimoDia; d++) {
      lista.push(`${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return lista;
  };

  const ehDiaUtil = (dataISO: string) => {
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const d = new Date(ano, mes - 1, dia).getDay();
    return d !== 0 && d !== 6;
  };

  const isFuture = (dataISO: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [ano, mes, dia] = dataISO.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia);
    data.setHours(0, 0, 0, 0);

    return data > hoje;
  };

  const todosDiasDoMes = gerarDiasDoMes(mesSelecionado);

  type DiaComInfo = {
    data: string;
    batidas: Batida[];
    temBatida: boolean;
    registroOriginal?: Dia | undefined;
  };

  const diasComInfo: DiaComInfo[] = todosDiasDoMes.map(date => {
    const registro = modalVisivel && diaSelecionado?.data === date
      ? diaSelecionado
      : dias.find(d => d.data === date);

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

  const NomeFuncionario = (id: string) => {
    const f = funcionarios.find(x => x.id === id);
    return f?.nome ?? id;
  };

  const antesDaAdmissao = (dataDia: string, id: string) => {
    const adm = admissaoDe(id);
    if (!adm) return false;
    return new Date(dataDia) < adm;
  };

  let previstasHoras = 0;
  let trabalhadasHoras = 0;
  let faltasCount = 0;
  let folgasCount = 0;

  if (funcionarioSelecionado === 'todos') {
    for (const d of diasComInfo) {
      if (isFuture(d.data)) continue;

      if (ehDiaUtil(d.data)) {
        if (d.temBatida) continue;

        const reg = d.registroOriginal;

        if (reg?.fechado) {
          folgasCount += funcionarios.length;
          continue;
        }

        if (reg?.folgas && reg.folgas.length > 0) {
          for (const f of funcionarios) {
            if (reg.folgas.includes(f.id)) {
              folgasCount += 1;
            } else if (!antesDaAdmissao(d.data, f.id)) {
              faltasCount += 1;
            }
          }
          continue;
        }

        for (const f of funcionarios) {
          if (antesDaAdmissao(d.data, f.id)) continue;
          faltasCount += 1;
        }
      } else {
        folgasCount += funcionarios.length;
      }
    }

    previstasHoras = 0;
    trabalhadasHoras = 0;
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
          continue;
        }

        if (reg?.fechado) continue;

        if (folgaAutorizada) {
          folgasCount += 1;
          continue;
        }

        if (!antesDaAdmissao(d.data, funcionarioSelecionado)) {
          faltasCount += 1;
        }
      } else {
        folgasCount += 1;
        if (d.temBatida) trabalhadasHoras += calcularTotalHorasDia(d.batidas);
      }
    }
  }

  const saldoHoras = funcionarioSelecionado === 'todos' ? 0 : trabalhadasHoras - previstasHoras;

  const abrirModalComRegistro = (registro: Dia) => {
    const clone: Dia = {
      data: registro.data,
      batidas: registro.batidas ? JSON.parse(JSON.stringify(registro.batidas)) : [],
      folgas: registro.folgas ? [...registro.folgas] : [],
      fechado: !!registro.fechado,
    };
    setDiaSelecionado(clone);
    setModalVisivel(true);
  };

  const salvarEdicao = async () => {
    if (!diaSelecionado) return;
    if (!auth.currentUser) return;

    const existe = dias.some(d => d.data === diaSelecionado.data);
    let diasAtualizados: Dia[];
    if (existe) {
      diasAtualizados = dias.map(d => (d.data === diaSelecionado.data ? diaSelecionado : d));
    } else {
      diasAtualizados = [diaSelecionado, ...dias.filter(d => d.data !== diaSelecionado.data)];
    }
    if (!uid) return;
    const keys = getStorageKeys(uid);

    await AsyncStorage.setItem(keys.dias, JSON.stringify(diasAtualizados));
    setDias(diasAtualizados);
    setHorasEditando({});
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

  const trocarMes = (direcao: 'anterior' | 'proximo') => {
    const indiceAtual = mesesDisponiveis.indexOf(mesSelecionado);
    if (direcao === 'anterior') {
      if (indiceAtual < mesesDisponiveis.length - 1) {
        setMesSelecionado(mesesDisponiveis[indiceAtual + 1]);
      }
    } else {
      if (indiceAtual > 0) {
        setMesSelecionado(mesesDisponiveis[indiceAtual - 1]);
      }
    }
  };

  // ===== FUNÇÃO DE EXPORTAÇÃO CSV =====
  const gerarCSV = async () => {
    if (diasComInfo.length === 0) {
      return Alert.alert("Aviso", "Não há dados para exportar neste mês.");
    }

    setExportando(true);
    try {
      const cabecalho = "Data;Funcionário;Registro;Horário;Total Horas Dia\n";
      const nomeFunc = funcionarioSelecionado === 'todos' ? 'Todos' : NomeFuncionario(funcionarioSelecionado);

      const linhas = diasComInfo.map(dia => {
        if (!dia.temBatida) {
          return `${formatarDataSimples(dia.data)};${nomeFunc};Sem Registro;;0h 0min`;
        }
        return dia.batidas.map(b => {
          return `${formatarDataSimples(dia.data)};${NomeFuncionario(b.funcionarioId)};${rotuloBatida[b.tipo]};${horaDeTimestamp(b.timestamp)};${formatarHoras(calcularTotalHorasDia(dia.batidas))}`;
        }).join('\n');
      }).join('\n');

      const csvCompleto = cabecalho + linhas;

      // @ts-ignore - cacheDirectory existe em runtime
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) throw new Error("Diretório não disponível");

      const fileName = `Relatorio_Ponto_${mesSelecionado}.csv`;
      const fileUri = baseDir + fileName;

      // @ts-ignore - EncodingType existe, mas o tipo pode não ser reconhecido
      await FileSystem.writeAsStringAsync(fileUri, "\uFEFF" + csvCompleto, {
        encoding: 'utf8',
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
      }
    } catch (error) {
      console.error("Erro ao gerar CSV:", error);
      Alert.alert("Erro", "Não foi possível gerar a planilha.");
    } finally {
      setExportando(false);
    }
  };

  // Função de exportação PDF
  const gerarPDF = async () => {
    if (diasComInfo.length === 0) {
      return Alert.alert("Aviso", "Não há dados para gerar o PDF.");
    }

    setExportando(true);
    try {
      const nomeEmpresa = empresa?.nome || "Minha Empresa";
      const nomeFunc = funcionarioSelecionado === 'todos' ? 'Relatório Geral' : NomeFuncionario(funcionarioSelecionado);

      // Gerar as linhas da tabela em HTML
      const linhasHtml = diasComInfo.map(dia => {
        const totalDia = dia.temBatida ? formatarHoras(calcularTotalHorasDia(dia.batidas)) : "---";
        const status = !dia.temBatida ? `<span style="color: red; font-weight: bold;">FALTA</span>` : "Presente";

        // Detalhar as batidas do dia
        const detalhesBatidas = dia.batidas.length > 0
          ? dia.batidas.map(b => `${rotuloBatida[b.tipo]}: ${horaDeTimestamp(b.timestamp)}`).join('<br>')
          : status;

        return `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${formatarDataSimples(dia.data)}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${detalhesBatidas}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${totalDia}</td>
          </tr>
        `;
      }).join('');

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #333; }
              h1 { color: #2927B4; text-align: center; }
              .header-info { margin-bottom: 20px; border-bottom: 2px solid #2927B4; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background-color: #2927B4; color: white; padding: 10px; text-align: left; }
              .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <h1>Relatório de Ponto</h1>
            <div class="header-info">
              <p><strong>Empresa:</strong> ${nomeEmpresa}</p>
              <p><strong>Colaborador:</strong> ${nomeFunc}</p>
              <p><strong>Período:</strong> ${formatarMesAno(mesSelecionado)}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Registros</th>
                  <th>Total do Dia</th>
                </tr>
              </thead>
              <tbody>
                ${linhasHtml}
              </tbody>
            </table>
            <div class="footer">
              <p>Gerado automaticamente pelo PontoCerto em ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </body>
        </html>
      `;

      // Gerar o arquivo PDF
      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      // Compartilhar o arquivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      Alert.alert("Erro", "Falha ao gerar o documento PDF.");
    } finally {
      setExportando(false);
    }
  };

  const mostrarMenuExportacao = () => {
    Alert.alert(
      'Exportar',
      'Escolha o formato',
      [
        { text: 'PDF', onPress: gerarPDF },
        { text: 'CSV', onPress: gerarCSV },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const rotacao = rotacaoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  const alturaInterpolada = alturaAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200] // altura aproximada do conteúdo do resumo
  });

  const renderDia = ({ item }: { item: DiaComInfo }) => {
    const reg = item.registroOriginal;
    const futuro = isFuture(item.data);
    const fechado = reg?.fechado ?? false;
    const folgasDoRegistro = reg?.folgas ?? [];

    // Determinar status para funcionário específico (usado no card individual)
    let statusLabel: { text: string; color?: string } | null = null;

    if (!futuro && funcionarioSelecionado !== 'todos') {
      if (!item.temBatida) {
        if (fechado) {
          statusLabel = { text: 'Estabelecimento fechado', color: '#555' };
        } else if (folgasDoRegistro.includes(funcionarioSelecionado)) {
          statusLabel = { text: 'Folga autorizada', color: '#2a9d8f' };
        } else if (!ehDiaUtil(item.data)) {
          statusLabel = { text: 'Folga (FDS)', color: '#555' };
        } else if (!antesDaAdmissao(item.data, funcionarioSelecionado)) {
          statusLabel = { text: 'FALTA', color: '#e74c3c' };
        }
      }
    } else if (futuro) {
      statusLabel = { text: 'Futuro', color: '#666' };
    }

    // ========== CARD PARA "TODOS OS FUNCIONÁRIOS" ==========
    if (funcionarioSelecionado === 'todos') {
      // Calcular indicadores do dia
      const infoDia = (() => {
        const funcionariosComBatida = new Set(
          (reg?.batidas ?? []).map(b => b.funcionarioId)
        );

        let presentes = 0,
          faltas = 0,
          folgasCount = 0;

        funcionarios.forEach(f => {
          if (antesDaAdmissao(item.data, f.id)) return;
          if (fechado) return; // estabelecimento fechado: ninguém é considerado presente/falta

          if (funcionariosComBatida.has(f.id)) {
            presentes++;
          } else if (folgasDoRegistro.includes(f.id)) {
            folgasCount++;
          } else if (ehDiaUtil(item.data)) {
            faltas++;
          } else {
            // fim de semana sem batida = folga
            folgasCount++;
          }
        });

        return { presentes, faltas, folgasCount, fechado };
      })();

      // Definir cor de fundo/borda com base no status do dia (fechado ou falta)
      let borderColor = '#f0f0f0';
      let backgroundColor = '#fff';
      if (infoDia.fechado) {
        borderColor = '#2a9d8f';
        backgroundColor = '#d0f0e8';
      } else if (infoDia.faltas > 0 && infoDia.presentes === 0 && infoDia.folgasCount === 0) {
        // Se todo mundo faltou (exceto admitidos depois)
        borderColor = '#e74c3c';
        backgroundColor = '#fee';
      } else if (infoDia.faltas > 0) {
        // Pelo menos uma falta, mas não todos
        borderColor = '#e74c3c';
        backgroundColor = '#fff5f5';
      }

      return (
        <View style={[styles.card, { borderColor, backgroundColor }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.data}>{formatarDataSimples(item.data)}</Text>
            {futuro && (
              <View style={[styles.statusBadge, { backgroundColor: '#66620' }]}>
                <Text style={[styles.statusText, { color: '#666' }]}>Futuro</Text>
              </View>
            )}
            {!futuro && infoDia.fechado && (
              <View style={[styles.statusBadge, { backgroundColor: '#2a9d8f20' }]}>
                <Text style={[styles.statusText, { color: '#2a9d8f' }]}>Fechado</Text>
              </View>
            )}
          </View>

          <View style={styles.resumoLinha}>
            <View style={styles.resumoItemPequeno}>
              <Ionicons name="people-outline" size={16} color="#2927B4" />
              <Text style={styles.resumoTexto}>{funcionarios.length} func.</Text>
            </View>
            <View style={styles.resumoItemPequeno}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
              <Text style={styles.resumoTexto}>{infoDia.presentes} presentes</Text>
            </View>
            <View style={styles.resumoItemPequeno}>
              <Ionicons name="close-circle-outline" size={16} color="#e74c3c" />
              <Text style={styles.resumoTexto}>{infoDia.faltas} faltas</Text>
            </View>
            <View style={styles.resumoItemPequeno}>
              <Ionicons name="calendar-outline" size={16} color="#2a9d8f" />
              <Text style={styles.resumoTexto}>{infoDia.folgasCount} folgas</Text>
            </View>
          </View>

          {item.temBatida && (
            <TouchableOpacity
              style={styles.btnVerDetalhes}
              onPress={() => abrirModalComRegistro(reg || { data: item.data, batidas: [], folgas: [], fechado: false } as Dia)}
            >
              <Text style={styles.btnVerDetalhesTexto}>Ver detalhes</Text>
              <Ionicons name="arrow-forward" size={16} color="#2927B4" />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // ========== CARD PARA FUNCIONÁRIO ESPECÍFICO ==========
    const batidasParaRenderizar = item.batidas;

    // Determinar cor de fundo/borda com base no status
    let cardBorderColor = '#f0f0f0';
    let cardBackgroundColor = '#fff';

    if (statusLabel) {
      if (statusLabel.text === 'FALTA') {
        cardBorderColor = '#e74c3c';
        cardBackgroundColor = '#fee';
      } else if (statusLabel.text === 'Folga autorizada' || statusLabel.text === 'Estabelecimento fechado') {
        cardBorderColor = '#2a9d8f';
        cardBackgroundColor = '#d0f0e8';
      } else if (statusLabel.text === 'Folga (FDS)') {
        cardBorderColor = '#2a9d8f';
        cardBackgroundColor = '#e8f8f5';
      }
    }

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: cardBorderColor, backgroundColor: cardBackgroundColor }]}
        onPress={() => abrirModalComRegistro(reg || { data: item.data, batidas: [], folgas: [], fechado: false } as Dia)}
        activeOpacity={0.7}
        disabled={futuro}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.data}>{formatarDataSimples(item.data)}</Text>
          {statusLabel && (
            <View style={[styles.statusBadge, { backgroundColor: `${statusLabel.color}15` }]}>
              <Text style={[styles.statusText, { color: statusLabel.color }]}>{statusLabel.text}</Text>
            </View>
          )}
        </View>

        {item.temBatida ? (
          <>
            {batidasParaRenderizar.map((b) => (
              <View key={b.id} style={styles.batidaItem}>
                <View style={[styles.batidaIcon, { backgroundColor: `${icones[b.tipo].cor}15` }]}>
                  <Ionicons name={icones[b.tipo].nome} size={16} color={icones[b.tipo].cor} />
                </View>
                <View style={styles.batidaInfo}>
                  <Text style={styles.batidaTipo}>{rotuloBatida[b.tipo]}</Text>
                  <Text style={styles.batidaHora}>{horaDeTimestamp(b.timestamp)}</Text>
                </View>

                {/* FOTO COM AMPLIAÇÃO AO CLICAR */}
                {b.photoUri && (
                  <TouchableOpacity
                    onPress={() => {
                      setFotoInfo({ uri: b.photoUri!, funcionarioId: b.funcionarioId });
                      setModalFotoVisivel(true);
                    }}
                  >
                    <Image
                      source={{ uri: b.photoUri }}
                      style={{ width: 45, height: 45, borderRadius: 8, marginLeft: 10 }}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <View style={styles.totalContainer}>
              <Text style={styles.totalText}>Total: {formatarHoras(calcularTotalHorasDia(batidasParaRenderizar))}</Text>
            </View>
          </>
        ) : (
          <View style={styles.semBatidas}>
            <Text style={styles.semBatidasTexto}>Sem registros</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2927B4', '#12114E']} style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <Text style={styles.titulo}>Histórico</Text>
          <TouchableOpacity onPress={mostrarMenuExportacao} style={styles.exportButton} disabled={exportando}>
            {exportando ? (
              <Ionicons name="refresh-outline" size={24} color="#fff" />
            ) : (
              <Ionicons name="download-outline" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Filtros */}
        <View style={styles.filtrosContainer}>
          <View style={styles.seletorContainer}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.seletorIcon} />
            <Picker
              selectedValue={funcionarioSelecionado}
              onValueChange={(valor) => setFuncionarioSelecionado(String(valor))}
              style={styles.picker}
              dropdownIconColor="#2927B4"
            >
              <Picker.Item label="Todos os funcionários" value="todos" />
              {funcionarios.map(f => (
                <Picker.Item
                  key={f.id}
                  label={`${f.nome} (${(f.cargaDiariaHoras ?? cargaDiariaPadrao)}h/dia)`}
                  value={f.id}
                />
              ))}
            </Picker>
          </View>

          <View style={styles.navegacaoMes}>
            <TouchableOpacity
              onPress={() => trocarMes('anterior')}
              disabled={mesesDisponiveis.indexOf(mesSelecionado) === mesesDisponiveis.length - 1}
              style={styles.navBtn}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={mesesDisponiveis.indexOf(mesSelecionado) === mesesDisponiveis.length - 1 ? '#cccccc' : '#2927B4'}
              />
            </TouchableOpacity>

            <View style={styles.mesContainer}>
              <Text style={styles.mesSelecionado}>{formatarMesAno(mesSelecionado)}</Text>
              <Text style={styles.mesInfo}>{diasComInfo.length} dias</Text>
            </View>

            <TouchableOpacity
              onPress={() => trocarMes('proximo')}
              disabled={mesesDisponiveis.indexOf(mesSelecionado) === 0}
              style={styles.navBtn}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={mesesDisponiveis.indexOf(mesSelecionado) === 0 ? '#cccccc' : '#2927B4'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Acordeão do Resumo */}
        <View style={styles.acordeaoContainer}>
          <TouchableOpacity
            style={styles.acordeaoHeader}
            onPress={() => setResumoExpandido(!resumoExpandido)}
            activeOpacity={0.7}
          >
            <View style={styles.acordeaoHeaderContent}>
              <Ionicons name="stats-chart-outline" size={24} color="#2927B4" />
              <Text style={styles.acordeaoTitle}>Resumo do Mês</Text>
            </View>
            <Animated.View style={{ transform: [{ rotate: rotacao }] }}>
              <Ionicons name="chevron-down" size={24} color="#2927B4" />
            </Animated.View>
          </TouchableOpacity>

          <Animated.View style={[styles.acordeaoContent, { height: alturaInterpolada }]}>
            <ScrollView style={styles.acordeaoScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.resumoGrid}>
                {funcionarioSelecionado === 'todos' ? (
                  <>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="people-outline" size={20} color="#2927B4" />
                      <Text style={styles.resumoItemValue}>{funcionarios.length}</Text>
                      <Text style={styles.resumoItemLabel}>Funcionários</Text>
                    </View>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="close-circle-outline" size={20} color="#e74c3c" />
                      <Text style={[styles.resumoItemValue, { color: '#e74c3c' }]}>{faltasCount}</Text>
                      <Text style={styles.resumoItemLabel}>Faltas</Text>
                    </View>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="calendar-outline" size={20} color="#2a9d8f" />
                      <Text style={[styles.resumoItemValue, { color: '#2a9d8f' }]}>{folgasCount}</Text>
                      <Text style={styles.resumoItemLabel}>Folgas</Text>
                    </View>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                      <Text style={[styles.resumoItemValue, { color: '#4CAF50' }]}>
                        {funcionarios.length - faltasCount}
                      </Text>
                      <Text style={styles.resumoItemLabel}>Presentes</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="time-outline" size={20} color="#27ae60" />
                      <Text style={[styles.resumoItemValue, { color: '#27ae60' }]}>
                        {formatarHoras(trabalhadasHoras)}
                      </Text>
                      <Text style={styles.resumoItemLabel}>Trabalhadas</Text>
                    </View>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="hourglass-outline" size={20} color="#3498db" />
                      <Text style={[styles.resumoItemValue, { color: '#3498db' }]}>
                        {formatarHoras(previstasHoras)}
                      </Text>
                      <Text style={styles.resumoItemLabel}>Previstas</Text>
                    </View>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="trending-up-outline" size={20} color={saldoHoras >= 0 ? '#27ae60' : '#e74c3c'} />
                      <Text style={[styles.resumoItemValue, { color: saldoHoras >= 0 ? '#27ae60' : '#e74c3c' }]}>
                        {formatarHoras(saldoHoras)}
                      </Text>
                      <Text style={styles.resumoItemLabel}>Saldo</Text>
                    </View>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="close-circle-outline" size={20} color="#e74c3c" />
                      <Text style={[styles.resumoItemValue, { color: '#e74c3c' }]}>{faltasCount}</Text>
                      <Text style={styles.resumoItemLabel}>Faltas</Text>
                    </View>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="calendar-outline" size={20} color="#2a9d8f" />
                      <Text style={[styles.resumoItemValue, { color: '#2a9d8f' }]}>{folgasCount}</Text>
                      <Text style={styles.resumoItemLabel}>Folgas</Text>
                    </View>
                    <View style={styles.resumoItemCard}>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                      <Text style={[styles.resumoItemValue, { color: '#4CAF50' }]}>
                        {diasComInfo.filter(d => d.temBatida).length}
                      </Text>
                      <Text style={styles.resumoItemLabel}>Dias trabalhados</Text>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>

        <Text style={styles.subtitulo}>Registros do Mês</Text>

        <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
          <FlatList
            data={diasComInfo}
            keyExtractor={item => item.data}
            renderItem={renderDia}
            ListEmptyComponent={
              <View style={styles.listaVazia}>
                <Ionicons name="calendar-outline" size={48} color="#ddd" />
                <Text style={styles.listaVaziaTexto}>Nenhum registro neste mês</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      </View>

      {/* Modal de edição */}
      <Modal visible={modalVisivel} animationType="slide" transparent>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{formatarData(diaSelecionado?.data || '')}</Text>
                <TouchableOpacity onPress={() => setModalVisivel(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {isFuture(diaSelecionado?.data || '') && (
                <View style={styles.futureWarning}>
                  <Ionicons name="warning-outline" size={20} color="#FF9800" />
                  <Text style={styles.futureWarningText}>
                    Este dia é futuro. Apenas folgas e fechamento podem ser configurados.
                  </Text>
                </View>
              )}

              {funcionarioSelecionado === 'todos' ? (
                <>
                  <View style={styles.modalSection}>
                    <View style={styles.switchContainer}>
                      <Text style={styles.switchLabel}>Estabelecimento fechado</Text>
                      <Switch
                        value={!!diaSelecionado?.fechado}
                        onValueChange={toggleFechado}
                        trackColor={{ false: '#ddd', true: '#2927B4' }}
                      />
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Status dos Funcionários</Text>

                    <View style={styles.filterButtons}>
                      <TouchableOpacity
                        style={[styles.filterButton, filterStatus === 'todos' && styles.filterButtonActive]}
                        onPress={() => setFilterStatus('todos')}
                      >
                        <Text style={[styles.filterButtonText, filterStatus === 'todos' && styles.filterButtonTextActive]}>
                          Todos ({funcionarios.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.filterButton, filterStatus === 'presente' && styles.filterButtonActive]}
                        onPress={() => setFilterStatus('presente')}
                      >
                        <Text style={[styles.filterButtonText, filterStatus === 'presente' && styles.filterButtonTextActive]}>
                          Presentes
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.filterButton, filterStatus === 'ausente' && styles.filterButtonActive]}
                        onPress={() => setFilterStatus('ausente')}
                      >
                        <Text style={[styles.filterButtonText, filterStatus === 'ausente' && styles.filterButtonTextActive]}>
                          Ausentes
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.filterButton, filterStatus === 'folga' && styles.filterButtonActive]}
                        onPress={() => setFilterStatus('folga')}
                      >
                        <Text style={[styles.filterButtonText, filterStatus === 'folga' && styles.filterButtonTextActive]}>
                          Folgas
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {funcionarios.map(f => {
                      const batidasDoFunc = (diaSelecionado?.batidas ?? []).filter(b => b.funcionarioId === f.id);
                      const temBatida = batidasDoFunc.length > 0;
                      const folgaAutorizada = (diaSelecionado?.folgas ?? []).includes(f.id);
                      const antesAdmissao = antesDaAdmissao(diaSelecionado?.data || '', f.id);

                      if (filterStatus === 'presente' && (!temBatida || diaSelecionado?.fechado)) return null;
                      if (filterStatus === 'ausente' && (temBatida || folgaAutorizada || diaSelecionado?.fechado || !ehDiaUtil(diaSelecionado?.data || '') || antesAdmissao)) return null;
                      if (filterStatus === 'folga' && (!folgaAutorizada && ehDiaUtil(diaSelecionado?.data || ''))) return null;

                      return (
                        <View key={f.id} style={styles.funcionarioCard}>
                          <View style={styles.funcionarioHeader}>
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarText}>{f.nome.charAt(0).toUpperCase()}</Text>
                            </View>
                            <View style={styles.funcionarioInfo}>
                              <Text style={styles.funcionarioNome}>{f.nome}</Text>
                              <Text style={styles.funcionarioCarga}>{(f.cargaDiariaHoras ?? cargaDiariaPadrao)}h/dia</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => toggleFolgaFuncionario(f.id)}
                              style={[styles.folgaButton, folgaAutorizada ? styles.folgaButtonActive : styles.folgaButtonInactive]}
                            >
                              <Ionicons
                                name={folgaAutorizada ? 'checkmark' : 'add'}
                                size={16}
                                color={folgaAutorizada ? '#fff' : '#666'}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.modalSection}>
                    <View style={styles.switchContainer}>
                      <Text style={styles.switchLabel}>Estabelecimento fechado</Text>
                      <Switch
                        value={!!diaSelecionado?.fechado}
                        onValueChange={toggleFechado}
                        trackColor={{ false: '#ddd', true: '#2927B4' }}
                      />
                    </View>

                    <View style={styles.switchContainer}>
                      <Text style={styles.switchLabel}>
                        Folga para {NomeFuncionario(funcionarioSelecionado)}
                      </Text>
                      <Switch
                        value={(diaSelecionado?.folgas ?? []).includes(funcionarioSelecionado)}
                        onValueChange={() => toggleFolgaFuncionario(funcionarioSelecionado)}
                        trackColor={{ false: '#ddd', true: '#2927B4' }}
                      />
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Batidas</Text>

                    {isFuture(diaSelecionado?.data || '') ? (
                      <Text style={styles.futureText}>
                        Não é possível editar batidas em dias futuros.
                      </Text>
                    ) : (
                      <>
                        {(diaSelecionado?.batidas ?? [])
                          .filter(b => b.funcionarioId === funcionarioSelecionado)
                          .map(b => (
                            <View key={b.id} style={styles.batidaModalItem}>
                              <View style={[styles.batidaModalIcon, { backgroundColor: `${icones[b.tipo].cor}15` }]}>
                                <Ionicons name={icones[b.tipo].nome} size={20} color={icones[b.tipo].cor} />
                              </View>
                              <View style={styles.batidaModalInfo}>
                                <Text style={styles.batidaModalTipo}>{rotuloBatida[b.tipo]}</Text>
                                <TextInput
                                  value={horasEditando[b.id] ?? horaDeTimestamp(b.timestamp)}
                                  style={styles.timeInput}
                                  placeholder="HH:MM"
                                  onChangeText={text => {
                                    const limpo = text.replace(/[^\d:]/g, '');
                                    let formatado = limpo;
                                    if (limpo.length <= 2) {
                                      formatado = limpo;
                                    } else if (limpo.length <= 4) {
                                      formatado = `${limpo.slice(0, 2)}:${limpo.slice(2)}`;
                                    } else {
                                      formatado = `${limpo.slice(0, 2)}:${limpo.slice(2, 4)}`;
                                    }
                                    setHorasEditando(prev => ({ ...prev, [b.id]: formatado }));
                                  }}
                                />
                              </View>
                              <TouchableOpacity
                                onPress={() => removerBatida(b.id)}
                                style={styles.deleteButton}
                              >
                                <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                              </TouchableOpacity>
                            </View>
                          ))}
                      </>
                    )}
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.saveButton} onPress={salvarEdicao}>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisivel(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Foto Ampliada com cabeçalho de auditoria */}
      <Modal
        visible={modalFotoVisivel}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalFotoVisivel(false)}
      >
        <View style={styles.modalFotoOverlay}>
          {/* Cabeçalho fixo com informações de auditoria */}
          <View style={styles.fotoHeader}>
            <View style={styles.fotoHeaderContent}>
              <Text style={styles.fotoHeaderNome}>
                {fotoInfo ? NomeFuncionario(fotoInfo.funcionarioId) : 'Funcionário'}
              </Text>
              <Text style={styles.fotoHeaderFrase}>Registro Auditado via GPS e Hora Oficial</Text>
            </View>
            <TouchableOpacity onPress={() => setModalFotoVisivel(false)}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Imagem ampliada */}
          {fotoInfo && (
            <Image
              source={{ uri: fotoInfo.uri }}
              style={styles.fotoEmTelaCheia}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  exportButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 30,
  },
  filtrosContainer: {
    marginBottom: 20,
  },
  seletorContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 15,
  },
  seletorIcon: {
    marginRight: 10,
  },
  picker: {
    flex: 1,
    color: '#2c3e50',
  },
  navegacaoMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  navBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0ff',
  },
  mesContainer: {
    alignItems: 'center',
  },
  mesSelecionado: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
  },
  mesInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  acordeaoContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  acordeaoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  acordeaoHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  acordeaoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginLeft: 10,
  },
  acordeaoContent: {
    overflow: 'hidden',
  },
  acordeaoScrollContent: {
    padding: 20,
  },
  resumoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  resumoItemCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  resumoItemValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#2c3e50',
  },
  resumoItemLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  subtitulo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
    marginLeft: 5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 2, // Aumentado para dar destaque à borda condicional
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  data: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resumoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  resumoItemPequeno: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resumoTexto: {
    fontSize: 12,
    color: '#2c3e50',
  },
  btnVerDetalhes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f0f0ff',
    borderRadius: 8,
  },
  btnVerDetalhesTexto: {
    fontSize: 14,
    color: '#2927B4',
    marginRight: 4,
    fontWeight: '600',
  },
  batidaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  batidaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  batidaInfo: {
    flex: 1,
  },
  batidaTipo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  batidaHora: {
    fontSize: 13,
    color: '#666',
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f4fc',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  totalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 8,
  },
  semBatidas: {
    alignItems: 'center',
    padding: 20,
  },
  semBatidasTexto: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  listaVazia: {
    alignItems: 'center',
    padding: 40,
  },
  listaVaziaTexto: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    flex: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  futureWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  futureWarningText: {
    color: '#856404',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 15,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#2927B4',
    borderColor: '#2927B4',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  funcionarioCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  funcionarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
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
  },
  funcionarioCarga: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  folgaButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folgaButtonActive: {
    backgroundColor: '#2a9d8f',
  },
  folgaButtonInactive: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  futureText: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  batidaModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  batidaModalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  batidaModalInfo: {
    flex: 1,
  },
  batidaModalTipo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    color: '#2c3e50',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalButtons: {
    padding: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2927B4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e74c3c',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos para o modal de foto
  modalFotoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fotoEmTelaCheia: {
    width: width * 0.9,
    height: width * 1.2,
    borderRadius: 15,
  },
  fotoHeader: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 30,
    zIndex: 20,
  },
  fotoHeaderContent: {
    flex: 1,
  },
  fotoHeaderNome: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fotoHeaderFrase: {
    color: '#ddd',
    fontSize: 12,
    marginTop: 2,
  },
});