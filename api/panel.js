export default async function handler(req, res) {
  if (req.query.key !== process.env.PANEL_KEY)
    return res.status(403).send('<h3>Acceso denegado</h3>');

  const url = process.env.SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE; // solo vive en el servidor

  // Cambiar estado si viene ?toggle=ID
  if (req.query.toggle) {
    const g = await fetch(`${url}/rest/v1/reportes?id=eq.${req.query.toggle}&select=estado`, {
      headers: { apikey: srk, Authorization: `Bearer ${srk}` }
    });
    const [fila] = await g.json();
    const nuevo = fila?.estado === 'abierto' ? 'resuelto' : 'abierto';
    await fetch(`${url}/rest/v1/reportes?id=eq.${req.query.toggle}`, {
      method: 'PATCH',
      headers: { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevo })
    });
    return res.redirect(`/api/panel?key=${req.query.key}`);
  }

  const r = await fetch(`${url}/rest/v1/reportes?select=*&order=id.desc`, {
    headers: { apikey: srk, Authorization: `Bearer ${srk}` }
  });
  const reportes = await r.json();

  const filas = reportes.map(rep => {
    const links = (rep.archivos || [])
      .map(a => `<a href="${a.url}" target="_blank">📎 ${a.nombre}</a>`)
      .join(' ') || '—';
    const color = rep.estado === 'resuelto' ? '#16a34a' : '#dc2626';
    return `<tr>
      <td>#${rep.id}</td>
      <td>${new Date(rep.fecha).toLocaleString('es-MX')}</td>
      <td>${rep.nombre}<br><small>${rep.contacto || ''}</small></td>
      <td>${rep.plataforma}</td>
      <td>${rep.descripcion}</td>
      <td>${links}</td>
      <td><a href="/api/panel?key=${req.query.key}&toggle=${rep.id}"
             style="color:${color};font-weight:700;text-decoration:none">${rep.estado}</a></td>
    </tr>`;
  }).join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Panel · Effiworks</title>
<style>
  body { font-family: system-ui, sans-serif; margin:24px; background:#f4f6f8; }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:8px; overflow:hidden; }
  th, td { padding:10px 12px; border-bottom:1px solid #e5e9ee; text-align:left; font-size:.9rem; vertical-align:top; }
  th { background:#1f2937; color:#fff; }
  tr:hover { background:#f0f4ff; }
</style></head><body>
<h1>📋 Panel de reportes</h1>
<table><tr><th>ID</th><th>Fecha</th><th>Usuario</th><th>Plataforma</th><th>Descripción</th><th>Adjuntos</th><th>Estado</th></tr>
${filas}</table></body></html>`);
}
