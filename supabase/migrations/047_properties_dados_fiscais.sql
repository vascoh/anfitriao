-- 047 · Dados fiscais do alojamento para o mapa IRS (B vs F)
--
-- Porquê
-- ------
-- O coeficiente do regime simplificado depende da **modalidade** do AL e de o
-- imóvel estar em **área de contenção** (CIRS art. 31.º, n.º 1, a), c) e h)),
-- e a opção pela categoria F só existe para moradia/apartamento (art. 28.º,
-- n.º 14). 4 % do **VPT** conta como despesa justificada no n.º 13.
--
-- `tipo` não serve: descreve o imóvel para o site (apartamento, moradia,
-- quarto, outro), não a modalidade registada no RNAL — um apartamento pode
-- estar registado como hospedagem, e aí o coeficiente é 0,15 e não 0,35.
--
-- Tudo opcional e sem default de modalidade: um valor adivinhado dava um
-- mapa fiscal errado com ar de certo. A página pede-o quando falta.

alter table public.properties
  add column if not exists al_modalidade text,
  add column if not exists al_area_contencao boolean not null default false,
  add column if not exists vpt numeric(12,2);

alter table public.properties drop constraint if exists properties_al_modalidade_check;
alter table public.properties
  add constraint properties_al_modalidade_check
  check (al_modalidade is null or al_modalidade in ('apartamento','hospedagem','moradia','quartos'));

alter table public.properties drop constraint if exists properties_vpt_check;
alter table public.properties
  add constraint properties_vpt_check check (vpt is null or vpt >= 0);
