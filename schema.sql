-- =============================================
-- SCHEMA: Pacientes App
-- =============================================

-- Tabla de pacientes (datos maestros)
CREATE TABLE pacientes (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  fecha_inicio DATE,
  categoria TEXT,
  moneda TEXT NOT NULL DEFAULT 'PESO',
  valor NUMERIC NOT NULL DEFAULT 0,
  origen TEXT,
  estado TEXT DEFAULT 'Activo',
  dni_banco TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de psicotécnico (catálogo de servicios)
CREATE TABLE tipos_psicotecnico (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL UNIQUE,
  moneda TEXT NOT NULL DEFAULT 'PESO',
  valor NUMERIC NOT NULL DEFAULT 0,
  origen TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registros (log unificado de sesiones y pagos)
CREATE TABLE registros (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  paciente_id BIGINT NOT NULL REFERENCES pacientes(id),
  accion TEXT NOT NULL CHECK (accion IN ('SESION', 'PAGO')),
  valor_sesion NUMERIC,
  valor_pago NUMERIC,
  moneda TEXT,
  origen TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Psicotécnicos (detalle de evaluaciones)
CREATE TABLE psicotecnicos (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT,
  puesto TEXT,
  nombre TEXT NOT NULL,
  fecha_cita DATE,
  fecha_entrega DATE,
  costo NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_registros_fecha ON registros(fecha);
CREATE INDEX idx_registros_paciente ON registros(paciente_id);
CREATE INDEX idx_registros_accion ON registros(accion);
CREATE INDEX idx_psicotecnicos_fecha ON psicotecnicos(fecha_cita);

-- Vista: saldo por paciente (sesiones - pagos)
CREATE VIEW v_saldos AS
SELECT
  p.id,
  p.nombre,
  p.moneda,
  COALESCE(SUM(r.valor_sesion), 0) AS total_sesiones,
  COALESCE(SUM(r.valor_pago), 0) AS total_pagos,
  COALESCE(SUM(r.valor_sesion), 0) - COALESCE(SUM(r.valor_pago), 0) AS saldo
FROM pacientes p
LEFT JOIN registros r ON r.paciente_id = p.id
GROUP BY p.id, p.nombre, p.moneda;

-- Vista: resumen mensual por moneda
CREATE VIEW v_resumen_mensual AS
SELECT
  DATE_TRUNC('month', fecha) AS mes,
  moneda,
  accion,
  COUNT(*) AS cantidad,
  COALESCE(SUM(valor_sesion), 0) AS total_sesiones,
  COALESCE(SUM(valor_pago), 0) AS total_pagos
FROM registros
GROUP BY DATE_TRUNC('month', fecha), moneda, accion
ORDER BY mes DESC, moneda, accion;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_psicotecnico ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE psicotecnicos ENABLE ROW LEVEL SECURITY;

-- Políticas: solo usuarios autenticados pueden acceder
CREATE POLICY "Usuarios autenticados pueden leer pacientes"
  ON pacientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar pacientes"
  ON pacientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar pacientes"
  ON pacientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden eliminar pacientes"
  ON pacientes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden leer tipos_psicotecnico"
  ON tipos_psicotecnico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar tipos_psicotecnico"
  ON tipos_psicotecnico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar tipos_psicotecnico"
  ON tipos_psicotecnico FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden eliminar tipos_psicotecnico"
  ON tipos_psicotecnico FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden leer registros"
  ON registros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar registros"
  ON registros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar registros"
  ON registros FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden eliminar registros"
  ON registros FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden leer psicotecnicos"
  ON psicotecnicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar psicotecnicos"
  ON psicotecnicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar psicotecnicos"
  ON psicotecnicos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden eliminar psicotecnicos"
  ON psicotecnicos FOR DELETE TO authenticated USING (true);
