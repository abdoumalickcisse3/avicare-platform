/**
 * Ce qui ne concerne que react-pdf. Les calculs de la facture — échéance,
 * montants — vivent dans `lib/invoiceDocument`, partagé avec le mobile.
 */

/**
 * Découpe un data URI en ce que react-pdf sait avaler.
 *
 * `<Image src="data:image/png;base64,…">` ne marche pas : react-pdf décode
 * l'URI puis passe les octets à pdfkit **comme un chemin de fichier**, qui
 * refuse un tampon contenant des octets nuls. La forme explicite `{data, format}`
 * court-circuite cette détection.
 */
export function imageSource(
  dataUri: string | undefined,
): { data: Uint8Array; format: "png" | "jpg" } | undefined {
  if (!dataUri?.startsWith("data:")) return undefined;
  const [header, payload] = dataUri.split(",", 2);
  if (!payload) return undefined;

  const binary = atob(payload);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) data[i] = binary.charCodeAt(i);

  return { data, format: header.includes("jpeg") || header.includes("jpg") ? "jpg" : "png" };
}
