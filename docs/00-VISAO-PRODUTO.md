# Visão do Produto — Anfitrião

## O que é
PMS + website + reservas diretas para Alojamento Local em Portugal, com compliance SEF/SIBA nativo. Não é um clone de Lodgify/Guesty — compete em simplicidade radical, preço acessível a 1 propriedade e compliance português, não em amplitude de canais.

## Missão
Qualquer proprietário de AL consegue aderir, publicar o site e gerir o negócio diário sem conhecimentos técnicos, em minutos.

## Não-objetivos (deliberados)
- Não somos um website builder livre tipo Wix — templates parametrizados, não drag-and-drop arbitrário (custo/benefício, ver `SAAS_ARCHITECTURE.md` §6).
- Não competimos em amplitude de channel manager com Guesty/Hostaway no curto prazo — APIs oficiais Airbnb/Booking exigem parceria formal (ver `SAAS_ARCHITECTURE.md` §5).
- Não construímos microserviços nem multi-região antes de haver escala que o justifique (ver `SAAS_ARCHITECTURE.md` §11).

## Documento-mãe
A arquitetura técnica e funcional completa vive em [`SAAS_ARCHITECTURE.md`](./SAAS_ARCHITECTURE.md) — este ficheiro e os restantes em `/docs` são vistas focadas por audiência, não repetem o conteúdo.

## Estado
Produto já em produção (`anfitrioes.pt`), multi-tenant, com billing Stripe ativo. Ver `TODO.md` na raiz para o estado fase-a-fase.
