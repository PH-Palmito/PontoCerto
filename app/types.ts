// app/types.ts
export type TipoEvento = 'entrada' | 'pausa_inicio' | 'pausa_fim' | 'saida';

export interface EventoPonto {
  id: string;
  tipo: TipoEvento;
  timestamp: Date;
  funcionarioId: string;
  dispositivoId?: string;
  localizacao?: {
    latitude: number;
    longitude: number;
    precisao?: number;
  };
  hashValidacao: string;
  versao: number;
  metadata?: Record<string, any>;
}

export interface CorrecaoEvento {
  id: string;
  eventoOriginalId: string;
  novoTimestamp: Date;
  justificativa: string;
  responsavelId: string;
  responsavelNome: string;
  dataHoraCorrecao: Date;
  aprovadorId?: string;
  aprovadorNome?: string;
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'cancelada';
  hashValidacao: string;
  evidencias?: string[];
}

export interface Inconsistencia {
  id: string;
  tipo: 'evento_faltante' | 'sequencia_invalida' | 'sobreposicao' | 'duplicidade' | 'fora_jornada';
  descricao: string;
  eventosEnvolvidos: string[];
  dataDetecao: Date;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  resolvida: boolean;
  resolucao?: {
    tipo: 'correcao' | 'justificativa' | 'ignorada';
    data: Date;
    responsavelId: string;
    detalhes: string;
  };
}

export interface HistoricoDia {
  data: string;
  funcionarioId: string;
  eventos: EventoPonto[];
  correcoes: CorrecaoEvento[];
  inconsistencias: Inconsistencia[];
  bloqueado: boolean;
}

export interface ResumoCalculado {
  data: string;
  horasTrabalhadas: number;
  horasNormais: number;
  horasExtras: number;
  horasFaltantes: number;
  saldoDia: number;
  inconsistencias: Inconsistencia[];
  eventosConsiderados: string[];
  correcoesAplicadas: string[];
  parametrosCalculo: {
    cargaHorariaDiaria: number;
    toleranciaEntrada: number;
    inicioJornada: string;
    fimJornada: string;
  };
}