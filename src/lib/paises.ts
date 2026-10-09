/**
 * Países — ISO 3166-1, com o código de 3 letras que o SIBA usa.
 *
 * Os nomes não vivem aqui: vêm de `Intl.DisplayNames`, em português ou
 * inglês, no browser e no servidor. Isso dá duas coisas a partir de uma lista
 * só: o seletor do check-in (o hóspede escolhe, não escreve) e a leitura de
 * texto livre que já está na base — «Alemanha», «Germany», «Deutschland» não,
 * mas «Estados Unidos» e «United States» sim.
 */

/** [alfa-2, alfa-3] */
const ISO: ReadonlyArray<readonly [string, string]> = [
  ['AF', 'AFG'], ['AX', 'ALA'], ['AL', 'ALB'], ['DZ', 'DZA'], ['AS', 'ASM'], ['AD', 'AND'], ['AO', 'AGO'],
  ['AI', 'AIA'], ['AQ', 'ATA'], ['AG', 'ATG'], ['AR', 'ARG'], ['AM', 'ARM'], ['AW', 'ABW'], ['AU', 'AUS'],
  ['AT', 'AUT'], ['AZ', 'AZE'], ['BS', 'BHS'], ['BH', 'BHR'], ['BD', 'BGD'], ['BB', 'BRB'], ['BY', 'BLR'],
  ['BE', 'BEL'], ['BZ', 'BLZ'], ['BJ', 'BEN'], ['BM', 'BMU'], ['BT', 'BTN'], ['BO', 'BOL'], ['BQ', 'BES'],
  ['BA', 'BIH'], ['BW', 'BWA'], ['BV', 'BVT'], ['BR', 'BRA'], ['IO', 'IOT'], ['BN', 'BRN'], ['BG', 'BGR'],
  ['BF', 'BFA'], ['BI', 'BDI'], ['CV', 'CPV'], ['KH', 'KHM'], ['CM', 'CMR'], ['CA', 'CAN'], ['KY', 'CYM'],
  ['CF', 'CAF'], ['TD', 'TCD'], ['CL', 'CHL'], ['CN', 'CHN'], ['CX', 'CXR'], ['CC', 'CCK'], ['CO', 'COL'],
  ['KM', 'COM'], ['CG', 'COG'], ['CD', 'COD'], ['CK', 'COK'], ['CR', 'CRI'], ['CI', 'CIV'], ['HR', 'HRV'],
  ['CU', 'CUB'], ['CW', 'CUW'], ['CY', 'CYP'], ['CZ', 'CZE'], ['DK', 'DNK'], ['DJ', 'DJI'], ['DM', 'DMA'],
  ['DO', 'DOM'], ['EC', 'ECU'], ['EG', 'EGY'], ['SV', 'SLV'], ['GQ', 'GNQ'], ['ER', 'ERI'], ['EE', 'EST'],
  ['SZ', 'SWZ'], ['ET', 'ETH'], ['FK', 'FLK'], ['FO', 'FRO'], ['FJ', 'FJI'], ['FI', 'FIN'], ['FR', 'FRA'],
  ['GF', 'GUF'], ['PF', 'PYF'], ['TF', 'ATF'], ['GA', 'GAB'], ['GM', 'GMB'], ['GE', 'GEO'], ['DE', 'DEU'],
  ['GH', 'GHA'], ['GI', 'GIB'], ['GR', 'GRC'], ['GL', 'GRL'], ['GD', 'GRD'], ['GP', 'GLP'], ['GU', 'GUM'],
  ['GT', 'GTM'], ['GG', 'GGY'], ['GN', 'GIN'], ['GW', 'GNB'], ['GY', 'GUY'], ['HT', 'HTI'], ['HM', 'HMD'],
  ['VA', 'VAT'], ['HN', 'HND'], ['HK', 'HKG'], ['HU', 'HUN'], ['IS', 'ISL'], ['IN', 'IND'], ['ID', 'IDN'],
  ['IR', 'IRN'], ['IQ', 'IRQ'], ['IE', 'IRL'], ['IM', 'IMN'], ['IL', 'ISR'], ['IT', 'ITA'], ['JM', 'JAM'],
  ['JP', 'JPN'], ['JE', 'JEY'], ['JO', 'JOR'], ['KZ', 'KAZ'], ['KE', 'KEN'], ['KI', 'KIR'], ['KP', 'PRK'],
  ['KR', 'KOR'], ['KW', 'KWT'], ['KG', 'KGZ'], ['LA', 'LAO'], ['LV', 'LVA'], ['LB', 'LBN'], ['LS', 'LSO'],
  ['LR', 'LBR'], ['LY', 'LBY'], ['LI', 'LIE'], ['LT', 'LTU'], ['LU', 'LUX'], ['MO', 'MAC'], ['MG', 'MDG'],
  ['MW', 'MWI'], ['MY', 'MYS'], ['MV', 'MDV'], ['ML', 'MLI'], ['MT', 'MLT'], ['MH', 'MHL'], ['MQ', 'MTQ'],
  ['MR', 'MRT'], ['MU', 'MUS'], ['YT', 'MYT'], ['MX', 'MEX'], ['FM', 'FSM'], ['MD', 'MDA'], ['MC', 'MCO'],
  ['MN', 'MNG'], ['ME', 'MNE'], ['MS', 'MSR'], ['MA', 'MAR'], ['MZ', 'MOZ'], ['MM', 'MMR'], ['NA', 'NAM'],
  ['NR', 'NRU'], ['NP', 'NPL'], ['NL', 'NLD'], ['NC', 'NCL'], ['NZ', 'NZL'], ['NI', 'NIC'], ['NE', 'NER'],
  ['NG', 'NGA'], ['NU', 'NIU'], ['NF', 'NFK'], ['MK', 'MKD'], ['MP', 'MNP'], ['NO', 'NOR'], ['OM', 'OMN'],
  ['PK', 'PAK'], ['PW', 'PLW'], ['PS', 'PSE'], ['PA', 'PAN'], ['PG', 'PNG'], ['PY', 'PRY'], ['PE', 'PER'],
  ['PH', 'PHL'], ['PN', 'PCN'], ['PL', 'POL'], ['PT', 'PRT'], ['PR', 'PRI'], ['QA', 'QAT'], ['RE', 'REU'],
  ['RO', 'ROU'], ['RU', 'RUS'], ['RW', 'RWA'], ['BL', 'BLM'], ['SH', 'SHN'], ['KN', 'KNA'], ['LC', 'LCA'],
  ['MF', 'MAF'], ['PM', 'SPM'], ['VC', 'VCT'], ['WS', 'WSM'], ['SM', 'SMR'], ['ST', 'STP'], ['SA', 'SAU'],
  ['SN', 'SEN'], ['RS', 'SRB'], ['SC', 'SYC'], ['SL', 'SLE'], ['SG', 'SGP'], ['SX', 'SXM'], ['SK', 'SVK'],
  ['SI', 'SVN'], ['SB', 'SLB'], ['SO', 'SOM'], ['ZA', 'ZAF'], ['GS', 'SGS'], ['SS', 'SSD'], ['ES', 'ESP'],
  ['LK', 'LKA'], ['SD', 'SDN'], ['SR', 'SUR'], ['SJ', 'SJM'], ['SE', 'SWE'], ['CH', 'CHE'], ['SY', 'SYR'],
  ['TW', 'TWN'], ['TJ', 'TJK'], ['TZ', 'TZA'], ['TH', 'THA'], ['TL', 'TLS'], ['TG', 'TGO'], ['TK', 'TKL'],
  ['TO', 'TON'], ['TT', 'TTO'], ['TN', 'TUN'], ['TR', 'TUR'], ['TM', 'TKM'], ['TC', 'TCA'], ['TV', 'TUV'],
  ['UG', 'UGA'], ['UA', 'UKR'], ['AE', 'ARE'], ['GB', 'GBR'], ['US', 'USA'], ['UM', 'UMI'], ['UY', 'URY'],
  ['UZ', 'UZB'], ['VU', 'VUT'], ['VE', 'VEN'], ['VN', 'VNM'], ['VG', 'VGB'], ['VI', 'VIR'], ['WF', 'WLF'],
  ['EH', 'ESH'], ['YE', 'YEM'], ['ZM', 'ZMB'], ['ZW', 'ZWE'],
]

const ALFA3 = new Set(ISO.map(([, a3]) => a3))
const DE_ALFA3 = new Map(ISO.map(([a2, a3]) => [a3, a2]))

export type LinguaPaises = 'pt' | 'en'

const nomes = new Map<LinguaPaises, Intl.DisplayNames>()
function displayNames(lingua: LinguaPaises): Intl.DisplayNames | null {
  if (!nomes.has(lingua)) {
    try { nomes.set(lingua, new Intl.DisplayNames([lingua === 'pt' ? 'pt-PT' : 'en'], { type: 'region' })) } catch { return null }
  }
  return nomes.get(lingua) ?? null
}

export function eCodigoPais(v: string | null | undefined): boolean {
  return !!v && ALFA3.has(v)
}

/** Nome do país a partir do código de 3 letras; o próprio código quando não há nome. */
export function nomePais(alfa3: string, lingua: LinguaPaises = 'pt'): string {
  const a2 = DE_ALFA3.get(alfa3)
  return (a2 && displayNames(lingua)?.of(a2)) || alfa3
}

/** Todos os países, ordenados pelo nome na língua pedida. */
export function listaPaises(lingua: LinguaPaises = 'pt'): Array<{ codigo: string; nome: string }> {
  const col = new Intl.Collator(lingua === 'pt' ? 'pt-PT' : 'en')
  return ISO.map(([, a3]) => ({ codigo: a3, nome: nomePais(a3, lingua) })).sort((a, b) => col.compare(a.nome, b.nome))
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
}

/** Nomes que as pessoas escrevem e que o Intl não dá. */
const ALIASES: Record<string, string> = {
  'usa': 'USA', 'eua': 'USA', 'estados unidos da america': 'USA',
  'uk': 'GBR', 'reino unido': 'GBR', 'inglaterra': 'GBR', 'england': 'GBR', 'escocia': 'GBR', 'scotland': 'GBR',
  'gra bretanha': 'GBR', 'great britain': 'GBR', 'wales': 'GBR', 'pais de gales': 'GBR',
  'holanda': 'NLD', 'holland': 'NLD', 'the netherlands': 'NLD',
  'deutschland': 'DEU', 'espana': 'ESP', 'italia': 'ITA', 'suica': 'CHE', 'schweiz': 'CHE',
  'russia': 'RUS', 'coreia do sul': 'KOR', 'south korea': 'KOR', 'korea': 'KOR',
  'republica checa': 'CZE', 'czech republic': 'CZE', 'chequia': 'CZE',
  'mocambique': 'MOZ', 'brasil': 'BRA', 'cabo verde': 'CPV', 'sao tome e principe': 'STP',
}

let indice: Map<string, string> | null = null
function indicePorNome(): Map<string, string> {
  if (indice) return indice
  const m = new Map<string, string>()
  for (const lingua of ['pt', 'en'] as const) {
    for (const { codigo, nome } of listaPaises(lingua)) {
      if (nome !== codigo) m.set(normalizar(nome), codigo)
    }
  }
  for (const [k, v] of Object.entries(ALIASES)) m.set(k, v)
  indice = m
  return m
}

/**
 * Forma canónica de um país para gravar: o nome em português quando se
 * reconhece («Germany», «DEU», «alemanha» → «Alemanha»), o texto tal como
 * está quando não. Sem isto, o mesmo país aparecia em linhas diferentes no
 * mapa do INE.
 */
export function nomePaisPt(v: string | null | undefined): string {
  const s = String(v ?? '').trim()
  const codigo = codigoDePais(s)
  return codigo ? nomePais(codigo, 'pt') : s
}

/**
 * Código de 3 letras a partir do que estiver escrito: um código, ou o nome em
 * português ou inglês (com ou sem acentos). `undefined` quando não sabe —
 * nunca adivinha, porque um código errado o SIBA recusa sem dizer porquê.
 */
export function codigoDePais(v: string | null | undefined): string | undefined {
  const s = String(v ?? '').trim()
  if (!s) return undefined
  if (/^[A-Za-z]{3}$/.test(s) && ALFA3.has(s.toUpperCase())) return s.toUpperCase()
  return indicePorNome().get(normalizar(s))
}
