-- Estrutura do banco no Supabase (rodar uma vez no SQL Editor)
-- Uma linha por mês (e uma para a meta), do mesmo jeito que o app salva no navegador

create table public.registros (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chave text not null,             -- ex: fluxo_2026_09 ou fluxo_meta
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

-- Trava: cada conta só enxerga e mexe nos próprios dados
alter table public.registros enable row level security;

create policy "ver os meus" on public.registros
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar os meus" on public.registros
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "editar os meus" on public.registros
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "apagar os meus" on public.registros
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Só quem está logado acessa a tabela
revoke all on public.registros from anon;
grant select, insert, update, delete on public.registros to authenticated;
