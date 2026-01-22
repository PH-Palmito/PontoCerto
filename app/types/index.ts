// types/index.ts
export type EventoTipo = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida_final';

export type EventoStatus = 'completo' | 'incompleto' | 'invalido';

export interface Evento {
  id: string;
  tipo: EventoTipo;
  timestamp: string; // ISO 8601
  funcionarioId: string;
  origem: 'registro' | 'correcao';
  // Para eventos de correção:
  eventoOriginalId?: string;
  justificativa?: string;
  responsavel?: string; // Quem fez a correção
  dataCorrecao?: string;
}

export interface DiaCalculado {
  data: string;
  eventos: Evento[];
  status: EventoStatus;
  horasTrabalhadas: number;
  horasPrevistas: number;
  saldoHoras: number;
  // Derivado, não persistido
}

export interface Funcionario {
  id: string;
  nome: string;
  cargaDiariaHoras: number;
  diasSemana: number;
  permiteExtras: boolean;
  admissao: string;
  ativo: boolean;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  controleAlmoco: boolean;
  horaEntrada: string;
  horaAlmocoSugeridaInicio?: string;
  horaAlmocoSugeridaFim?: string;
  horaSaidaFinal: string;
  cargaHorariaPadrao: number;
}