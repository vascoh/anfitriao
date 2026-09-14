# Checklist de Produção

## Bloqueante para abrir a novos clientes (crítico)
- [ ] Clerk JWT template ativo no Supabase (RLS client-side real) — ver `SAAS_ARCHITECTURE.md` §13.1
- [ ] `MAINTENANCE_MODE=false` confirmado em produção
- [ ] Fluxo de onboarding testado ponta-a-ponta em produção (conta nova → propriedade → reserva → check-in)
- [ ] Preços de billing confirmados (Price IDs Stripe vs. página de marketing)
- [ ] Backups automáticos confirmados (Supabase Pro ou plano equivalente)

## Segurança
- [ ] `npm run typecheck && npm run lint` a zero
- [ ] `npm test` a passar em qualquer timezone
- [ ] Advisor de segurança Supabase sem ERROR
- [ ] CSP headers ativos em produção
- [ ] 2FA disponível (Clerk MFA) — pelo menos opcional

## SEO/Performance
- [ ] Lighthouse Performance/SEO/Accessibility/Best Practices > 95
- [x] Sitemap + robots por tenant
- [x] Schema.org `LodgingBusiness` por site
- [x] OG/Twitter Cards dinâmicos (domínio principal)

## Legal/Compliance
- [x] Política de Privacidade, Cookies, Termos publicados no site institucional e nos sites de tenants
- [x] RGPD: exportação/anonimização de dados de hóspedes a pedido
- [ ] SIBA/SEF: exportação validada com um caso real em produção

## Operacional
- [ ] Domínio definitivo decidido (`anfitriao.pt` vs `anfitrioes.pt` — pendência aberta)
- [ ] Plano de suporte ao cliente definido (canal, SLA)
- [ ] `CHANGELOG_PHASE_*.md` e `TODO.md` atualizados
