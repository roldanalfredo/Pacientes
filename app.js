// =============================================
// CONFIG
// =============================================
const SUPABASE_URL = 'https://newzdjgfwkvuitedehrr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RUM7iqAR_UMjEXzv1jmppw_ARmCkUkF';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================
// STATE
// =============================================
let pacientesCache = [];
let tiposPsicoCache = [];
let regPage = 0;
const REG_PAGE_SIZE = 50;

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  let appLoaded = false;

  // Check session
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    appLoaded = true;
    showApp(session.user);
  }

  // Auth state listener
  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && !appLoaded) {
      appLoaded = true;
      showApp(session.user);
    } else if (event === 'SIGNED_OUT') {
      appLoaded = false;
      showLogin();
    }
  });

  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    showLogin();
  });

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  });

  // Forms
  document.getElementById('form-sesion').addEventListener('submit', handleSesion);
  document.getElementById('form-pago').addEventListener('submit', handlePago);
  document.getElementById('form-psico').addEventListener('submit', handlePsico);
  document.getElementById('form-paciente').addEventListener('submit', handleSavePaciente);

  // Paciente select changes
  document.getElementById('sesion-paciente').addEventListener('change', onSesionPacienteChange);
  document.getElementById('pago-paciente').addEventListener('change', onPagoPacienteChange);
  document.getElementById('psico-tipo').addEventListener('change', onPsicoTipoChange);
  document.getElementById('pago-convertido').addEventListener('change', function() {
    document.getElementById('pago-pesos').classList.toggle('hidden', !this.checked);
  });

  // Pacientes ABM
  document.getElementById('btn-nuevo-paciente').addEventListener('click', () => openPacienteModal());
  document.getElementById('btn-cancelar-paciente').addEventListener('click', closePacienteModal);

  // Editar registro
  document.getElementById('form-edit-registro').addEventListener('submit', handleEditRegistro);
  document.getElementById('btn-cancelar-registro').addEventListener('click', () => {
    document.getElementById('modal-registro').classList.add('hidden');
  });

  // Registros pagination
  document.getElementById('reg-prev').addEventListener('click', () => { regPage--; loadRegistros(); });
  document.getElementById('reg-next').addEventListener('click', () => { regPage++; loadRegistros(); });
  document.getElementById('btn-filtrar-reg').addEventListener('click', () => { regPage = 0; loadRegistros(); });

  // Mirrors init
  initMirrors();

  // ETL
  document.getElementById('btn-procesar-etl').addEventListener('click', procesarETL);
  document.getElementById('btn-cargar-etl').addEventListener('click', cargarETL);

  // ETL Calendar
  const mesAtras = new Date();
  mesAtras.setMonth(mesAtras.getMonth() - 1);
  document.getElementById('cal-desde').value = mesAtras.toISOString().split('T')[0];
  document.getElementById('btn-procesar-cal').addEventListener('click', procesarCalendar);
  document.getElementById('btn-cargar-cal').addEventListener('click', cargarCalendar);

  // Pacientes filtros
  document.getElementById('pac-buscar').addEventListener('input', loadPacientesTable);
  document.getElementById('pac-solo-saldo').addEventListener('change', loadPacientesTable);
  document.getElementById('pac-activo-desde').addEventListener('change', loadPacientesTable);
  document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
    document.getElementById('pac-buscar').value = '';
    document.getElementById('pac-solo-saldo').checked = false;
    document.getElementById('pac-activo-desde').value = '';
    loadPacientesTable();
  });

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('sesion-fecha').value = today;
  document.getElementById('pago-fecha').value = today;
  document.getElementById('psico-fecha-cita').value = today;
});

// =============================================
// AUTH
// =============================================
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = 'Email o contraseña incorrectos';
    errorEl.classList.remove('hidden');
  }
}

function showApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-email').textContent = user.email;
  loadInitialData();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

// =============================================
// DATA LOADING
// =============================================
async function loadInitialData() {
  await Promise.all([loadPacientes(), loadTiposPsico()]);
  populateSelects();
  navigateTo('dashboard');
}

async function loadPacientes() {
  const { data, error } = await db
    .from('pacientes')
    .select('*')
    .order('nombre');
  if (error) { toast('Error cargando pacientes: ' + error.message, 'error'); return; }
  pacientesCache = data || [];
}

async function loadTiposPsico() {
  const { data, error } = await db
    .from('tipos_psicotecnico')
    .select('*')
    .order('tipo');
  if (error) { toast('Error cargando tipos: ' + error.message, 'error'); return; }
  tiposPsicoCache = data || [];
}

function populateSelects() {
  const selects = ['sesion-paciente', 'pago-paciente', 'reg-filtro-paciente'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    const firstOption = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(firstOption);
    pacientesCache.filter(p => p.estado === 'Activo' || id === 'reg-filtro-paciente').forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nombre;
      sel.appendChild(opt);
    });
  });

  // Psico tipos
  const psicoSel = document.getElementById('psico-tipo');
  const firstOpt = psicoSel.options[0];
  psicoSel.innerHTML = '';
  psicoSel.appendChild(firstOpt);
  tiposPsicoCache.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.tipo;
    psicoSel.appendChild(opt);
  });

}

// =============================================
// NAVIGATION
// =============================================
function navigateTo(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('sec-' + section).classList.add('active');
  document.querySelector(`[data-section="${section}"]`).classList.add('active');

  if (section === 'dashboard') loadDashboard();
  if (section === 'pacientes') loadPacientesTable();
  if (section === 'registros') { regPage = 0; loadRegistros(); }
  if (section === 'cargar-sesion') {
    document.getElementById('sesion-fecha').focus();
    loadRegistrosMirror('sec-cargar-sesion');
  }
  if (section === 'cargar-pago') {
    document.getElementById('pago-fecha').focus();
    loadRegistrosMirror('sec-cargar-pago');
  }
  if (section === 'cargar-psico') document.getElementById('psico-tipo').focus();
}

// =============================================
// CARGAR SESIÓN
// =============================================
function onSesionPacienteChange() {
  const id = parseInt(this.value);
  const pac = pacientesCache.find(p => p.id === id);
  document.getElementById('sesion-valor').value = pac ? pac.valor : '';
  document.getElementById('sesion-moneda').value = pac ? pac.moneda : '';
  document.getElementById('sesion-origen').value = pac ? pac.origen : '';
}

async function handleSesion(e) {
  e.preventDefault();
  const pacienteId = parseInt(document.getElementById('sesion-paciente').value);
  const pac = pacientesCache.find(p => p.id === pacienteId);
  if (!pac) { toast('Seleccioná un paciente', 'error'); return; }

  const fecha = document.getElementById('sesion-fecha').value;
  if (!fecha) { toast('Ingresá una fecha', 'error'); return; }

  const { error } = await db.from('registros').insert({
    fecha,
    paciente_id: pacienteId,
    accion: 'SESION',
    valor_sesion: pac.valor,
    moneda: pac.moneda,
    origen: pac.origen,
    observaciones: document.getElementById('sesion-obs').value || null
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  toast('Sesión guardada', 'success');
  invalidateDashboard();
  document.getElementById('form-sesion').reset();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('sesion-fecha').value = today;
  document.getElementById('sesion-valor').value = '';
  document.getElementById('sesion-moneda').value = '';
  document.getElementById('sesion-origen').value = '';
  loadRegistrosMirror('sec-cargar-sesion');
  document.getElementById('sesion-fecha').focus();
}

// =============================================
// CARGAR PAGO
// =============================================
function onPagoPacienteChange() {
  const id = parseInt(this.value);
  const pac = pacientesCache.find(p => p.id === id);
  document.getElementById('pago-valor-sesion').value = pac ? pac.valor : '';
  document.getElementById('pago-moneda').value = pac ? pac.moneda : '';
  document.getElementById('pago-origen').value = pac ? pac.origen : '';
  // Mostrar opción de conversión solo para pacientes en dólares
  const convGroup = document.getElementById('pago-conv-group');
  if (pac && pac.moneda === 'DÓLAR') {
    convGroup.classList.remove('hidden');
  } else {
    convGroup.classList.add('hidden');
    document.getElementById('pago-convertido').checked = false;
    document.getElementById('pago-pesos').classList.add('hidden');
  }
}

async function handlePago(e) {
  e.preventDefault();
  const pacienteId = parseInt(document.getElementById('pago-paciente').value);
  const pac = pacientesCache.find(p => p.id === pacienteId);
  if (!pac) { toast('Seleccioná un paciente', 'error'); return; }

  const fecha = document.getElementById('pago-fecha').value;
  if (!fecha) { toast('Ingresá una fecha', 'error'); return; }

  const monto = parseFloat(document.getElementById('pago-monto').value);
  if (isNaN(monto) || monto <= 0) { toast('Ingresá un monto válido', 'error'); return; }

  const registro = {
    fecha,
    paciente_id: pacienteId,
    accion: 'PAGO',
    valor_pago: monto,
    moneda: pac.moneda,
    origen: pac.origen,
    observaciones: document.getElementById('pago-obs').value || null
  };

  // Si es pago en dólares recibido en pesos
  if (pac.moneda === 'DÓLAR' && document.getElementById('pago-convertido').checked) {
    const pesos = parseFloat(document.getElementById('pago-pesos').value);
    if (isNaN(pesos) || pesos <= 0) { toast('Ingresá el monto en pesos recibido', 'error'); return; }
    registro.pesos_recibidos = pesos;
  }

  const { error } = await db.from('registros').insert(registro);

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  toast('Pago guardado', 'success');
  invalidateDashboard();
  document.getElementById('form-pago').reset();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('pago-fecha').value = today;
  document.getElementById('pago-valor-sesion').value = '';
  document.getElementById('pago-moneda').value = '';
  document.getElementById('pago-origen').value = '';
  loadRegistrosMirror('sec-cargar-pago');
  document.getElementById('pago-fecha').focus();
}

// =============================================
// CARGAR PSICOTÉCNICO
// =============================================
function onPsicoTipoChange() {
  const id = parseInt(this.value);
  const tipo = tiposPsicoCache.find(t => t.id === id);
  document.getElementById('psico-valor').value = tipo ? tipo.valor : '';
  document.getElementById('psico-moneda').value = tipo ? tipo.moneda : '';
}

async function handlePsico(e) {
  e.preventDefault();
  const tipoId = parseInt(document.getElementById('psico-tipo').value);
  const tipo = tiposPsicoCache.find(t => t.id === tipoId);
  if (!tipo) { toast('Seleccioná un tipo', 'error'); return; }

  const nombre = document.getElementById('psico-nombre').value.trim();
  if (!nombre) { toast('Ingresá el nombre del evaluado', 'error'); return; }

  const fechaCita = document.getElementById('psico-fecha-cita').value;
  if (!fechaCita) { toast('Ingresá la fecha de cita', 'error'); return; }

  const fechaEntrega = document.getElementById('psico-fecha-entrega').value || null;

  // Guardar psicotécnico
  const { error: errPsico } = await db.from('psicotecnicos').insert({
    tipo: tipo.tipo,
    puesto: document.getElementById('psico-puesto').value || null,
    nombre,
    fecha_cita: fechaCita,
    fecha_entrega: fechaEntrega,
    costo: tipo.valor
  });

  if (errPsico) { toast('Error: ' + errPsico.message, 'error'); return; }

  // También guardar en registros como SESION (como en el Excel original)
  // Buscar si existe un paciente genérico para psicotécnicos, si no usar el nombre
  const { error: errReg } = await db.from('registros').insert({
    fecha: fechaCita,
    paciente_id: await getOrCreatePacientePsico(nombre, tipo),
    accion: 'SESION',
    valor_sesion: tipo.valor,
    moneda: tipo.moneda,
    origen: tipo.origen,
    observaciones: document.getElementById('psico-obs').value || `Psicotécnico: ${tipo.tipo} - ${nombre}`
  });

  if (errReg) { toast('Psicotécnico guardado, pero error en registro: ' + errReg.message, 'warning'); return; }

  toast('Psicotécnico guardado', 'success');
  invalidateDashboard();
  document.getElementById('form-psico').reset();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('psico-fecha-cita').value = today;
  document.getElementById('psico-valor').value = '';
  document.getElementById('psico-moneda').value = '';
}

async function getOrCreatePacientePsico(nombre, tipo) {
  // Look for existing paciente with this name
  let pac = pacientesCache.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
  if (pac) return pac.id;

  // Create a temporary paciente for the psicotécnico
  const { data, error } = await db.from('pacientes').insert({
    nombre,
    moneda: tipo.moneda,
    valor: tipo.valor,
    origen: tipo.origen,
    estado: 'Psicotécnico'
  }).select().single();

  if (error) throw error;
  pacientesCache.push(data);
  return data.id;
}

// =============================================
// ABM PACIENTES
// =============================================
async function loadPacientesTable() {
  await loadPacientes();

  // Cargar saldos
  const { data: saldos } = await db.from('v_saldos').select('*');
  const saldoMap = {};
  (saldos || []).forEach(s => { saldoMap[s.id] = s.saldo; });

  // Filtro "activo desde": buscar IDs de pacientes con movimientos desde esa fecha
  const activoDesde = document.getElementById('pac-activo-desde').value;
  let activoIds = null;
  if (activoDesde) {
    const desde = activoDesde + '-01';
    const { data: activos } = await db
      .from('registros')
      .select('paciente_id')
      .gte('fecha', desde);
    activoIds = new Set((activos || []).map(r => r.paciente_id));
  }

  const soloSaldo = document.getElementById('pac-solo-saldo').checked;
  const buscar = document.getElementById('pac-buscar').value.toLowerCase().trim();

  let filtered = pacientesCache;
  if (buscar) {
    filtered = filtered.filter(p => p.nombre.toLowerCase().includes(buscar));
  }
  if (soloSaldo) {
    filtered = filtered.filter(p => (saldoMap[p.id] || 0) !== 0);
  }
  if (activoIds) {
    filtered = filtered.filter(p => activoIds.has(p.id));
  }

  const tbody = document.querySelector('#tabla-pacientes tbody');
  tbody.innerHTML = '';

  filtered.forEach(p => {
    const saldo = saldoMap[p.id] || 0;
    const saldoClass = saldo > 0 ? 'saldo-positivo' : saldo < 0 ? 'saldo-negativo' : 'saldo-cero';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(p.nombre)}</td>
      <td>${esc(p.moneda)}</td>
      <td>${formatNum(p.valor)}</td>
      <td>${esc(p.origen || '')}</td>
      <td class="${saldoClass}">${formatNum(saldo)}</td>
      <td>
        <button class="btn-edit" onclick="editPaciente(${p.id})">Editar</button>
        <button class="btn-danger" onclick="deletePaciente(${p.id}, '${esc(p.nombre)}')">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Mostrar cantidad
  document.querySelector('#sec-pacientes h2').textContent = `Pacientes (${filtered.length})`;
}

function openPacienteModal(paciente = null) {
  document.getElementById('modal-paciente').classList.remove('hidden');
  document.getElementById('modal-paciente-title').textContent = paciente ? 'Editar Paciente' : 'Nuevo Paciente';

  if (paciente) {
    document.getElementById('pac-id').value = paciente.id;
    document.getElementById('pac-nombre').value = paciente.nombre;
    document.getElementById('pac-moneda').value = paciente.moneda;
    document.getElementById('pac-valor').value = paciente.valor;
    document.getElementById('pac-origen').value = paciente.origen || '';
    document.getElementById('pac-estado').value = paciente.estado || 'Activo';
    document.getElementById('pac-dni').value = paciente.dni_banco || '';
    document.getElementById('pac-fecha-inicio').value = paciente.fecha_inicio || '';
  } else {
    document.getElementById('form-paciente').reset();
    document.getElementById('pac-id').value = '';
  }
}

function closePacienteModal() {
  document.getElementById('modal-paciente').classList.add('hidden');
}

window.editPaciente = function(id) {
  const pac = pacientesCache.find(p => p.id === id);
  if (pac) openPacienteModal(pac);
};

window.editRegistro = async function(id) {
  const { data, error } = await db.from('registros').select('*').eq('id', id).single();
  if (error || !data) { toast('Error cargando registro', 'error'); return; }

  document.getElementById('edit-reg-id').value = data.id;
  document.getElementById('edit-reg-fecha').value = data.fecha;
  document.getElementById('edit-reg-accion').value = data.accion;
  document.getElementById('edit-reg-sesion').value = data.valor_sesion || '';
  document.getElementById('edit-reg-pago').value = data.valor_pago || '';
  document.getElementById('edit-reg-moneda').value = data.moneda || 'PESO';
  document.getElementById('edit-reg-origen').value = data.origen || '';
  document.getElementById('edit-reg-obs').value = data.observaciones || '';
  document.getElementById('edit-reg-pesos-rec').value = data.pesos_recibidos || '';

  // Poblar combo pacientes
  const sel = document.getElementById('edit-reg-paciente');
  sel.innerHTML = '';
  pacientesCache.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nombre;
    if (p.id === data.paciente_id) opt.selected = true;
    sel.appendChild(opt);
  });

  document.getElementById('modal-registro').classList.remove('hidden');
};

async function handleEditRegistro(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('edit-reg-id').value);

  const update = {
    fecha: document.getElementById('edit-reg-fecha').value,
    accion: document.getElementById('edit-reg-accion').value,
    paciente_id: parseInt(document.getElementById('edit-reg-paciente').value),
    valor_sesion: parseFloat(document.getElementById('edit-reg-sesion').value) || null,
    valor_pago: parseFloat(document.getElementById('edit-reg-pago').value) || null,
    moneda: document.getElementById('edit-reg-moneda').value,
    origen: document.getElementById('edit-reg-origen').value || null,
    observaciones: document.getElementById('edit-reg-obs').value || null,
    pesos_recibidos: parseFloat(document.getElementById('edit-reg-pesos-rec').value) || null
  };

  const { error } = await db.from('registros').update(update).eq('id', id);
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  toast('Registro actualizado', 'success');
  invalidateDashboard();
  document.getElementById('modal-registro').classList.add('hidden');
  loadRegistros();
}

window.deleteRegistro = async function(id) {
  if (!confirm('¿Eliminar este registro?')) return;

  const { error } = await db.from('registros').delete().eq('id', id);
  if (error) {
    toast('Error: ' + error.message, 'error');
    return;
  }
  toast('Registro eliminado', 'success');
  invalidateDashboard();
  loadRegistros();
  // Refrescar tablas espejo si están visibles
  const secSesion = document.getElementById('sec-cargar-sesion');
  const secPago = document.getElementById('sec-cargar-pago');
  if (secSesion && secSesion.classList.contains('active')) loadRegistrosMirror('sec-cargar-sesion');
  if (secPago && secPago.classList.contains('active')) loadRegistrosMirror('sec-cargar-pago');
};

window.deletePaciente = async function(id, nombre) {
  // Verificar si tiene registros
  const { count } = await db.from('registros').select('*', { count: 'exact', head: true }).eq('paciente_id', id);

  let msg = `¿Eliminar a ${nombre}?`;
  if (count > 0) {
    msg = `${nombre} tiene ${count} registros asociados. Si lo eliminás, esos registros quedarán sin paciente.\n\n¿Continuar?`;
  }
  if (!confirm(msg)) return;

  const { error } = await db.from('pacientes').delete().eq('id', id);
  if (error) {
    toast('Error: ' + error.message, 'error');
    return;
  }
  toast('Paciente eliminado', 'success');
  await loadPacientes();
  populateSelects();
  loadPacientesTable();
};

async function handleSavePaciente(e) {
  e.preventDefault();
  const id = document.getElementById('pac-id').value;
  const data = {
    nombre: document.getElementById('pac-nombre').value.trim(),
    moneda: document.getElementById('pac-moneda').value,
    valor: parseFloat(document.getElementById('pac-valor').value),
    origen: document.getElementById('pac-origen').value.trim() || null,
    estado: document.getElementById('pac-estado').value,
    dni_banco: document.getElementById('pac-dni').value.trim() || null,
    fecha_inicio: document.getElementById('pac-fecha-inicio').value || null
  };

  let error;
  if (id) {
    ({ error } = await db.from('pacientes').update(data).eq('id', parseInt(id)));
  } else {
    ({ error } = await db.from('pacientes').insert(data));
  }

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  toast(id ? 'Paciente actualizado' : 'Paciente creado', 'success');
  closePacienteModal();
  await loadPacientes();
  populateSelects();
  loadPacientesTable();
}

// =============================================
// REGISTROS
// =============================================
async function loadRegistros() {
  let query = db
    .from('registros')
    .select('*, pacientes(nombre)', { count: 'exact' })
    .order('fecha', { ascending: false })
    .range(regPage * REG_PAGE_SIZE, (regPage + 1) * REG_PAGE_SIZE - 1);

  const accion = document.getElementById('reg-filtro-accion').value;
  if (accion) query = query.eq('accion', accion);

  const pacId = document.getElementById('reg-filtro-paciente').value;
  if (pacId) query = query.eq('paciente_id', parseInt(pacId));

  const mes = document.getElementById('reg-filtro-mes').value;
  if (mes) {
    const start = mes + '-01';
    const endDate = new Date(parseInt(mes.split('-')[0]), parseInt(mes.split('-')[1]), 0);
    const end = endDate.toISOString().split('T')[0];
    query = query.gte('fecha', start).lte('fecha', end);
  }

  const { data, count, error } = await query;
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  // Saldo: acumulado si hay paciente filtrado, total si no
  let saldoMap = {};
  let acumulados = null;

  if (pacId) {
    // Traer TODOS los registros del paciente ordenados por fecha ASC para calcular acumulado
    const { data: allReg } = await db.from('registros')
      .select('id, fecha, valor_sesion, valor_pago')
      .eq('paciente_id', parseInt(pacId))
      .order('fecha', { ascending: true })
      .order('id', { ascending: true });
    acumulados = {};
    let running = 0;
    (allReg || []).forEach(r => {
      running += (r.valor_sesion || 0) - (r.valor_pago || 0);
      acumulados[r.id] = running;
    });
  } else {
    const { data: saldosData } = await db.from('v_saldos').select('id, saldo');
    (saldosData || []).forEach(s => { saldoMap[s.id] = s.saldo; });
  }

  const tbody = document.querySelector('#tabla-registros tbody');
  tbody.innerHTML = '';

  (data || []).forEach(r => {
    const tr = document.createElement('tr');
    const dolarClass = r.moneda === 'DÓLAR' ? ' class="cel-dolar"' : '';
    const saldo = acumulados ? acumulados[r.id] : saldoMap[r.paciente_id];
    const saldoClass = saldo > 0 ? 'color:var(--danger)' : saldo < 0 ? 'color:var(--success)' : '';
    tr.innerHTML = `
      <td>${formatDate(r.fecha)}</td>
      <td>${esc(r.pacientes?.nombre || '?')}</td>
      <td>${esc(r.accion)}</td>
      <td${dolarClass}>${r.valor_sesion ? formatNum(r.valor_sesion) : ''}</td>
      <td${dolarClass}>${r.valor_pago ? formatNum(r.valor_pago) : ''}</td>
      <td>${r.pesos_recibidos ? formatNum(r.pesos_recibidos) : ''}</td>
      <td${dolarClass}>${esc(r.moneda || '')}</td>
      <td>${esc(r.origen || '')}</td>
      <td style="${saldoClass}">${saldo != null ? formatNum(saldo) : ''}</td>
      <td>${esc(r.observaciones || '')}</td>
      <td><button class="btn-edit" onclick="editRegistro(${r.id})">✎</button> <button class="btn-danger" onclick="deleteRegistro(${r.id})">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  const totalPages = Math.ceil((count || 0) / REG_PAGE_SIZE);
  document.getElementById('reg-page-info').textContent = `Página ${regPage + 1} de ${totalPages || 1}`;
  document.getElementById('reg-prev').disabled = regPage === 0;
  document.getElementById('reg-next').disabled = regPage >= totalPages - 1;
  document.getElementById('registros-count').textContent = `${count || 0} registros encontrados`;
}

// =============================================
// DASHBOARD
// =============================================
let pivotData = [];
let dashboardDirty = true;
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

function invalidateDashboard() { dashboardDirty = true; }

async function loadDashboard() {
  if (!dashboardDirty) return;
  await Promise.all([loadPivotData(), loadDashboardCards()]);
  dashboardDirty = false;
}

async function loadDashboardCards() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const mesDesde = `${y}-${String(m).padStart(2,'0')}-01`;
  const mesHasta = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;

  const fmt = n => Math.abs(n).toLocaleString('es-AR');

  // Pacientes activos (con registros en los últimos 3 meses)
  const hace3m = new Date(y, now.getMonth() - 3, 1).toISOString().slice(0,10);
  const { data: activos } = await db
    .from('registros')
    .select('paciente_id')
    .gte('fecha', hace3m);
  document.getElementById('stat-activos').textContent =
    new Set((activos || []).map(r => r.paciente_id)).size;

  // Facturado este mes (sum valor_sesion)
  const { data: sesiones } = await db
    .from('registros')
    .select('valor_sesion, moneda')
    .gte('fecha', mesDesde)
    .lt('fecha', mesHasta)
    .gt('valor_sesion', 0);
  const factPesos = (sesiones || []).filter(r => r.moneda === 'PESO')
    .reduce((s, r) => s + (r.valor_sesion || 0), 0);
  const factUsd = (sesiones || []).filter(r => r.moneda === 'DÓLAR')
    .reduce((s, r) => s + (r.valor_sesion || 0), 0);
  document.getElementById('stat-fact-pesos').textContent = '$ ' + fmt(factPesos);
  document.getElementById('stat-fact-usd').textContent = 'US$ ' + fmt(factUsd);

  // Cobrado este mes (sum valor_pago + pesos_recibidos de conversiones USD)
  const { data: pagos } = await db
    .from('registros')
    .select('valor_pago, moneda, pesos_recibidos')
    .gte('fecha', mesDesde)
    .lt('fecha', mesHasta)
    .gt('valor_pago', 0);
  const cobrPesos = (pagos || []).filter(r => r.moneda === 'PESO')
    .reduce((s, r) => s + (r.valor_pago || 0), 0);
  const cobrPesosConversion = (pagos || []).filter(r => r.pesos_recibidos)
    .reduce((s, r) => s + (r.pesos_recibidos || 0), 0);
  const cobrUsd = (pagos || []).filter(r => r.moneda === 'DÓLAR')
    .reduce((s, r) => s + (r.valor_pago || 0), 0);
  document.getElementById('stat-cobr-pesos').textContent = '$ ' + fmt(cobrPesos + cobrPesosConversion);
  document.getElementById('stat-cobr-usd').textContent = 'US$ ' + fmt(cobrUsd);

  // Saldo pendiente total (separado por moneda)
  const { data: saldos } = await db.from('v_saldos').select('saldo, moneda, nombre');
  const saldoPesos = (saldos || []).filter(r => r.moneda === 'PESO' && r.nombre.toLowerCase() !== 'cobros en dolares')
    .reduce((s, r) => s + (r.saldo || 0), 0);
  const saldoUsd = (saldos || []).filter(r => r.moneda === 'DÓLAR')
    .reduce((s, r) => s + (r.saldo || 0), 0);

  const elSP = document.getElementById('stat-saldo-pesos');
  elSP.textContent = '$ ' + fmt(saldoPesos);
  elSP.style.color = saldoPesos > 0 ? 'var(--danger)' : saldoPesos < 0 ? 'var(--success)' : '';

  const elSU = document.getElementById('stat-saldo-usd');
  elSU.textContent = 'US$ ' + fmt(saldoUsd);
  elSU.style.color = saldoUsd > 0 ? 'var(--danger)' : saldoUsd < 0 ? 'var(--success)' : '';
}

async function loadPivotData() {
  const { data, error } = await db.rpc('get_pivot_data');
  if (error) { toast('Error cargando pivot: ' + error.message, 'error'); return; }
  pivotData = data || [];

  // Filtros para cada tabla
  const pesos = pivotData.filter(r => r.moneda === 'PESO');
  const dolares = pivotData.filter(r => r.moneda === 'DÓLAR');
  const psico = pivotData.filter(r => r.is_psico);
  const freelance = pivotData.filter(r => r.origen === 'Free lance');
  const total = pivotData;

  renderPivotTable('pivot-pesos', pesos);
  renderPivotTable('pivot-dolares', dolares);
  renderPivotTable('pivot-psico', psico);
  renderPivotTable('pivot-freelance', freelance);
  renderPivotTable('pivot-total', total);

  // Frankie: buscar por nombre y cargar su pivot individual
  const frankie = pacientesCache.find(p => p.nombre.toLowerCase().includes('frankie'));
  if (frankie) {
    const { data: frankieData } = await db
      .from('registros')
      .select('fecha, accion, valor_sesion, valor_pago')
      .eq('paciente_id', frankie.id);

    const grouped = [];
    const byKey = {};
    (frankieData || []).forEach(r => {
      const d = new Date(r.fecha);
      const anio = d.getFullYear();
      const mes = d.getMonth() + 1;
      const key = `${anio}-${mes}`;
      if (!byKey[key]) {
        byKey[key] = { anio, mes, cnt_sesiones: 0, sum_importe: 0, sum_pagos: 0 };
        grouped.push(byKey[key]);
      }
      if (r.accion === 'SESION') {
        byKey[key].cnt_sesiones++;
        byKey[key].sum_importe += Number(r.valor_sesion) || 0;
      }
      if (r.accion === 'PAGO') {
        byKey[key].sum_pagos += Number(r.valor_pago) || 0;
      }
    });
    renderPivotTable('pivot-frankie', grouped);
  }
}

function aggregatePivot(data) {
  // Agrupar por año y mes
  const byYear = {};
  data.forEach(r => {
    if (!byYear[r.anio]) byYear[r.anio] = {};
    if (!byYear[r.anio][r.mes]) byYear[r.anio][r.mes] = { sesiones: 0, importe: 0, pagos: 0 };
    byYear[r.anio][r.mes].sesiones += Number(r.cnt_sesiones) || 0;
    byYear[r.anio][r.mes].importe += Number(r.sum_importe) || 0;
    byYear[r.anio][r.mes].pagos += Number(r.sum_pagos) || 0;
  });

  // Calcular totales por año
  const result = {};
  for (const year in byYear) {
    const yearTotal = { sesiones: 0, importe: 0, pagos: 0 };
    for (const month in byYear[year]) {
      yearTotal.sesiones += byYear[year][month].sesiones;
      yearTotal.importe += byYear[year][month].importe;
      yearTotal.pagos += byYear[year][month].pagos;
    }
    result[year] = { total: yearTotal, months: byYear[year] };
  }
  return result;
}

function renderPivotTable(containerId, data) {
  const container = document.getElementById(containerId);
  const tbody = container.querySelector('tbody');
  tbody.innerHTML = '';

  const aggregated = aggregatePivot(data);
  const years = Object.keys(aggregated).sort((a, b) => Number(a) - Number(b));
  const currentYear = new Date().getFullYear();

  years.forEach(year => {
    const yearData = aggregated[year];
    const isExpanded = Number(year) === currentYear;

    // Fila del año (colapsable)
    const yearTr = document.createElement('tr');
    yearTr.className = 'pivot-year-row';
    yearTr.dataset.year = year;
    yearTr.innerHTML = `
      <td class="pivot-year-label"><span class="pivot-toggle">${isExpanded ? '▼' : '▶'}</span> ${year}</td>
      <td class="pivot-num">${formatNum(yearData.total.sesiones)}</td>
      <td class="pivot-num">${formatNum(yearData.total.importe)}</td>
      <td class="pivot-num">${formatNum(yearData.total.pagos)}</td>
    `;
    yearTr.addEventListener('click', () => toggleYear(containerId, year));
    tbody.appendChild(yearTr);

    // Filas de meses
    const months = Object.keys(yearData.months).sort((a, b) => Number(a) - Number(b));
    months.forEach(month => {
      const m = yearData.months[month];
      const monthTr = document.createElement('tr');
      monthTr.className = `pivot-month-row month-of-${year}`;
      if (!isExpanded) monthTr.style.display = 'none';
      monthTr.innerHTML = `
        <td class="pivot-month-label">${MONTH_NAMES[Number(month) - 1]}</td>
        <td class="pivot-num">${formatNum(m.sesiones)}</td>
        <td class="pivot-num">${formatNum(m.importe)}</td>
        <td class="pivot-num">${formatNum(m.pagos)}</td>
      `;
      tbody.appendChild(monthTr);
    });
  });
}

function toggleYear(containerId, year) {
  const container = document.getElementById(containerId);
  const monthRows = container.querySelectorAll(`.month-of-${year}`);
  const yearRow = container.querySelector(`[data-year="${year}"]`);
  const toggle = yearRow.querySelector('.pivot-toggle');

  const isVisible = monthRows[0] && monthRows[0].style.display !== 'none';
  monthRows.forEach(row => row.style.display = isVisible ? 'none' : '');
  toggle.textContent = isVisible ? '▶' : '▼';
}

// =============================================
// REGISTROS MIRROR (bajo formularios de carga)
// =============================================
const mirrorPages = {};

function initMirrors() {
  document.querySelectorAll('.btn-filtrar-mirror').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.section').id;
      mirrorPages[section] = 0;
      loadRegistrosMirror(section);
    });
  });
  document.querySelectorAll('.reg-prev-mirror').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.section').id;
      mirrorPages[section] = (mirrorPages[section] || 0) - 1;
      loadRegistrosMirror(section);
    });
  });
  document.querySelectorAll('.reg-next-mirror').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.section').id;
      mirrorPages[section] = (mirrorPages[section] || 0) + 1;
      loadRegistrosMirror(section);
    });
  });
}

async function loadRegistrosMirror(sectionId) {
  const section = document.getElementById(sectionId);
  const page = mirrorPages[sectionId] || 0;

  let query = db
    .from('registros')
    .select('*, pacientes(nombre)', { count: 'exact' })
    .order('fecha', { ascending: false })
    .range(page * REG_PAGE_SIZE, (page + 1) * REG_PAGE_SIZE - 1);

  const accion = section.querySelector('.reg-filtro-accion-mirror')?.value;
  if (accion) query = query.eq('accion', accion);

  const pacId = section.querySelector('.reg-filtro-paciente-mirror')?.value;
  if (pacId) query = query.eq('paciente_id', parseInt(pacId));

  const mes = section.querySelector('.reg-filtro-mes-mirror')?.value;
  if (mes) {
    const start = mes + '-01';
    const endDate = new Date(parseInt(mes.split('-')[0]), parseInt(mes.split('-')[1]), 0);
    const end = endDate.toISOString().split('T')[0];
    query = query.gte('fecha', start).lte('fecha', end);
  }

  const { data, count, error } = await query;
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  const tbody = section.querySelector('.tabla-registros-mirror tbody');
  tbody.innerHTML = '';

  (data || []).forEach(r => {
    const tr = document.createElement('tr');
    const dolarClass = r.moneda === 'DÓLAR' ? ' class="cel-dolar"' : '';
    tr.innerHTML = `
      <td>${formatDate(r.fecha)}</td>
      <td>${esc(r.pacientes?.nombre || '?')}</td>
      <td>${esc(r.accion)}</td>
      <td${dolarClass}>${r.valor_sesion ? formatNum(r.valor_sesion) : ''}</td>
      <td${dolarClass}>${r.valor_pago ? formatNum(r.valor_pago) : ''}</td>
      <td>${r.pesos_recibidos ? formatNum(r.pesos_recibidos) : ''}</td>
      <td${dolarClass}>${esc(r.moneda || '')}</td>
      <td>${esc(r.origen || '')}</td>
      <td>${esc(r.observaciones || '')}</td>
      <td><button class="btn-edit" onclick="editRegistro(${r.id})">✎</button> <button class="btn-danger" onclick="deleteRegistro(${r.id})">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  const totalPages = Math.ceil((count || 0) / REG_PAGE_SIZE);
  const pageInfo = section.querySelector('.reg-page-info-mirror');
  pageInfo.textContent = `Página ${page + 1} de ${totalPages || 1}`;
  section.querySelector('.reg-prev-mirror').disabled = page === 0;
  section.querySelector('.reg-next-mirror').disabled = page >= totalPages - 1;

  // Poblar combo de pacientes si está vacío
  const pacSelect = section.querySelector('.reg-filtro-paciente-mirror');
  if (pacSelect.options.length <= 1) {
    pacientesCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nombre;
      pacSelect.appendChild(opt);
    });
  }
}

// =============================================
// ETL BANCARIO
// =============================================
async function procesarETL() {
  const fileInput = document.getElementById('etl-file');
  if (!fileInput.files || !fileInput.files[0]) { toast('Seleccioná un archivo Excel', 'error'); return; }

  const file = fileInput.files[0];
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Leer filas como array de arrays (raw values)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

  const results = [];

  // Buscar fila de encabezado (Fecha, Movimiento, Débito, Crédito)
  let startRow = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const first = String(rows[i][0] || '').toLowerCase();
    if (first === 'fecha') { startRow = i + 1; break; }
  }

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;

    // Columna 0: Fecha (puede ser Date object o string)
    let fecha;
    const raw = row[0];
    if (raw instanceof Date) {
      fecha = raw.toISOString().split('T')[0];
    } else if (typeof raw === 'number') {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(raw);
      fecha = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    } else {
      const dp = String(raw).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!dp) continue;
      fecha = `${dp[3]}-${dp[2].padStart(2, '0')}-${dp[1].padStart(2, '0')}`;
    }

    // Columna 1: Movimiento (texto multilínea en una celda)
    const movimiento = String(row[1] || '');
    if (!movimiento.toUpperCase().includes('TRANSFERENCIA')) continue;

    // Columna 2: Débito, Columna 3: Crédito
    const debito = parseFloat(String(row[2] || '0').replace(/\./g, '').replace(',', '.')) || 0;
    const credito = parseFloat(String(row[3] || '0').replace(/\./g, '').replace(',', '.')) || 0;
    const monto = credito > 0 ? credito : debito;
    if (monto <= 0) continue;

    // Extraer CUIT y nombre del campo Movimiento
    const lineas = movimiento.split('\n').map(l => l.trim()).filter(l => l);
    let cuit = null;
    let nombre = '';

    for (const l of lineas) {
      const cuitMatch = l.match(/^((?:20|23|24|27|30|33|34)\d{9})$/);
      if (cuitMatch) { cuit = cuitMatch[1]; continue; }
      if (!nombre && !l.includes('TRANSFERENCIA') && !l.includes('CREDITO') && !l.match(/^\d/) && l.length > 3) {
        nombre = l;
      }
    }
    // Buscar CUIT inline si no se encontró en línea suelta
    if (!cuit) {
      const cuitInline = movimiento.match(/\b((?:20|23|24|27|30|33|34)\d{9})\b/);
      if (cuitInline) cuit = cuitInline[1];
    }
    if (!nombre) {
      const nameMatch = movimiento.match(/(?:TERCEROS|COELSA)\s+(.+?)\s+\d{11}/);
      if (nameMatch) nombre = nameMatch[1];
    }

    // Buscar paciente por CUIT
    let pac = null;
    if (cuit) {
      pac = pacientesCache.find(p => p.dni_banco && p.dni_banco.toString() === cuit);
    }

    results.push({
      fecha,
      cuit: cuit || '?',
      nombre,
      paciente: pac || null,
      monto,
      moneda: pac ? pac.moneda : 'PESO',
      origen: pac ? pac.origen : '',
      selected: !!pac
    });
  }

  if (results.length === 0) {
    toast('No se encontraron transferencias en el extracto', 'warning');
    return;
  }

  // Verificar duplicados contra registros existentes
  const identified = results.filter(r => r.paciente);
  if (identified.length > 0) {
    const fechas = [...new Set(identified.map(r => r.fecha))];
    const { data: existentes } = await db
      .from('registros')
      .select('fecha, paciente_id, valor_pago')
      .eq('accion', 'PAGO')
      .in('fecha', fechas);

    if (existentes) {
      for (const r of results) {
        if (!r.paciente) continue;
        const dup = existentes.find(e =>
          e.fecha === r.fecha &&
          e.paciente_id === r.paciente.id &&
          Number(e.valor_pago) === r.monto
        );
        if (dup) {
          r.duplicado = true;
          r.selected = false;
        }
      }
    }
  }

  // Mostrar resultados
  document.getElementById('etl-results').classList.remove('hidden');
  const tbody = document.querySelector('#tabla-etl tbody');
  tbody.innerHTML = '';

  results.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (r.duplicado) {
      tr.style.background = '#f0d0d0';
    } else if (!r.paciente) {
      tr.style.background = '#fff3cd';
    }
    tr.dataset.index = i;
    let pacienteCell;
    if (r.duplicado) {
      pacienteCell = esc(r.paciente.nombre) + ' <em style="color:#c00">(ya cargado)</em>';
    } else if (r.paciente) {
      pacienteCell = esc(r.paciente.nombre);
    } else {
      const options = pacientesCache.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');
      pacienteCell = `<select class="etl-pac-select" data-index="${i}" onchange="asignarPacienteETL(this)">
        <option value="">-- ${esc(r.nombre || 'Asignar')} --</option>${options}</select>`;
    }
    tr.innerHTML = `
      <td><input type="checkbox" class="etl-check" data-index="${i}" ${r.selected ? 'checked' : ''}></td>
      <td>${formatDate(r.fecha)}</td>
      <td>${esc(r.cuit)}</td>
      <td>${pacienteCell}</td>
      <td>${formatNum(r.monto)}</td>
      <td>${esc(r.moneda)}</td>
      <td><button class="btn-danger" onclick="removeETLRow(this)">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  window._etlResults = results;
  const dups = results.filter(r => r.duplicado).length;
  const ident = results.filter(r => r.paciente && !r.duplicado).length;
  toast(`${results.length} transferencias: ${ident} identificadas${dups ? `, ${dups} ya cargadas` : ''}`, 'success');
}

window.removeETLRow = function(btn) {
  const tr = btn.closest('tr');
  tr.remove();
};

window.asignarPacienteETL = async function(select) {
  const idx = parseInt(select.dataset.index);
  const pacId = parseInt(select.value);
  const r = window._etlResults[idx];
  if (!pacId || !r) return;

  const pac = pacientesCache.find(p => p.id === pacId);
  if (!pac) return;

  // Asignar paciente al resultado
  r.paciente = pac;
  r.moneda = pac.moneda;
  r.origen = pac.origen;
  r.selected = true;

  // Marcar checkbox
  const tr = select.closest('tr');
  tr.style.background = '';
  tr.querySelector('.etl-check').checked = true;

  // Guardar CUIT en el paciente para la próxima vez
  if (r.cuit && r.cuit !== '?') {
    const { error } = await db.from('pacientes').update({ dni_banco: r.cuit }).eq('id', pacId);
    if (!error) {
      pac.dni_banco = r.cuit;
      toast(`CUIT ${r.cuit} guardado para ${pac.nombre}`, 'success');
    }
  }
};

async function cargarETL() {
  const results = window._etlResults;
  if (!results) return;

  const checks = document.querySelectorAll('.etl-check:checked');
  if (checks.length === 0) { toast('Seleccioná al menos un pago', 'warning'); return; }

  let ok = 0, fail = 0;

  for (const check of checks) {
    const r = results[parseInt(check.dataset.index)];
    if (!r.paciente) continue;

    const { error } = await db.from('registros').insert({
      fecha: r.fecha,
      paciente_id: r.paciente.id,
      accion: 'PAGO',
      valor_pago: r.monto,
      moneda: r.moneda,
      origen: r.origen,
      observaciones: 'ETL Bancario - CUIT: ' + r.cuit
    });

    if (error) fail++;
    else ok++;
  }

  toast(`${ok} pagos cargados${fail ? `, ${fail} con error` : ''}`, fail ? 'warning' : 'success');
  invalidateDashboard();
  document.getElementById('etl-results').classList.add('hidden');
  document.getElementById('etl-file').value = '';
}

// =============================================
// ETL CALENDAR
// =============================================

function parseICS(text) {
  const events = [];
  const lines = text.replace(/\r\n /g, '').replace(/\r/g, '').split('\n');
  let ev = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') { if (ev) events.push(ev); ev = null; continue; }
    if (!ev) continue;
    if (line.startsWith('SUMMARY:')) ev.summary = line.substring(8);
    if (line.startsWith('DTSTART')) {
      const val = line.split(':').pop();
      // Format: 20221011T170000 or 20221011T170000Z
      ev.date = val.substring(0, 4) + '-' + val.substring(4, 6) + '-' + val.substring(6, 8);
    }
    if (line.startsWith('STATUS:')) ev.status = line.substring(7);
  }
  return events;
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function matchPaciente(summary) {
  const s = normalize(summary);
  // "appointment" events → Frankie
  if (s.startsWith('appointment')) {
    const frankie = pacientesCache.find(p => normalize(p.nombre).includes('frankie'));
    if (frankie) return frankie;
  }
  // Exact match
  let found = pacientesCache.find(p => normalize(p.nombre) === s);
  if (found) return found;
  // Patient name contained in summary
  found = pacientesCache.find(p => s.includes(normalize(p.nombre)));
  if (found) return found;
  // Summary contained in patient name
  found = pacientesCache.find(p => normalize(p.nombre).includes(s));
  if (found) return found;
  return null;
}

async function procesarCalendar() {
  const fileInput = document.getElementById('cal-file');
  const desde = document.getElementById('cal-desde').value;
  if (!fileInput.files.length) { toast('Seleccioná un archivo .ics', 'error'); return; }

  const text = await fileInput.files[0].text();
  const events = parseICS(text);

  // Filter by date and status
  const filtered = events.filter(ev => {
    if (ev.status && ev.status !== 'CONFIRMED') return false;
    if (!ev.date || !ev.summary) return false;
    if (desde && ev.date < desde) return false;
    const hoy = new Date().toISOString().split('T')[0];
    if (ev.date > hoy) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (!filtered.length) { toast('No se encontraron eventos en el período', 'warning'); return; }

  // Check for duplicates
  const { data: existingReg } = await db.from('registros')
    .select('fecha, paciente_id')
    .eq('accion', 'SESION')
    .gte('fecha', desde || '2000-01-01');

  const existingSet = new Set((existingReg || []).map(r => r.fecha + '|' + r.paciente_id));

  const tbody = document.querySelector('#tabla-cal tbody');
  tbody.innerHTML = '';

  const comboOptions = pacientesCache
    .filter(p => !p.nombre.toLowerCase().startsWith('psicotec'))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`)
    .join('');

  const dudosoKeywords = ['turno', 'reunión', 'reunion', 'cumple', 'feriado', 'devolución', 'devolucion',
    'entrevista', 'hacer', 'ver ', 'enviar', 'llamar', 'comprar', 'pagar', 'cobrar', 'supervisión',
    'supervision', 'vacaciones', 'viaje', 'médico', 'medico', 'dentista', 'control', 'guardia'];

  function esDudoso(summary) {
    const s = normalize(summary);
    if (s.split(/\s+/).length > 4) return true;
    if (dudosoKeywords.some(k => s.includes(k))) return true;
    return false;
  }

  let count = 0, dups = 0;
  for (const ev of filtered) {
    const pac = matchPaciente(ev.summary);
    const isDuplicate = pac && existingSet.has(ev.date + '|' + pac.id);
    const dudoso = !pac && esDudoso(ev.summary);

    count++;
    const tr = document.createElement('tr');

    if (isDuplicate) {
      dups++;
      tr.style.background = '#f0d0d0';
      tr.innerHTML = `
        <td></td>
        <td>${formatDate(ev.date)}</td>
        <td>${esc(ev.summary)}</td>
        <td>${esc(pac.nombre)} <em style="color:#c00">(ya cargado)</em></td>
        <td>${formatNum(pac.valor)}</td>
        <td>${esc(pac.moneda)}</td>
        <td>${esc(pac.origen)}</td>
        <td></td>
      `;
    } else {
      const checkedAttr = pac ? 'checked' : '';
      if (dudoso) {
        tr.style.background = '#e0e0e0';
      } else if (!pac) {
        tr.style.background = 'rgb(255, 243, 205)';
      }

      const selectedOption = pac
        ? comboOptions.replace(`value="${pac.id}"`, `value="${pac.id}" selected`)
        : comboOptions;

      tr.innerHTML = `
        <td><input type="checkbox" class="cal-check" ${checkedAttr}></td>
        <td>${formatDate(ev.date)}</td>
        <td>${esc(ev.summary)}${dudoso ? ' <em style="color:#888">(dudoso)</em>' : ''}</td>
        <td><select class="cal-pac-select" onchange="calSelectPaciente(this)">
              <option value="">-- Asignar --</option>${selectedOption}
            </select></td>
        <td>${pac ? formatNum(pac.valor) : ''}</td>
        <td>${pac ? esc(pac.moneda) : ''}</td>
        <td>${pac ? esc(pac.origen) : ''}</td>
        <td><button class="btn-danger" onclick="this.closest('tr').remove()">×</button></td>
      `;
    }
    tr.dataset.fecha = ev.date;
    tr.dataset.pacId = pac ? pac.id : '';
    tr.dataset.summary = ev.summary;
    tbody.appendChild(tr);
  }

  document.getElementById('cal-results').classList.remove('hidden');
  const nuevos = count - dups;
  toast(`${count} eventos: ${nuevos} nuevos${dups ? `, ${dups} ya cargados` : ''}`, 'success');
}

function calSelectPaciente(select) {
  const tr = select.closest('tr');
  const pacId = parseInt(select.value);
  const pac = pacientesCache.find(p => p.id === pacId);
  if (pac) {
    tr.dataset.pacId = pac.id;
    tr.style.background = '';
    tr.querySelector('.cal-check').checked = true;
    // Update value, currency, origin cells
    const cells = tr.querySelectorAll('td');
    cells[4].textContent = formatNum(pac.valor);
    cells[5].textContent = pac.moneda;
    cells[6].textContent = pac.origen;
  }
}

async function cargarCalendar() {
  const rows = document.querySelectorAll('#tabla-cal tbody tr');
  let ok = 0, fail = 0;

  for (const tr of rows) {
    const checked = tr.querySelector('.cal-check');
    if (!checked || !checked.checked) continue;

    const pacId = parseInt(tr.dataset.pacId);
    if (!pacId) { fail++; continue; }

    const pac = pacientesCache.find(p => p.id === pacId);
    if (!pac) { fail++; continue; }

    const { error } = await db.from('registros').insert({
      fecha: tr.dataset.fecha,
      paciente_id: pacId,
      accion: 'SESION',
      valor_sesion: pac.valor,
      moneda: pac.moneda,
      origen: pac.origen,
      observaciones: 'ETL Calendar - ' + tr.dataset.summary
    });

    if (error) fail++;
    else ok++;
  }

  toast(`${ok} sesiones cargadas${fail ? `, ${fail} con error` : ''}`, fail ? 'warning' : 'success');
  invalidateDashboard();
  document.getElementById('cal-results').classList.add('hidden');
  document.getElementById('cal-file').value = '';
}

// =============================================
// UTILS
// =============================================
function esc(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatNum(n) {
  if (n == null) return '';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

function formatDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatMonth(d) {
  if (!d) return '';
  const date = new Date(d);
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}
