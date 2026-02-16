// utils/storage.ts

export const getStorageKeys = (uid: string) => {
  if (!uid) {
    throw new Error('UID inválido');
  }

  return {
    empresa: `empresa_${uid}`,
    funcionarios: `funcionarios_${uid}`,
    dias: `dias_${uid}`,
    feriados: `feriadosPersonalizados_${uid}`,
  };
};
