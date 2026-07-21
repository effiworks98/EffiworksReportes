export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { nombre, contacto, plataforma, descripcion, archivos = [] } = req.body || {};
  if (!nombre || !descripcion) return res.status(400).json({ ok: false });

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const links = archivos.map(a => `📎 <a href="${a.url}">${a.nombre}</a>`).join('\n');
  const texto =
    `🚨 <b>Nuevo reporte · Effiworks</b>\n` +
    `👤 ${nombre} (${contacto || 'sin contacto'})\n` +
    `💻 Plataforma: <b>${plataforma}</b>\n` +
    `📝 ${descripcion}` +
    (links ? `\n\n${links}` : '');

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text: texto,
      parse_mode: 'HTML', disable_web_page_preview: false
    })
  });
  const j = await r.json();
  return res.status(200).json({ ok: j.ok });
}
