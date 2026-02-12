// Crie um arquivo: utils/SecurityUtils.ts

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LocalizacaoEmpresa = {
  latitude: number;
  longitude: number;
  raioMetros: number;
};

export class SecurityUtils {
  // Validar hora do servidor vs dispositivo
  static async validarHora(): Promise<{ valido: boolean; mensagem?: string }> {
    try {
      // Obter hora de um servidor confiável
      const response = await fetch('https://worldtimeapi.org/api/timezone/America/Sao_Paulo');
      const data = await response.json();
      const horaServidor = new Date(data.utc_datetime).getTime();
      const horaDispositivo = Date.now();

      // Permitir diferença de até 5 minutos
      const diferencaMinutos = Math.abs(horaServidor - horaDispositivo) / (1000 * 60);

      if (diferencaMinutos > 5) {
        return {
          valido: false,
          mensagem: `Diferença de horário detectada (${Math.round(diferencaMinutos)} minutos). Ajuste o horário do dispositivo.`
        };
      }

      return { valido: true };
    } catch (error) {
      console.warn('Não foi possível validar hora:', error);
      // Em caso de erro na API, permite continuar
      return { valido: true };
    }
  }

  // Validar localização do dispositivo
  static async validarLocalizacao(): Promise<{ valido: boolean; mensagem?: string }> {
    try {
      // Obter configuração da empresa
      const dadosEmpresa = await AsyncStorage.getItem('empresa');
      if (!dadosEmpresa) {
        return { valido: true }; // Sem empresa configurada, não valida
      }

      const empresa = JSON.parse(dadosEmpresa);
      const localizacaoEmpresa = empresa.localizacaoPermitida;

      if (!localizacaoEmpresa || !localizacaoEmpresa.latitude || !localizacaoEmpresa.longitude) {
        return { valido: true }; // Sem localização configurada, não valida
      }

      // Solicitar permissão de localização
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return {
          valido: false,
          mensagem: 'Permissão de localização necessária para registrar ponto'
        };
      }

      // Obter localização atual
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const distancia = this.calcularDistancia(
        localizacaoEmpresa.latitude,
        localizacaoEmpresa.longitude,
        location.coords.latitude,
        location.coords.longitude
      );

      if (distancia > localizacaoEmpresa.raioMetros) {
        return {
          valido: false,
          mensagem: `Fora do perímetro permitido. Distância: ${Math.round(distancia)}m (máx: ${localizacaoEmpresa.raioMetros}m)`
        };
      }

      return { valido: true };
    } catch (error) {
      console.warn('Erro na validação de localização:', error);
      return {
        valido: false,
        mensagem: 'Erro ao verificar localização'
      };
    }
  }

  // Calcular distância entre duas coordenadas (Haversine formula)
  private static calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2 - lat1) * Math.PI/180;
    const Δλ = (lon2 - lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distância em metros
  }

  // Validar tudo antes de registrar ponto
  static async validarRegistro(): Promise<{ valido: boolean; mensagens: string[] }> {
    const mensagens: string[] = [];

    // Validar hora
    const validacaoHora = await this.validarHora();
    if (!validacaoHora.valido && validacaoHora.mensagem) {
      mensagens.push(validacaoHora.mensagem);
    }

    // Validar localização
    const validacaoLocalizacao = await this.validarLocalizacao();
    if (!validacaoLocalizacao.valido && validacaoLocalizacao.mensagem) {
      mensagens.push(validacaoLocalizacao.mensagem);
    }

    return {
      valido: mensagens.length === 0,
      mensagens
    };
  }
}