-- 058 · Índice único duplicado em bookings
--
-- `bookings_uid_externo_idx` foi criado à mão em produção (não há migração que
-- o tenha) e é idêntico ao `bookings_propriedade_uid_externo_uniq` da 055:
-- único em (propriedade_id, uid_externo) where uid_externo is not null.
-- Dois índices iguais duplicam o custo de cada escrita do ical-sync (agora de
-- 15 em 15 minutos) sem proteger nada a mais. Fica o da 055, que está no
-- repositório.

drop index if exists public.bookings_uid_externo_idx;
