-- Plano Empresa: guest houses, hostels e hotéis pequenos e médios.
--
-- Porque é que faz falta: o limite do plano contava **propriedades de topo**
-- (`parent_id IS NULL`). Como os quartos de uma casa são filhos e não contam,
-- um hotel de 40 quartos era uma propriedade — cabia no Starter de 19 €. O
-- plano mais caro do produto era, na prática, para quem tinha muitos
-- apartamentos separados, e o maior cliente possível pagava o preço mais
-- baixo.
--
-- A correção não é só um escalão novo: a medida do limite passa a ser a
-- **unidade alugável** (`contarUnidadesReservaveis` em lib/reservations.ts).
-- Três apartamentos e uma casa de três quartos passam a valer o mesmo, que é
-- o mesmo trabalho para a plataforma e o mesmo valor para quem a usa.
--
-- Nota: não há clientes pagantes, por isso não há grandfathering a fazer. O
-- limite de cada conta continua na coluna `propriedades_max`, que o admin
-- pode sempre ajustar caso a caso.

ALTER TYPE account_plano ADD VALUE IF NOT EXISTS 'empresa';
