const SLA_HORAS = { urgente: 6, alta: 12, media: 24, baja: 48 };
const SLA_TXT = { urgente: '4-6 h hábiles', alta: '6-12 h hábiles',
                  media: '12-24 h hábiles', baja: '24-48 h hábiles' };
const EMOJI = { urgente: '🔴', alta: '🟠', media: '🟡', baja: '🟢' };

function sumarHorasHabiles(desde, horas) {
  const d = new Date(desde);
  let restantes = horas * 60;
  while (restantes > 0) {
    d.setMinutes(d.getMinutes() + 15);
    const local = new Date(d.getTime() - 6 * 3600 * 1000);
    const dia = local.getUTCDay(), hora = local.getUTCHours();
    if (dia >= 1 && dia <= 5 && hora >= 9 && hora < 18) restantes -= 15;
  }
  return d;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });
    const { nombre, contacto, plataforma, descripcion, prioridad = 'media', archivos = [] } = req.body || {};
    if (!nombre || !descripcion || !contacto)
      return res.status(400).json({ ok: false, error: 'Faltan campos' });

    const url = process.env.SUPABASE_URL;
    const srk = process.env.SUPABASE_SERVICE_ROLE;
    if (!url) throw new Error('Falta variable SUPABASE_URL en Vercel');
    if (!srk) throw new Error('Falta variable SUPABASE_SERVICE_ROLE en Vercel');
    if (url.includes('/rest/')) throw new Error('SUPABASE_URL no debe incluir /rest/v1, solo el dominio');

    const fechaLimite = sumarHorasHabiles(new Date(), SLA_HORAS[prioridad] ?? 24);

    const ins = await fetch(`${url}/rest/v1/reportes`, {
      method: 'POST',
      headers: { apikey: srk, Authorization: `Bearer ${srk}`,
                 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ nombre, contacto, plataforma, descripcion, prioridad,
                             archivos, fecha_limite: fechaLimite.toISOString() })
    });
    const insTxt = await ins.text();
    if (!ins.ok) throw new Error(`Supabase respondió ${ins.status}: ${insTxt}`);
    const [rep] = JSON.parse(insTxt);
    if (!rep?.id) throw new Error('Supabase no devolvió el reporte: ' + insTxt);

    // Telegram: si falla, no tumba el reporte
    try {
      const links = archivos.map(a => `📎 <a href="${a.url}">${a.nombre}</a>`).join('\n');
      const texto =
        `${EMOJI[prioridad]} <b>Reporte #${rep.id} · ${prioridad.toUpperCase()}</b>\n` +
        `⏱ SLA: ${SLA_TXT[prioridad]} (límite: ${fechaLimite.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })})\n` +
        `👤 ${nombre} (${contacto})\n` +
        `💻 Plataforma: <b>${plataforma}</b>\n` +
        `📝 ${descripcion}` + (links ? `\n\n${links}` : '');
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: texto, parse_mode: 'HTML' })
      });
    } catch (e) { console.error('Telegram falló:', e); }

    return res.status(200).json({ ok: true, id: rep.id });
  } catch (e) {
    console.error('Error en /api/reporte:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
