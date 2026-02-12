// utils/HolidayUtils.ts

type Feriado = {
  data: string; // formato YYYY-MM-DD
  nome: string;
  tipo: 'nacional' | 'municipal' | 'estadual';
};

export const HolidayUtils = {
  // Algoritmo de Gauss para calcular o Domingo de Páscoa
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

  // Adiciona dias a uma data
  addDays(data: Date, dias: number): Date {
    const result = new Date(data);
    result.setDate(result.getDate() + dias);
    return result;
  },

  // Formata para YYYY-MM-DD
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  },

  // Gera todos os feriados nacionais (fixos e móveis) para o ano
  getFeriadosNacionais(ano: number): Feriado[] {
    const pascoa = this.getPascoa(ano);
    const carnaval = this.addDays(pascoa, -47); // Terça de carnaval
    const sextaSanta = this.addDays(pascoa, -2);
    const corpusChristi = this.addDays(pascoa, 60);

    const moveis: Feriado[] = [
      { data: this.formatDate(carnaval), nome: 'Carnaval', tipo: 'nacional' },
      { data: this.formatDate(sextaSanta), nome: 'Sexta-feira Santa', tipo: 'nacional' },
      { data: this.formatDate(corpusChristi), nome: 'Corpus Christi', tipo: 'nacional' },
    ];

    const fixos: Feriado[] = [
      { data: `${ano}-01-01`, nome: 'Confraternização Universal', tipo: 'nacional' },
      { data: `${ano}-04-21`, nome: 'Tiradentes', tipo: 'nacional' },
      { data: `${ano}-05-01`, nome: 'Dia do Trabalho', tipo: 'nacional' },
      { data: `${ano}-09-07`, nome: 'Independência do Brasil', tipo: 'nacional' },
      { data: `${ano}-10-12`, nome: 'Nossa Senhora Aparecida', tipo: 'nacional' },
      { data: `${ano}-11-02`, nome: 'Finados', tipo: 'nacional' },
      { data: `${ano}-11-15`, nome: 'Proclamação da República', tipo: 'nacional' },
      { data: `${ano}-11-20`, nome: 'Dia da Consciência Negra', tipo: 'nacional' }, // Novo feriado nacional
      { data: `${ano}-12-25`, nome: 'Natal', tipo: 'nacional' },
    ];

    return [...fixos, ...moveis].sort((a, b) => a.data.localeCompare(b.data));
  },

  // (OPCIONAL) Função para buscar na BrasilAPI
  // Requer internet, mas é muito útil para pegar o código do município
  async buscarFeriadosAPI(ano: number): Promise<Feriado[]> {
    try {
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
      const data = await response.json();
      return data.map((f: any) => ({
        data: f.date,
        nome: f.name,
        tipo: 'nacional'
      }));
    } catch (error) {
      console.log('Erro ao buscar API, usando fallback local');
      return this.getFeriadosNacionais(ano);
    }
  }
};