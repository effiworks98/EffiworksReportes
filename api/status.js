export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { folio, email } = req.body || {};
  if (!folio || !email) return res.status(400).json({ ok: false, error: 'Faltan datos' });

  const url = process.env.SUPABASE_URL, srk = process.env.SUPABASE_SERVICE_ROLE;
  const r = await fetch(
    `${url}/rest/v1/reportes?id=eq.${encodeURIComponent(folio)}&select=id,fecha,plataforma,descripcion,estado,prioridad,fecha_limite,resuelto_en,contacto`,
    { headers: { apikey: srk, Authorization: `Bearer ${srk}` } }
  );
  const [rep] = await r.json();
  if (!rep || rep.contacto?.trim().toLowerCase() !== email.trim().toLowerCase())
    return res.status(404).json({ ok: false, error: 'No se encontró un reporte con ese folio y correo' });

  delete rep.contacto;
  return res.status(200).json({ ok: true, reporte: rep });
}
