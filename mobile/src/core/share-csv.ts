import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "./api";

/**
 * Pide el CSV al servidor (mismo formato que la web: punto y coma y BOM para
 * Excel) y abre la hoja de compartir del teléfono: guardarlo en Archivos o
 * Drive, mandarlo por WhatsApp o abrirlo en Hojas de cálculo.
 */
export async function shareCsv(input: { todo?: boolean; mes?: string; tipo?: string; cat?: string; q?: string }) {
  const { name, csv } = await api<{ name: string; csv: string }>("csv", input);
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Exportar movimientos", UTI: "public.comma-separated-values-text" });
}
