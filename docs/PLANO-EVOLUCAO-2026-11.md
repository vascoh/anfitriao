# Plano de evolução — novembro 2026

_Escrito a 2026-11-07. Parte do `TODO.md`, do `DOSSIE-ESTRATEGICO-2026-08.md` e
de uma contagem feita hoje na base de produção._

## Onde estamos

| Medida | Valor (07/11) |
|---|---|
| Contas | 2: a Casa de Vasco (Pro) e uma conta de teste `@example.com` de 09/10 (`user_3KTcP…`, 0 alojamentos) |
| Alojamentos | 4 |
| Reservas | 18 |
| Hóspedes com ficha | 1 |
| Boletins SIBA entregues | **0** |
| Testes automáticos | 1437 a passar |

**Diagnóstico:** o produto tem mais funcionalidade do que uso. SIBA por web
service, faturação, taxa turística de 12 concelhos, mapa fiscal, dossiê ASAE,
limpezas e caixa de entrada estão todos em produção, mas nenhum foi exercido
com um hóspede real do princípio ao fim. O gargalo deixou de ser código. São
quatro ações humanas e uma decisão de posicionamento.

Por isso o plano mete o **uso real** antes de qualquer funcionalidade nova, e
o design trabalha para esse uso: mobile primeiro, provas reais em vez de
ilustrações.

---

## Feito hoje: a marca unificada (TODO 2.3)

- A landing e as páginas legais deixam a paleta própria (slate escuro, ciano,
  esmeralda, Inter) e passam a usar os tokens da app: fundo quente, um só
  acento terracota e Geist, a seguir o tema claro/escuro como o resto do
  produto. O símbolo passa a ser um só componente (`components/marca.tsx`).
- O hero mostra o ecrã «Hoje» em miniatura, que é o primeiro ecrã do
  produto, em vez de uma ilustração abstrata.
- Problema corrigido: todas as secções abaixo do hero vinham do servidor com
  `opacity:0` (`motion` + `whileInView`) e só apareciam depois do JavaScript.
  As animações passaram a CSS, e o `motion` e o `lenis` saíram das dependências.
- **Contraste do modo escuro corrigido na app inteira:** o branco sobre o
  terracota dava cerca de 3,3:1 em todos os botões, e o cinzento secundário
  cerca de 4,1:1. O axe passa agora a zero em `/`, `/termos` e `/vs/*`, nos
  dois temas, no telemóvel e no desktop.
- Copy: «Ver demonstração» (não há vídeo) → «Ver como funciona»;
  «Popular» → «Recomendado» (não há base para «mais escolhido»); «plano
  Enterprise acima de 10» contradizia o plano Empresa; preços em formato
  pt-PT (`19 €`, não `€19`); travessões retirados da copy, como pede o
  `PRODUCT.md`.
- Guarda nova: `landing-v2/marca.test.ts` falha se voltarem paletas soltas,
  `text-white`, hexadecimais ou animação em JS.

---

## Horizonte 1 — duas semanas: pôr o produto a uso real

Objetivo mensurável: **o primeiro boletim SIBA entregue por web service e o
primeiro check-in online de um hóspede real da Casa de Vasco.**

| # | O quê | Quem | Porquê agora |
|---|---|---|---|
| 1 | Credenciais SIBA no portal, modo «Web Service» (H1) | Vasco | 1 a 3 dias úteis de espera, por isso arranca hoje. Validar primeiro em `/bawsdev/` via `SIBA_WS_URL` |
| 2 | Clerk em instância de produção + MFA (0.2, 0.6) | Vasco (painel) + Claude (env) | Tira também o selo «Development mode» do `/sign-in`, a única falha de contraste que resta |
| 3 | Apagar a conta de teste `user_3KTcP…` (linha em `accounts` + utilizador Clerk) | Claude, com confirmação | Polui o funil em `/admin/funil` |
| 4 | Check-in online enviado a cada reserva real do mês | Vasco | Sem fichas não há SIBA, INE nem fatura. É o elo que falta (1 hóspede em 18 reservas) |
| 5 | `SENTRY_DSN` (0.4) | Vasco | Com uso real os erros passam a ter vítimas |
| 6 | Registar tudo o que irrita em `MES-DE-USO-REAL.md` | Vasco | É a fonte do horizonte 2 |

---

## Horizonte 2 — semanas 3 a 6: design para quem usa no telemóvel

> **Estado a 09/11:** 1, 2, 3 e 4 publicados. A pesquisa/ações rápidas
> passou também a folha inferior no telemóvel, fechando o ponto 1. Faltam o 5
> (depende do horizonte 1) e o 6 (decisão).
>
> **16/11:** auditoria a produção com sessão iniciada fechou o que o 3 deixara
> (barra lateral, aviso de check-in em atraso) e corrigiu hidratação no tema
> escuro e 112 rótulos de formulário. Ver `PROGRESS.md`.

Por ordem de impacto no anfitrião com pouco tempo. Cada ponto está pronto a
fazer sem decisões pendentes, exceto quando assinalado.

1. **Sensação de app nativa (U5 do dossiê).** `/hoje` com «puxar para
   atualizar»; folhas inferiores (bottom sheets) em vez de diálogos centrados
   nas ações rápidas; vibração curta (`navigator.vibrate`) ao confirmar
   check-in e entrega SIBA; alvos de toque ≥ 44 px auditados nas listas.
2. **Hierarquia tipográfica (U6).** Fixar uma escala em tokens
   (`--text-display/title/body/caption`) e aplicá-la à app como foi aplicada à
   landing: títulos a 600 com tracking negativo, números sempre `tabular`.
   Mantém-se o Geist. Uma serifada cairia na anti-referência «hotel de luxo».
3. **Modo escuro com identidade (U3).** Os tokens já passam AA; falta passar
   ecrã a ecrã pelos estados (alertas, badges de canal, gráficos do
   financeiro), que ainda usam cores com `dark:` soltas.
4. **Upsell no limite do plano (U7).** Quem cria o 4.º alojamento no Starter
   deve ver «passa para o Pro, 39 €/mês» com um botão, não um erro.
5. **Capturas reais e vídeo de 60 s (2.2).** Quando o horizonte 1 der dados
   reais, trocar a miniatura do hero e o painel ilustrado por capturas da
   Casa de Vasco (anonimizadas). Isto é prova, e prova vende mais do que
   ilustração.
6. **Site público `/r/[slug]` indexável (2.6)**: _decisão do Vasco_. O
   mecanismo está pronto e falta só aprovar o site.

---

## Horizonte 3 — 1 a 3 meses: posicionamento e primeiros clientes

Depende de decisões, não de código:

| Decisão | Opções | Recomendação |
|---|---|---|
| **Posicionamento** (bloqueia preços e copy) | «Tudo por conta» vs «A tua conformidade, com prova» | **Conformidade com prova.** O preço por conta caiu com o TalkGuest (13,50 €/conta); o dossiê ASAE com hash de cada envio é a única vantagem que resistiu a duas verificações de mercado. A landing nova já tem o lugar para isso (cartão «Boletim SIBA entregue · Comprovativo guardado») |
| **Licenciamento Vercel** (0.7) | Hobby (uso não comercial) vs Pro | Pro antes do primeiro cliente pagante, não antes |
| **Domínio** (H5) | `anfitrioes.pt` vs `anfitriao.pt` | Manter `anfitrioes.pt`: tem email, DNS e SEO acumulados |
| **Revisão jurídica** (H6) | Termos, privacidade, garantia de coima | Obrigatória antes de cobrar. As páginas legais estão escondidas do rodapé até lá |

Depois disso:
- **5 anfitriões beta** fora do círculo próximo (H7), com o funil de
  `/admin/funil` como métrica: conta → alojamento → calendário a sincronizar
  → 1.ª reserva → 1.º check-in → 1.º boletim.
- **Trial de 30 dias e grandfathering** (2.1) só depois do posicionamento.
- **Landing v3** centrada na prova: secção com o dossiê ASAE real e a
  frase de posicionamento no H1.

## O que fica de fora de propósito

RBAC/organizações, API pública, mais templates do site, channel manager
por API. Nenhum tem procura confirmada, e todos competem com o horizonte 1
pelo mesmo tempo.
