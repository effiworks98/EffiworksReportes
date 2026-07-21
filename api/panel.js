const COLORES = { urgente:'#dc2626', alta:'#ea580c', media:'#ca8a04', baja:'#16a34a' };

async function enviarCorreoResuelto(rep) {
  if (!rep.contacto || !rep.contacto.includes('@')) return;
  try {
    if (!process.env.BREVO_API_KEY) throw new Error('Falta BREVO_API_KEY en Vercel');
    if (!process.env.EMAIL_FROM) throw new Error('Falta EMAIL_FROM en Vercel');
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY,
                 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Soporte Effiworks', email: process.env.EMAIL_FROM },
        to: [{ email: rep.contacto.trim().toLowerCase(), name: rep.nombre }],
        subject: `✅ Tu reporte #${rep.id} ha sido resuelto`,
        htmlContent: `
          <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;
                      border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(90deg,#1b6ca8,#2193b0);color:#fff;padding:20px 24px">
              <h2 style="margin:0">Effiworks · Soporte</h2></div>
            <div style="padding:24px">
              <p>Hola <b>${rep.nombre}</b>,</p>
              <p>Tu reporte <b>#${rep.id}</b> sobre <b>${rep.plataforma}</b> ha sido marcado como
                 <span style="color:#16a34a;font-weight:700">resuelto ✓</span>.</p>
              <p style="background:#f1f5f9;border-radius:8px;padding:12px;font-size:14px">${rep.descripcion}</p>
              <p>Si el problema persiste, responde este correo o levanta un nuevo reporte.</p>
              <p style="color:#64748b;font-size:13px">Gracias por ayudarnos a mejorar.<br>— Equipo Effiworks</p>
            </div></div>`
      })
    });
    const txt = await r.text();
    console.log('Brevo status:', r.status, 'respuesta:', txt);
    if (!r.ok) throw new Error(`Brevo ${r.status}: ${txt}`);
  } catch (e) {
    console.error('Error enviando correo:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.query.key !== process.env.PANEL_KEY)
    return res.status(403).send('<h3>Acceso denegado</h3>');

  const url = process.env.SUPABASE_URL, srk = process.env.SUPABASE_SERVICE_ROLE;
  const H = { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json' };

  if (req.query.cerrar || req.query.reabrir) {
    const id = req.query.cerrar || req.query.reabrir;
    const cerrando = !!req.query.cerrar;
    const g = await fetch(`${url}/rest/v1/reportes?id=eq.${id}&select=*`, { headers: H });
    const [rep] = await g.json();
    if (rep) {
      await fetch(`${url}/rest/v1/reportes?id=eq.${id}`, {
        method: 'PATCH', headers: H,
        body: JSON.stringify({ estado: cerrando ? 'resuelto' : 'abierto',
                               resuelto_en: cerrando ? new Date().toISOString() : null })
      });
      if (cerrando) await enviarCorreoResuelto(rep);
    }
    return res.redirect(`/api/panel?key=${req.query.key}`);
  }

  const r = await fetch(`${url}/rest/v1/reportes?select=*&order=id.desc`, { headers: H });
  const reportes = await r.json();
  const f = s => s ? new Date(s).toLocaleString('es-MX', { timeZone:'America/Mexico_City',
                     day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
  const ahora = Date.now();

  const filas = reportes.map(rep => {
    const links = (rep.archivos || [])
      .map(a => `<a href="${a.url}" target="_blank">📎 ${a.nombre}</a>`).join('<br>') || '—';
    const abierto = rep.estado !== 'resuelto';
    const vencido = abierto && rep.fecha_limite && new Date(rep.fecha_limite).getTime() < ahora;
    return `<tr${vencido ? ' style="background:#fef2f2"' : ''}>
      <td><b>#${rep.id}</b></td>
      <td>${f(rep.fecha)}</td>
      <td>${rep.nombre}<br><small>${rep.contacto || ''}</small></td>
      <td>${rep.plataforma}</td>
      <td><span class="badge" style="background:${COLORES[rep.prioridad] || '#64748b'}">${rep.prioridad || 'media'}</span></td>
      <td>${f(rep.fecha_limite)}${vencido ? '<br><b style="color:#dc2626">⚠ VENCIDO</b>' : ''}</td>
      <td>${rep.descripcion}</td>
      <td>${links}</td>
      <td>
        <span class="badge" style="background:${abierto ? '#1b6ca8' : '#16a34a'}">${abierto ? 'abierto' : 'resuelto'}</span><br>
        ${abierto
          ? `<a class="accion" href="/api/panel?key=${req.query.key}&cerrar=${rep.id}"
               onclick="return confirm('¿Marcar #${rep.id} como resuelto? Se enviará correo al usuario.')">✔ Resolver</a>`
          : `<a class="accion" href="/api/panel?key=${req.query.key}&reabrir=${rep.id}">↩ Reabrir</a>`}
      </td></tr>`;
  }).join('');

  const abiertos = reportes.filter(x => x.estado !== 'resuelto').length;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Panel · Effiworks</title><link rel="icon" type="image/jpg" href="/logo.jpg">
<style>
  body { font-family: system-ui, sans-serif; margin:0; background:#eef4f8; }
  .top { background:linear-gradient(90deg,#1b6ca8,#2193b0); color:#fff; padding:16px 24px;
         display:flex; align-items:center; gap:14px; }
  .top img { width:40px; height:40px; background:#fff; border-radius:8px; padding:3px; }
  .top h1 { font-size:1.2rem; margin:0; }
  .cont { padding:24px; }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:12px;
          overflow:hidden; box-shadow:0 2px 10px rgba(15,60,92,.08); }
  th, td { padding:10px 12px; border-bottom:1px solid #e8eef3; text-align:left;
           font-size:.88rem; vertical-align:top; }
  th { background:#0f3c5c; color:#fff; white-space:nowrap; }
  tr:hover { background:#f0f7fc; }
  .badge { display:inline-block; padding:2px 10px; border-radius:99px; font-size:.78rem;
           font-weight:700; color:#fff; }
  .accion { color:#1b6ca8; font-weight:600; text-decoration:none; font-size:.85rem; }
</style></head><body>
<div class="top"><img src="/logo.jpg"><h1>Panel de reportes</h1>
  <span style="margin-left:auto">${abiertos} abiertos / ${reportes.length} totales</span></div>
<div class="cont"><table>
<tr><th>ID</th><th>Fecha</th><th>Usuario</th><th>Plataforma</th><th>Prioridad</th>
<th>Límite SLA</th><th>Descripción</th><th>Adjuntos</th><th>Estado</th></tr>
${filas}</table></div></body></html>`);
}
