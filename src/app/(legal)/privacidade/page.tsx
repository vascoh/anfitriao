import type { Metadata } from 'next'
import { PaginaLegal, PorPreencher } from '@/components/landing-v2/pagina-legal'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Que dados o Anfitrião recolhe, para quê, com quem os partilha e que direitos tens sobre eles.',
  alternates: { canonical: '/privacidade' },
}

export default function PrivacidadePage() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizadoEm="2026-07-29">
      <p>
        Esta política explica que dados pessoais o Anfitrião trata, com que
        finalidade e durante quanto tempo. Aplica-se à plataforma em{' '}
        <strong>anfitrioes.pt</strong>.
      </p>

      <h2>1. Quem é o responsável pelo tratamento</h2>
      <p>
        O responsável pelo tratamento é{' '}
        <PorPreencher>denominação social</PorPreencher>, com o NIF{' '}
        <PorPreencher>NIF</PorPreencher> e sede em{' '}
        <PorPreencher>morada completa</PorPreencher>.
      </p>
      <p>
        Para qualquer questão sobre dados pessoais, incluindo o exercício dos
        teus direitos, escreve para{' '}
        <a href="mailto:suporte@anfitrioes.pt">suporte@anfitrioes.pt</a>.
      </p>

      <h2>2. Dois papéis diferentes</h2>
      <p>
        É importante distinguir, porque as responsabilidades não são as mesmas:
      </p>
      <ul>
        <li>
          <strong>Quanto aos dados do anfitrião</strong> (quem subscreve o
          serviço), somos <strong>responsáveis pelo tratamento</strong>.
        </li>
        <li>
          <strong>Quanto aos dados dos hóspedes</strong> que o anfitrião
          introduz ou recolhe pelo check-in online, somos{' '}
          <strong>subcontratante</strong>: tratamo-los por conta e segundo as
          instruções do anfitrião, que é o responsável perante os seus hóspedes.
        </li>
      </ul>

      <h2>3. Que dados tratamos</h2>

      <h3>Dados do anfitrião</h3>
      <table>
        <thead>
          <tr>
            <th>Dados</th>
            <th>Finalidade</th>
            <th>Fundamento</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Email, nome, palavra-passe</td>
            <td>Criar e autenticar a conta</td>
            <td>Execução do contrato</td>
          </tr>
          <tr>
            <td>Dados de faturação e subscrição</td>
            <td>Cobrar o serviço e emitir faturas</td>
            <td>Execução do contrato e obrigação legal</td>
          </tr>
          <tr>
            <td>Alojamentos, reservas, receitas e despesas</td>
            <td>Prestar o serviço</td>
            <td>Execução do contrato</td>
          </tr>
          <tr>
            <td>Registos técnicos de acesso</td>
            <td>Segurança e deteção de abuso</td>
            <td>Interesse legítimo</td>
          </tr>
        </tbody>
      </table>

      <h3>Dados dos hóspedes</h3>
      <p>
        Recolhidos pelo anfitrião através do check-in online, correspondem aos
        campos obrigatórios do boletim de alojamento previsto na lei portuguesa:
        nome, data de nascimento, sexo, nacionalidade, tipo e número do documento
        de identificação, data de validade e país de emissão do documento. Pode
        ainda ser guardada uma fotografia do documento, quando o hóspede a
        submete.
      </p>
      <p>
        A finalidade é permitir ao anfitrião cumprir a obrigação legal de
        comunicação às autoridades competentes e gerir a estadia. O fundamento é
        o cumprimento de obrigação legal a que o anfitrião está sujeito.
      </p>

      <h2>4. Com quem partilhamos</h2>
      <p>
        Não vendemos dados pessoais nem os usamos para publicidade. Recorremos
        aos seguintes subcontratantes, cada um para uma função concreta:
      </p>
      <table>
        <thead>
          <tr>
            <th>Subcontratante</th>
            <th>Função</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Clerk</td>
            <td>Autenticação e gestão de contas</td>
          </tr>
          <tr>
            <td>Supabase</td>
            <td>Base de dados e armazenamento</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Alojamento da aplicação e ficheiros</td>
          </tr>
          <tr>
            <td>Stripe</td>
            <td>Pagamentos e subscrições</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Envio de emails transacionais</td>
          </tr>
          <tr>
            <td>Anthropic</td>
            <td>Geração de respostas do Concierge com IA</td>
          </tr>
        </tbody>
      </table>
      <p>
        Alguns destes prestadores podem tratar dados fora do Espaço Económico
        Europeu. Nesses casos a transferência assenta em cláusulas contratuais
        tipo aprovadas pela Comissão Europeia. A localização exata do
        alojamento dos dados é{' '}
        <PorPreencher>região do projeto Supabase e da Vercel</PorPreencher>.
      </p>
      <p>
        Os dados enviados ao Concierge com IA são usados apenas para gerar a
        resposta pedida nesse momento e não servem para treinar modelos.
      </p>

      <h2>5. Durante quanto tempo guardamos</h2>
      <ul>
        <li>
          <strong>Dados da conta:</strong> enquanto a subscrição estiver ativa e
          durante <PorPreencher>prazo</PorPreencher> após o cancelamento.
        </li>
        <li>
          <strong>Dados de hóspedes:</strong> pelo período necessário ao
          cumprimento das obrigações legais do anfitrião —{' '}
          <PorPreencher>prazo de conservação</PorPreencher>. O anfitrião pode
          apagá-los antes disso a partir da aplicação.
        </li>
        <li>
          <strong>Dados de faturação:</strong> pelo prazo exigido pela lei fiscal
          portuguesa.
        </li>
      </ul>

      <h2>6. Os teus direitos</h2>
      <p>
        Tens direito de acesso, retificação, apagamento, limitação, portabilidade
        e oposição ao tratamento dos teus dados. Para os exercer, escreve para{' '}
        <a href="mailto:suporte@anfitrioes.pt">suporte@anfitrioes.pt</a>.
        Respondemos no prazo de um mês.
      </p>
      <p>
        Se um hóspede quiser exercer estes direitos, deve dirigir-se ao anfitrião
        que recolheu os dados, por ser esse o responsável pelo tratamento.
      </p>
      <p>
        Tens também o direito de apresentar reclamação junto da{' '}
        <a
          href="https://www.cnpd.pt"
          target="_blank"
          rel="noreferrer noopener"
        >
          Comissão Nacional de Proteção de Dados
        </a>
        .
      </p>

      <h2>7. Segurança</h2>
      <p>
        As ligações são encriptadas em trânsito. O acesso aos dados está isolado
        por conta, de forma a que um anfitrião nunca aceda a dados de outro. As
        palavras-passe são geridas pelo fornecedor de autenticação e nunca são
        guardadas por nós em texto legível.
      </p>

      <h2>8. Alterações</h2>
      <p>
        Se esta política mudar de forma significativa, avisamos por email antes
        de a alteração produzir efeitos.
      </p>
    </PaginaLegal>
  )
}
