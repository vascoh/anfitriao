import type { Metadata } from 'next'
import Link from 'next/link'
import { PaginaLegal } from '@/components/landing-v2/pagina-legal'

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description:
    'Que cookies e armazenamento local o Anfitrião usa. Sem publicidade, sem analítica, sem rastreio de terceiros.',
  alternates: { canonical: '/cookies' },
}

export default function CookiesPage() {
  return (
    <PaginaLegal titulo="Política de Cookies" atualizadoEm="2026-07-29">
      <p>
        O Anfitrião usa o mínimo indispensável para funcionar.{' '}
        <strong>
          Não usamos cookies de publicidade, de analítica nem de rastreio de
          terceiros.
        </strong>{' '}
        Não há Google Analytics, nem píxeis de redes sociais, nem perfis de
        navegação.
      </p>
      <p>
        É por isso que não verás um banner de consentimento: tudo o que
        guardamos é estritamente necessário à prestação do serviço que pediste,
        e para esse fim a lei não exige consentimento prévio.
      </p>

      <h2>O que é guardado</h2>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Para quê</th>
            <th>Duração</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cookies de sessão do Clerk</td>
            <td>Cookie estritamente necessário</td>
            <td>
              Manter-te com sessão iniciada e proteger contra pedidos forjados
            </td>
            <td>Até terminar sessão ou expirar</td>
          </tr>
          <tr>
            <td>
              <code>anf:theme</code>
            </td>
            <td>Armazenamento local</td>
            <td>Lembrar se preferes o tema claro ou escuro</td>
            <td>Até limpares os dados do navegador</td>
          </tr>
        </tbody>
      </table>
      <p>
        O armazenamento local não é enviado para o servidor: fica apenas no teu
        dispositivo.
      </p>

      <h2>Cookies de terceiros</h2>
      <p>
        Ao subscreveres um plano, o pagamento é feito em páginas da Stripe, que
        usa cookies próprios para prevenir fraude. Esse tratamento rege-se pela
        política de privacidade da Stripe.
      </p>

      <h2>Como controlar</h2>
      <p>
        Podes apagar cookies e armazenamento local nas definições do teu
        navegador. Nota que bloquear os cookies de sessão impede o início de
        sessão — sem eles a aplicação não consegue reconhecer-te entre páginas.
      </p>

      <h2>Mais informação</h2>
      <p>
        Sobre o tratamento de dados pessoais em geral, consulta a{' '}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
    </PaginaLegal>
  )
}
