// ============================================================
// Reporte diario de Agenda Serrano
// Se ejecuta desde GitHub Actions (ver .github/workflows/daily-report.yml)
// Lee las tareas en Firestore con el SDK de administrador y envía
// un correo con lo pendiente y lo completado, usando Gmail SMTP.
// ============================================================
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function formatDate(ts) {
  if (!ts) return '';
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function taskRow(t, authorName) {
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;">${t.title}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b5b4f;">${t.description || ''}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b5b4f;">${authorName}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b5b4f;">${formatDate(t.createdAt)}</td>
  </tr>`;
}

async function buildReport() {
  const snap = await db.collection('tasks').orderBy('createdAt', 'desc').get();
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const usersSnap = await db.collection('users').get();
  const users = {};
  usersSnap.forEach(u => { users[u.id] = u.data(); });
  const nameOf = (uid) => {
    const u = users[uid];
    return u ? `${u.nombre || ''} ${u.apellidos || ''}`.trim() : 'Alguien';
  };

  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#E4763B,#B23A26);padding:24px;border-radius:12px 12px 0 0;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Agenda Serrano — Reporte diario</h1>
      <p style="color:#fbe4dd;margin:6px 0 0;font-size:13px;">${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
    </div>
    <div style="padding:20px;border:1px solid #eee;border-top:none;">
      <p style="font-size:14px;color:#2b211c;">
        <strong>${pending.length}</strong> tareas pendientes · <strong>${completed.length}</strong> completadas · <strong>${tasks.length}</strong> en total.
      </p>

      <h2 style="font-size:16px;color:#B23A26;margin-top:24px;">Pendientes (${pending.length})</h2>
      ${pending.length ? `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="text-align:left;color:#6b5b4f;">
          <th style="padding:8px 12px;">Tarea</th><th style="padding:8px 12px;">Detalle</th><th style="padding:8px 12px;">Creada por</th><th style="padding:8px 12px;">Fecha</th>
        </tr>
        ${pending.map(t => taskRow(t, nameOf(t.createdBy))).join('')}
      </table>` : `<p style="color:#6b5b4f;font-size:13px;">No hay tareas pendientes. 🎉</p>`}

      <h2 style="font-size:16px;color:#4E7B4F;margin-top:24px;">Completadas / atendidas (${completed.length})</h2>
      ${completed.length ? `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="text-align:left;color:#6b5b4f;">
          <th style="padding:8px 12px;">Tarea</th><th style="padding:8px 12px;">Detalle</th><th style="padding:8px 12px;">Creada por</th><th style="padding:8px 12px;">Fecha</th>
        </tr>
        ${completed.map(t => taskRow(t, nameOf(t.createdBy))).join('')}
      </table>` : `<p style="color:#6b5b4f;font-size:13px;">Todavía no hay tareas completadas.</p>`}

      <p style="font-size:11px;color:#a99b8f;margin-top:28px;">Enviado automáticamente todos los días a las 6:00 a.m. desde Agenda Serrano.</p>
    </div>
  </div>`;

  return { html, pendingCount: pending.length, completedCount: completed.length };
}

async function sendEmail(html, subject) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: `"Agenda Serrano" <${process.env.GMAIL_USER}>`,
    to: process.env.REPORT_TO || 'janser28@gmail.com',
    subject,
    html
  });
}

(async () => {
  try {
    const { html, pendingCount, completedCount } = await buildReport();
    const subject = `Agenda Serrano — ${pendingCount} pendientes / ${completedCount} completadas`;
    await sendEmail(html, subject);
    console.log('Reporte enviado correctamente.');
  } catch (err) {
    console.error('Error enviando el reporte:', err);
    process.exit(1);
  }
})();
