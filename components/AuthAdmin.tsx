import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

type Props = {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
};

export default function AuthAdmin({
  visible,
  onSuccess,
  onCancel,
  title = 'Acesso Administrativo',
  subtitle = 'Digite a senha de administrador'
}: Props) {
  const [senha, setSenha] = useState('');
  const [tentativas, setTentativas] = useState(0);
  const [bloqueado, setBloqueado] = useState(false);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [senhaPadrao, setSenhaPadrao] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [shakeAnim] = useState(new Animated.Value(0));

  // Carregar configuração da empresa ao montar
  useEffect(() => {
    carregarSenhaEmpresa();
  }, []);

  // Efeito para animação de entrada
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  // Efeito para contagem regressiva do bloqueio
  useEffect(() => {
    let interval: number | null = null; // Alterado para number | null

    if (bloqueado && tempoRestante > 0) {
      interval = setInterval(() => {
        setTempoRestante(prev => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            setBloqueado(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000) as unknown as number; // Cast para number
    }

    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [bloqueado, tempoRestante]);

  const carregarSenhaEmpresa = async () => {
    try {
      const dadosEmpresa = await AsyncStorage.getItem('empresa');
      if (dadosEmpresa) {
        const empresa = JSON.parse(dadosEmpresa);
        setSenhaPadrao(empresa.senhaAdmin);
      }
    } catch (error) {
      console.error('Erro ao carregar senha da empresa:', error);
    }
  };

  const iniciarAnimacaoErro = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const verificarSenha = async () => {
    if (bloqueado) {
      Alert.alert(
        'Acesso Bloqueado',
        `Tentativas excedidas. Aguarde ${tempoRestante} segundos.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (!senha.trim()) {
      Alert.alert('Atenção', 'Digite a senha de administrador');
      iniciarAnimacaoErro();
      return;
    }

    // Se não há senha cadastrada, permitir qualquer senha (para primeiro acesso)
    if (!senhaPadrao) {
      Alert.alert(
        'Primeiro Acesso',
        'Nenhuma senha de administrador foi definida.\nConfigure uma senha nas Configurações > Cadastro da Empresa.',
        [
          {
            text: 'Continuar',
            onPress: () => {
              setSenha('');
              onSuccess();
            }
          },
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => {
              setSenha('');
              onCancel();
            }
          }
        ]
      );
      return;
    }

    // Verificar senha
    if (senha === senhaPadrao) {
      // Senha correta
      setSenha('');
      setTentativas(0);
      onSuccess();
    } else {
      // Senha incorreta
      const novasTentativas = tentativas + 1;
      setTentativas(novasTentativas);
      setSenha('');
      iniciarAnimacaoErro();

      if (novasTentativas >= 3) {
        setBloqueado(true);
        setTempoRestante(300); // 5 minutos em segundos
        Alert.alert(
          'Acesso Bloqueado',
          'Muitas tentativas incorretas.\nO acesso será bloqueado por 5 minutos.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Senha Incorreta',
          `Tentativa ${novasTentativas} de 3.\n${3 - novasTentativas} tentativa(s) restante(s).`,
          [{ text: 'Tentar Novamente' }]
        );
      }
    }
  };

  const formatarTempo = (segundos: number) => {
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  };

  const tecladoNumerico = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    ['C', 0, '⌫'],
  ];

  const handleTeclaPress = (tecla: string | number) => {
    if (bloqueado) return;

    if (tecla === '⌫') {
      setSenha(prev => prev.slice(0, -1));
    } else if (tecla === 'C') {
      setSenha('');
    } else if (typeof tecla === 'number') {
      if (senha.length < 6) {
        setSenha(prev => prev + tecla.toString());
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Animated.View
        style={[
          styles.modalOverlay,
          { opacity: fadeAnim }
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  { translateX: shakeAnim }
                ]
              }
            ]}
          >
            <LinearGradient
              colors={['#2927B4', '#12114E']}
              style={styles.header}
            >
              <Ionicons name="shield-checkmark" size={36} color="#fff" />
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalSubtitle}>{subtitle}</Text>
            </LinearGradient>

            <View style={styles.content}>
              {/* Indicadores de dígitos */}
              <View style={styles.dotsContainer}>
                {[1, 2, 3, 4, 5, 6].map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index < senha.length && styles.dotFilled
                    ]}
                  >
                    {index < senha.length && (
                      <Text style={styles.dotText}>•</Text>
                    )}
                  </View>
                ))}
              </View>

              {bloqueado && (
                <View style={styles.bloqueadoContainer}>
                  <Ionicons name="lock-closed" size={24} color="#e74c3c" />
                  <Text style={styles.bloqueadoTexto}>
                    Acesso bloqueado por {formatarTempo(tempoRestante)}
                  </Text>
                </View>
              )}

              {tentativas > 0 && !bloqueado && (
                <Text style={styles.tentativasTexto}>
                  Tentativas: {tentativas}/3
                </Text>
              )}

              {/* Teclado Numérico */}
              <View style={styles.tecladoContainer}>
                {tecladoNumerico.map((linha, linhaIndex) => (
                  <View key={linhaIndex} style={styles.linhaTeclado}>
                    {linha.map((tecla, teclaIndex) => (
                      <TouchableOpacity
                        key={teclaIndex}
                        style={[
                          styles.tecla,
                          (tecla === 'C' || tecla === '⌫') && styles.teclaEspecial,
                          bloqueado && styles.teclaDesabilitada
                        ]}
                        onPress={() => handleTeclaPress(tecla)}
                        disabled={bloqueado}
                        activeOpacity={0.7}
                      >
                        {tecla === '⌫' ? (
                          <Ionicons name="backspace-outline" size={24} color="#2927B4" />
                        ) : (
                          <Text style={[
                            styles.textoTecla,
                            (tecla === 'C' || tecla === '⌫') && styles.textoTeclaEspecial
                          ]}>
                            {tecla}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>

              {/* Botões de ação */}
              <View style={styles.botoesContainer}>
                <TouchableOpacity
                  style={styles.botaoCancelar}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={20} color="#e74c3c" />
                  <Text style={styles.botaoCancelarTexto}>CANCELAR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.botaoConfirmar,
                    (!senha.trim() || bloqueado) && styles.botaoDesabilitado
                  ]}
                  onPress={verificarSenha}
                  disabled={!senha.trim() || bloqueado}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.botaoConfirmarTexto}>CONFIRMAR</Text>
                </TouchableOpacity>
              </View>

              {/* Informações de ajuda */}
              <View style={styles.infoContainer}>
                <Ionicons name="information-circle-outline" size={16} color="#666" />
                <Text style={styles.infoTexto}>
                  {!senhaPadrao
                    ? 'Configure uma senha nas Configurações > Cadastro da Empresa'
                    : 'A senha foi definida nas configurações da empresa'
                  }
                </Text>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoidingView: {
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    padding: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
    marginBottom: 5,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  content: {
    padding: 25,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2927B4',
    marginHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotFilled: {
    backgroundColor: '#2927B4',
  },
  dotText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: -2,
  },
  bloqueadoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  bloqueadoTexto: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  tentativasTexto: {
    color: '#FF9800',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '500',
  },
  tecladoContainer: {
    marginBottom: 25,
  },
  linhaTeclado: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  tecla: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  teclaEspecial: {
    backgroundColor: '#e0e4eb',
  },
  teclaDesabilitada: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  textoTecla: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2927B4',
  },
  textoTeclaEspecial: {
    fontSize: 18,
    color: '#e74c3c',
  },
  botoesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  botaoCancelar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e74c3c',
    backgroundColor: '#fff',
    marginRight: 10,
  },
  botaoCancelarTexto: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  botaoConfirmar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2927B4',
    marginLeft: 10,
    shadowColor: '#2927B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  botaoDesabilitado: {
    backgroundColor: '#cccccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  botaoConfirmarTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  infoTexto: {
    color: '#666',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});