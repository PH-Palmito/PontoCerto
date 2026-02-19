import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebaseConfig";

export const uploadFotoBatida = async (
  uri: string,
  empresaId: string,
  funcionarioId: string
) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    const nomeArquivo = `batidas/${empresaId}/${funcionarioId}/${Date.now()}.jpg`;
    const storageRef = ref(storage, nomeArquivo);

    await uploadBytes(storageRef, blob);

    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error("Erro no upload da foto:", error);
    return null;
  }
};
