// app/utils/validation.ts
// Versão simplificada sem crypto-js
import { EventoPonto, CorrecaoEvento, Inconsistencia, TipoEvento } from '../types';

export class ValidacaoPonto {
  static gerarHashSimples(dados: any): string {
    // Função simples de hash para demonstração
    // Em produção, use uma biblioteca como expo-crypto
    const stringDados = JSON.stringify(dados);
    let hash = 0;
    for (let i = 0; i < stringDados.length; i++) {
      const char = stringDados.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  static validarIntegridade(evento: EventoPonto): boolean {
    try {
      const dadosParaHash = {
        id: evento.id,
        tipo: evento.tipo,
        timestamp: evento.timestamp.toISOString(),
        funcionarioId: evento.funcionarioId,
        versao: evento.versao
      };

      const hashCalculado = this.gerarHashSimples(dadosParaHash);
      return hashCalculado === evento.hashValidacao;
    } catch {
      return false;
    }
  }

  static validarSequenciaTemporal(eventos: EventoPonto[]): Inconsistencia[] {
    const inconsistencias: Inconsistencia[] = [];
    const ordenados = [...eventos].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Verificar sequência lógica
    const tiposEsperados: Record<string, (string | null)[]> = {
      entrada: ['saida', null],
      pausa_inicio: ['entrada', 'pausa_fim'],
      pausa_fim: ['pausa_inicio'],
      saida: ['entrada', 'pausa_fim']
    };

    for (let i = 0; i < ordenados.length; i++) {
      const evento = ordenados[i];
      const anterior = i > 0 ? ordenados[i - 1] : null;

      if (anterior && tiposEsperados[evento.tipo]) {
        const permitidos = tiposEsperados[evento.tipo];
        if (!permitidos.includes(anterior.tipo)) {
          inconsistencias.push({
            id: `seq-${evento.id}`,
            tipo: 'sequencia_invalida',
            descricao: `${evento.tipo} não pode ocorrer após ${anterior.tipo}`,
            eventosEnvolvidos: [anterior.id, evento.id],
            dataDetecao: new Date(),
            severidade: 'alta',
            resolvida: false
          });
        }
      }

      // Verificar duplicidade próxima
      if (anterior &&
          evento.tipo === anterior.tipo &&
          Math.abs(new Date(evento.timestamp).getTime() - new Date(anterior.timestamp).getTime()) < 60000) {
        inconsistencias.push({
          id: `dup-${evento.id}`,
          tipo: 'duplicidade',
          descricao: `Evento ${evento.tipo} duplicado em intervalo menor que 1 minuto`,
          eventosEnvolvidos: [anterior.id, evento.id],
          dataDetecao: new Date(),
          severidade: 'media',
          resolvida: false
        });
      }
    }

    return inconsistencias;
  }

  static detectarEventosFaltantes(eventos: EventoPonto[]): Inconsistencia[] {
    const inconsistencias: Inconsistencia[] = [];
    const temEntrada = eventos.some(e => e.tipo === 'entrada');
    const temSaida = eventos.some(e => e.tipo === 'saida');
    const temPausaInicio = eventos.some(e => e.tipo === 'pausa_inicio');
    const temPausaFim = eventos.some(e => e.tipo === 'pausa_fim');

    // Entrada sem saída
    if (temEntrada && !temSaida) {
      const entrada = eventos.find(e => e.tipo === 'entrada')!;
      inconsistencias.push({
        id: `falta-saida-${entrada.id}`,
        tipo: 'evento_faltante',
        descricao: 'Entrada registrada mas saída não encontrada',
        eventosEnvolvidos: [entrada.id],
        dataDetecao: new Date(),
        severidade: 'alta',
        resolvida: false
      });
    }

    // Pausa início sem fim
    if (temPausaInicio && !temPausaFim) {
      const pausaInicio = eventos.find(e => e.tipo === 'pausa_inicio')!;
      inconsistencias.push({
        id: `falta-pausafim-${pausaInicio.id}`,
        tipo: 'evento_faltante',
        descricao: 'Pausa iniciada mas não finalizada',
        eventosEnvolvidos: [pausaInicio.id],
        dataDetecao: new Date(),
        severidade: 'alta',
        resolvida: false
      });
    }

    // Saída sem entrada (se não for o primeiro dia)
    if (temSaida && !temEntrada) {
      const saida = eventos.find(e => e.tipo === 'saida')!;
      inconsistencias.push({
        id: `falta-entrada-${saida.id}`,
        tipo: 'evento_faltante',
        descricao: 'Saída registrada sem entrada correspondente',
        eventosEnvolvidos: [saida.id],
        dataDetecao: new Date(),
        severidade: 'alta',
        resolvida: false
      });
    }

    return inconsistencias;
  }

  static validarCorrecao(
    correcao: Omit<CorrecaoEvento, 'id' | 'dataHoraCorrecao' | 'hashValidacao' | 'status'>,
    eventoOriginal: EventoPonto
  ): { valido: boolean; erros: string[] } {
    const erros: string[] = [];

    // Justificativa obrigatória e mínima
    if (!correcao.justificativa || correcao.justificativa.trim().length < 10) {
      erros.push('Justificativa deve ter pelo menos 10 caracteres');
    }

    // Responsável identificado
    if (!correcao.responsavelId || !correcao.responsavelNome) {
      erros.push('Responsável deve ser identificado');
    }

    // Não permitir auto-correção sem aprovação
    if (correcao.responsavelId === eventoOriginal.funcionarioId) {
      if (!correcao.aprovadorId) {
        erros.push('Auto-correção requer aprovação de supervisor');
      }
    }

    return {
      valido: erros.length === 0,
      erros
    };
  }
}