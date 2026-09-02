-- Tabla para el registro compartido de propuestas del equipo comercial.
-- Ejecutar en Supabase → SQL Editor si creas un proyecto nuevo.

create table if not exists public.propuestas (
  id text primary key,
  data jsonb not null,
  ejecutivo text,
  fecha_iso timestamptz,
  saved_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted boolean not null default false
);

create index if not exists propuestas_updated_at_idx on public.propuestas (updated_at desc);
create index if not exists propuestas_deleted_idx on public.propuestas (deleted) where deleted = false;

alter table public.propuestas enable row level security;

drop policy if exists "lectura propuestas" on public.propuestas;
drop policy if exists "insert propuestas" on public.propuestas;
drop policy if exists "update propuestas" on public.propuestas;

create policy "lectura propuestas"
  on public.propuestas for select
  using (deleted = false);

create policy "insert propuestas"
  on public.propuestas for insert
  with check (true);

create policy "update propuestas"
  on public.propuestas for update
  using (true);
