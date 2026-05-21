-- ============================================================
-- 003 Dados de demonstração (datas relativas a NOW)
-- Aplicar via Supabase Dashboard → SQL Editor
-- Idempotente: não insere se já houver propriedades
-- ============================================================

DO $$
DECLARE
  prop1 UUID := gen_random_uuid();
  prop2 UUID := gen_random_uuid();
  prop3 UUID := gen_random_uuid();
  g1    UUID := gen_random_uuid();
  g2    UUID := gen_random_uuid();
  g3    UUID := gen_random_uuid();
  g4    UUID := gen_random_uuid();
  g5    UUID := gen_random_uuid();
  g6    UUID := gen_random_uuid();
BEGIN
  -- Não inserir se já existirem dados
  IF EXISTS (SELECT 1 FROM properties LIMIT 1) THEN
    RAISE NOTICE 'Seed ignorado: já existem propriedades.';
    RETURN;
  END IF;

  -- ── Propriedades ────────────────────────────────────────────

  INSERT INTO properties (
    id, nome, tipo, endereco, cidade, capacidade, quartos, casas_banho,
    comodidades, descricao, imagem_url,
    instrucoes_checkin, regras_casa,
    preco_base, taxa_limpeza, cor, ativo, ical_feeds, criado_em
  ) VALUES
  (
    prop1, 'Apartamento Alfama', 'apartamento',
    'Rua do Limoeiro, 12, 1100-001', 'Lisboa', 4, 2, 1,
    ARRAY['WiFi','AC','Cozinha','Máquina de lavar','Varanda','Vista cidade'],
    'Apartamento com charme no coração de Alfama, com varanda e vista para a cidade. Ideal para casais ou famílias pequenas que querem descobrir Lisboa autêntica.',
    'https://images.unsplash.com/photo-1556912173-3bb406ef7e77?w=800&q=80',
    'A chave está na caixa de segurança junto à porta principal. Código: 1234. Check-in a partir das 15h.',
    'Não fumar. Silêncio a partir das 22h. Sem festas. Animais não permitidos.',
    95, 25, '#C2714F', true, '[]'::jsonb, NOW() - INTERVAL '180 days'
  ),
  (
    prop2, 'Studio Chiado', 'quarto',
    'Rua Garrett, 45, 1200-205', 'Lisboa', 2, 1, 1,
    ARRAY['WiFi','AC','Cozinha compacta','Vista para o rio'],
    'Studio moderno no Chiado, bairro mais fashionable de Lisboa. A dois passos de restaurantes, lojas e do elevador de Santa Justa.',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    'Receção no rés-do-chão aberta das 9h às 21h. Após esse horário, contacte por mensagem.',
    'Não fumar. Sem festas. Check-out até às 11h.',
    65, 15, '#4A7FA5', true, '[]'::jsonb, NOW() - INTERVAL '150 days'
  ),
  (
    prop3, 'T2 Cascais', 'moradia',
    'Av. Dom Carlos I, 8, 2750-310', 'Cascais', 5, 2, 2,
    ARRAY['WiFi','AC','Cozinha','Jardim','Estacionamento','BBQ','Piscina'],
    'Casa com jardim e piscina privada em Cascais, a 5 minutos da praia. Perfeita para famílias ou grupos. Estacionamento gratuito e BBQ disponível.',
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    'Chave no cofre junto ao portão. Código enviado por SMS no dia do check-in.',
    'Máximo 5 hóspedes. Sem festas. Animais permitidos com depósito adicional.',
    145, 40, '#5A8A6A', true, '[]'::jsonb, NOW() - INTERVAL '120 days'
  );

  -- ── Hóspedes ────────────────────────────────────────────────

  INSERT INTO guests (
    id, nome, email, telefone, nacionalidade,
    numero_documento, data_nascimento, tipo_documento, sexo, pais_emissao,
    tags, notas, criado_em
  ) VALUES
  (
    g1, 'Emma Schmidt', 'emma.schmidt@gmail.com', '+49 151 2345 6789', 'Alemã',
    'DE1234567', '1988-03-15', 'passaporte', 'F', 'Alemanha',
    ARRAY['frequente','vip'], 'Hóspede muito cuidadosa. Sempre deixa o apartamento impecável.',
    NOW() - INTERVAL '300 days'
  ),
  (
    g2, 'James Wilson', 'j.wilson@outlook.com', '+44 7700 900123', 'Britânica',
    NULL, NULL, NULL, NULL, NULL,
    ARRAY['frequente'], NULL,
    NOW() - INTERVAL '200 days'
  ),
  (
    g3, 'Marie Dubois', 'marie.dubois@laposte.fr', '+33 6 12 34 56 78', 'Francesa',
    NULL, NULL, NULL, NULL, NULL,
    ARRAY['novo'], NULL,
    NOW() - INTERVAL '60 days'
  ),
  (
    g4, 'Sofia García', 'sofia.garcia@hotmail.es', '+34 612 345 678', 'Espanhola',
    NULL, NULL, NULL, NULL, NULL,
    ARRAY['vip'], 'Sempre pede late check-out. Boa hóspede.',
    NOW() - INTERVAL '90 days'
  ),
  (
    g5, 'Marco Rossi', 'marco.rossi@libero.it', '+39 333 1234567', 'Italiana',
    NULL, NULL, NULL, NULL, NULL,
    ARRAY['novo'], NULL,
    NOW() - INTERVAL '30 days'
  ),
  (
    g6, 'Ana Ferreira', 'ana.ferreira@gmail.com', '+351 912 345 678', 'Portuguesa',
    NULL, NULL, NULL, NULL, NULL,
    ARRAY['problematico'], 'Deixou danos na última estadia. Exigiu reembolso indevido. Cautela.',
    NOW() - INTERVAL '45 days'
  );

  -- ── Reservas ────────────────────────────────────────────────

  -- Em casa: Apartamento Alfama (chegou ontem, sai +4)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop1, g1,
    CURRENT_DATE - 1, CURRENT_DATE + 4, 2,
    'checkin', 'airbnb', 475, 475,
    'Chegada ontem às 16h. Hóspede pediu toalhas extra.',
    NOW() - INTERVAL '32 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '32 days')::text, 'tipo', 'criada', 'descricao', 'Reserva criada via Airbnb'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '31 days 14 hours')::text, 'tipo', 'confirmada', 'descricao', 'Confirmada automaticamente'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '1 day 8 hours')::text, 'tipo', 'checkin', 'descricao', 'Check-in realizado')
    )
  );

  -- Em casa: Studio Chiado (chegou há 2 dias, sai amanhã)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop2, g2,
    CURRENT_DATE - 2, CURRENT_DATE + 1, 1,
    'checkin', 'booking', 195, 195,
    NULL,
    NOW() - INTERVAL '25 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '25 days')::text, 'tipo', 'criada', 'descricao', 'Reserva criada via Booking.com'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '24 days 14 hours')::text, 'tipo', 'confirmada', 'descricao', 'Confirmada automaticamente'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '2 days 8 hours')::text, 'tipo', 'checkin', 'descricao', 'Check-in realizado')
    )
  );

  -- Saída hoje: T2 Cascais (chegou há 3 dias, sai hoje)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop3, g3,
    CURRENT_DATE - 3, CURRENT_DATE, 3,
    'checkin', 'direto', 435, 435,
    NULL,
    NOW() - INTERVAL '20 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '20 days')::text, 'tipo', 'criada', 'descricao', 'Reserva direta por e-mail'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '19 days 10 hours')::text, 'tipo', 'confirmada', 'descricao', 'Confirmada manualmente'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '3 days 8 hours')::text, 'tipo', 'checkin', 'descricao', 'Check-in realizado')
    )
  );

  -- Confirmada: Apartamento Alfama (+5 dias)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop1, g4,
    CURRENT_DATE + 5, CURRENT_DATE + 9, 2,
    'confirmada', 'airbnb', 380, 0,
    NULL,
    NOW() - INTERVAL '15 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '15 days')::text, 'tipo', 'criada', 'descricao', 'Reserva criada via Airbnb'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '14 days 14 hours')::text, 'tipo', 'confirmada', 'descricao', 'Confirmada automaticamente')
    )
  );

  -- Confirmada: Studio Chiado (+3 dias, meio pagamento)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop2, g5,
    CURRENT_DATE + 3, CURRENT_DATE + 6, 2,
    'confirmada', 'booking', 195, 97.50,
    'Hóspede pediu berço para bebé.',
    NOW() - INTERVAL '12 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '12 days')::text, 'tipo', 'criada', 'descricao', 'Reserva criada via Booking.com'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '11 days 14 hours')::text, 'tipo', 'confirmada', 'descricao', 'Confirmada automaticamente'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '7 days 9 hours')::text, 'tipo', 'pagamento', 'descricao', 'Pagamento parcial recebido: €97.50')
    )
  );

  -- Confirmada: T2 Cascais (+14 dias, hóspede recorrente, sinal 50%)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop3, g1,
    CURRENT_DATE + 14, CURRENT_DATE + 21, 4,
    'confirmada', 'direto', 1015, 507.50,
    NULL,
    NOW() - INTERVAL '7 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '7 days')::text, 'tipo', 'criada', 'descricao', 'Reserva direta — hóspede recorrente'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '6 days 22 hours')::text, 'tipo', 'confirmada', 'descricao', 'Confirmada manualmente'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '6 days 21 hours')::text, 'tipo', 'pagamento', 'descricao', 'Sinal de 50%: €507.50')
    )
  );

  -- Pendente: Apartamento Alfama (+11 dias, hóspede problemático)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop1, g6,
    CURRENT_DATE + 11, CURRENT_DATE + 13, 3,
    'pendente', 'outro', 190, 0,
    'Confirmar identidade antes de aceitar.',
    NOW() - INTERVAL '2 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '2 days')::text, 'tipo', 'criada', 'descricao', 'Reserva criada manualmente')
    )
  );

  -- Passada: Studio Chiado (há 20 dias, checkout feito)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop2, g4,
    CURRENT_DATE - 20, CURRENT_DATE - 16, 2,
    'checkout', 'airbnb', 260, 260,
    NULL,
    NOW() - INTERVAL '45 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '45 days')::text, 'tipo', 'criada', 'descricao', 'Reserva criada via Airbnb'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '44 days 14 hours')::text, 'tipo', 'confirmada', 'descricao', 'Confirmada automaticamente'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '20 days 9 hours')::text, 'tipo', 'checkin', 'descricao', 'Check-in realizado'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '16 days 10 hours')::text, 'tipo', 'checkout', 'descricao', 'Check-out realizado')
    )
  );

  -- Passada: Apartamento Alfama (há 2 meses, cancelada)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop1, g3,
    CURRENT_DATE - 60, CURRENT_DATE - 57, 2,
    'cancelada', 'booking', 285, 0,
    'Hóspede cancelou com 48h de antecedência.',
    NOW() - INTERVAL '75 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '75 days')::text, 'tipo', 'criada', 'descricao', 'Reserva criada via Booking.com'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '74 days')::text, 'tipo', 'confirmada', 'descricao', 'Confirmada automaticamente'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '62 days')::text, 'tipo', 'cancelada', 'descricao', 'Cancelada pelo hóspede com 48h de antecedência')
    )
  );

  -- Futura: T2 Cascais (+35 dias, confirmada)
  INSERT INTO bookings (
    id, propriedade_id, hospede_id,
    check_in, check_out, num_hospedes,
    estado, origem, preco_total, preco_pago,
    notas, criado_em, historico
  ) VALUES (
    gen_random_uuid(), prop3, g2,
    CURRENT_DATE + 35, CURRENT_DATE + 42, 3,
    'confirmada', 'expedia', 1015, 0,
    NULL,
    NOW() - INTERVAL '3 days',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '3 days')::text, 'tipo', 'criada', 'descricao', 'Reserva criada via Expedia'),
      jsonb_build_object('id', gen_random_uuid(), 'data', (NOW() - INTERVAL '2 days 20 hours')::text, 'tipo', 'confirmada', 'descricao', 'Confirmada automaticamente')
    )
  );

  RAISE NOTICE 'Seed concluído: 3 propriedades, 6 hóspedes, 10 reservas.';
END $$;
