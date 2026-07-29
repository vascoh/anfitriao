import type { Metadata } from 'next'
import Link from 'next/link'
import { PaginaLegal, PorPreencher } from '@/components/landing-v2/pagina-legal'
import { TRIAL_DIAS, PLAN_LIMITS } from '@/lib/planos'

export const metadata: Metadata = {
  title: 'Termos e Condições',
  description:
    'Condições de utilização do Anfitrião: subscrições, período experimental, cancelamento, reembolsos e responsabilidades.',
  alternates: { canonical: '/termos' },
}

export default function TermosPage() {
  return (
    <PaginaLegal titulo="Termos e Condições" atualizadoEm="2026-07-29">
      <p>
        Estes termos regulam a utilização do Anfitrião, plataforma de gestão de
        Alojamento Local disponível em <strong>anfitrioes.pt</strong>, prestada
        por <PorPreencher>denominação social e NIF</PorPreencher>. Ao criar
        conta, aceitas estas condições.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O Anfitrião permite centralizar calendários de várias plataformas,
        gerir reservas e hóspedes, recolher o check-in online e preparar os
        dados do boletim de alojamento, além de relatórios e apoio à
        comunicação com hóspedes.
      </p>

      <h2>2. Conta e utilização</h2>
      <ul>
        <li>
          És responsável por manter as credenciais em segurança e por tudo o que
          for feito através da tua conta.
        </li>
        <li>
          Cada conta destina-se a um titular. Podes gerir vários alojamentos
          dentro dos limites do plano subscrito.
        </li>
        <li>
          Não podes usar o serviço para fins ilícitos, nem tentar aceder a dados
          de outras contas.
        </li>
      </ul>

      <h2>3. Período experimental</h2>
      <p>
        A subscrição começa com {TRIAL_DIAS} dias gratuitos, com acesso às
        funcionalidades do plano escolhido. Não é pedido cartão de crédito para
        iniciar o período experimental.
      </p>

      <h2>4. Planos e pagamento</h2>
      <p>
        Os planos disponíveis, respetivos limites e preços estão indicados na{' '}
        <Link href="/#precos">página de preços</Link>. O plano Starter abrange até{' '}
        {PLAN_LIMITS.starter.propriedades_max} alojamentos e o plano Pro até{' '}
        {PLAN_LIMITS.pro.propriedades_max}. Os preços são apresentados em euros
        e <PorPreencher>com ou sem IVA — indicar</PorPreencher>.
      </p>
      <p>
        A subscrição é mensal ou anual, conforme escolhido, e renova-se
        automaticamente no fim de cada período, até ser cancelada. O pagamento é
        processado pela Stripe.
      </p>

      <h2>5. Cancelamento e reembolso</h2>
      <p>
        Podes cancelar quando quiseres, a partir da tua conta, sem período de
        fidelização. O cancelamento produz efeitos no fim do período já pago,
        mantendo-se o acesso até lá.
      </p>
      <p>
        <strong>Garantia de 30 dias:</strong> tens 30 dias a contar do primeiro
        pagamento para pedir o reembolso total, sem justificação. Basta
        escreveres para{' '}
        <a href="mailto:suporte@anfitrioes.pt">suporte@anfitrioes.pt</a>.
      </p>

      <h2>6. Obrigações legais do anfitrião</h2>
      <p>
        O Anfitrião é uma ferramenta de apoio. A responsabilidade pelo
        cumprimento das obrigações legais do Alojamento Local — incluindo o
        registo dos hóspedes e a comunicação do boletim de alojamento às
        autoridades — é inteiramente tua.
      </p>
      <p>
        Em concreto: a plataforma recolhe os dados do boletim e gera o ficheiro
        pronto a submeter, mas <strong>a submissão final é feita por ti</strong>.
        Não garantimos, por si só, o cumprimento de qualquer prazo legal.
      </p>

      <h2>7. Sincronização com plataformas externas</h2>
      <p>
        A sincronização de calendários com o Airbnb, o Booking.com e outras
        plataformas é feita por iCal, o formato que essas plataformas
        disponibilizam. O iCal <strong>não é instantâneo</strong>: as
        plataformas atualizam os calendários com intervalos que podem ir de
        alguns minutos a várias horas.
      </p>
      <p>
        Isto reduz muito o risco de dupla reserva, mas não o elimina. Não
        respondemos por reservas duplicadas resultantes do atraso de atualização
        das plataformas externas, nem por alterações que estas façam aos seus
        serviços.
      </p>

      <h2>8. Disponibilidade</h2>
      <p>
        Procuramos manter o serviço disponível de forma contínua, mas pode haver
        interrupções para manutenção ou por causas alheias a nós. Não está
        contratado qualquer nível de serviço garantido, salvo acordo escrito em
        contrário.
      </p>

      <h2>9. Responsabilidade</h2>
      <p>
        Na medida permitida por lei, a nossa responsabilidade total perante ti
        está limitada ao valor que tenhas pago pelo serviço nos{' '}
        <PorPreencher>período — normalmente 12 meses</PorPreencher> anteriores
        ao facto que originou o pedido. Nada nestes termos exclui
        responsabilidade que a lei não permita excluir, nem afeta os direitos
        que te assistam como consumidor.
      </p>

      <h2>10. Alterações aos termos</h2>
      <p>
        Podemos alterar estes termos. Se a alteração for significativa, avisamos
        por email com antecedência razoável. Continuar a usar o serviço depois
        disso vale como aceitação.
      </p>

      <h2>11. Lei aplicável</h2>
      <p>
        Aplica-se a lei portuguesa. Para a resolução de litígios de consumo
        podes recorrer a{' '}
        <PorPreencher>entidade de resolução alternativa competente</PorPreencher>.
      </p>

      <h2>12. Contacto</h2>
      <p>
        <a href="mailto:suporte@anfitrioes.pt">suporte@anfitrioes.pt</a>
      </p>
    </PaginaLegal>
  )
}
