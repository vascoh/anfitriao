# Deploy

Detalhe operacional completo (comandos, convenções WSL2): `README.md` e `AGENTS.md` na raiz do projeto — não duplicado aqui.

## Pipeline
```
npm test && npm run typecheck && npm run lint && npm run build   # validação local obrigatória
npx vercel deploy --prod                                          # deploy manual (CLI autenticada)
```
Auto-deploy GitHub→Vercel está desligado deliberadamente (`AGENTS.md`) — nunca esperar por ele.

## Ambientes
| Ambiente | URL | Propósito |
|---|---|---|
| Produção | `anfitrioes.pt` | Cliente real |
| Preview (Vercel) | gerado por deploy não-prod | Validação antes de promover |
| Local | `localhost:3000` (`npm run build && npm start`, não `npm run dev` sob carga em WSL2) | Desenvolvimento |

## CI/CD
GitHub Actions já configurado (testes/lint em PR) — ver `.github/`. Gate de merge: testes + typecheck + lint a zero antes de qualquer deploy manual.

## Rollback
Vercel mantém histórico de deployments — promover um deployment anterior a produção via dashboard ou `vercel rollback` é a via de emergência. Nenhuma migration de base de dados deve ser irreversível sem plano de rollback explícito (down migration ou backup pré-migration).
