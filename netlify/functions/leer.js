// Función de Netlify: recibe el problema (texto y/o imagen) y devuelve SOLO los datos y el plan en JSON.
// La IA no calcula nada; los cálculos los hace index.html con sus fórmulas.
const resp = (s, o) => ({ statusCode: s, headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return resp(405, { error: "Método no permitido" });
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return resp(400, { error: "Solicitud inválida" }); }
  const { texto = "", imagen = null, catalogo = [] } = b;
  if (!texto && !imagen) return resp(400, { error: "Falta el problema" });

  const sistema = `Eres un asistente que SOLO extrae información de problemas de mecánica de fluidos. NO resuelves ni calculas nada.
Devuelve únicamente un JSON válido, sin texto extra ni markdown, con esta forma:
{"fluido":"nombre del fluido si se menciona (agua, aceite, aire...) o null",
 "datos":[{"k":"clave","valor":número,"unidad":"unidad","nota":"qué dato es"}],
 "incisos":[{"id":"a","pide":"qué pide el inciso, resumido","modulo":"id del módulo o null"}]}
Reglas:
- "k" debe ser una clave de campo del catálogo (lo que está antes del signo "=" en cada campo). "modulo" debe ser un id del catálogo.
- Copia valores y unidades tal como están en el problema; NO conviertas unidades. Usa notación numérica normal (3.5e-6 para 3,5×10⁻⁶). La eficiencia va en %.
- No inventes datos ni propiedades del fluido que el problema no dé. No incluyas la incógnita como dato.
- Si el problema no tiene incisos, devuelve un solo inciso con id "a". Si ningún módulo sirve para un inciso, usa modulo null.
- Si hay una imagen, léela para sacar el enunciado o los datos del esquema.
Catálogo: ${JSON.stringify(catalogo)}`;

  const content = [];
  if (imagen) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagen } });
  content.push({ type: "text", text: texto || "Lee el problema que aparece en la imagen." });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.MODELO || "claude-sonnet-5-5", max_tokens: 2000, system: sistema, messages: [{ role: "user", content }] })
  });
  const j = await r.json();
  if (!r.ok) return resp(502, { error: (j.error && j.error.message) || "Error de la API" });
  const t = (j.content || []).map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
  try { return resp(200, JSON.parse(t)); }
  catch { return resp(502, { error: "La IA no devolvió un formato válido, intenta de nuevo." }); }
};
