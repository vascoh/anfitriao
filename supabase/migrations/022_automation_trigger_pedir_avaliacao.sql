-- Novo gatilho do motor de automações: pedir avaliação 1 dia após o checkout.
-- ALTER TYPE ... ADD VALUE não pode correr dentro de uma transação com outros
-- comandos que usem o novo valor na mesma migration — fica isolado.
ALTER TYPE automation_trigger ADD VALUE IF NOT EXISTS 'pedir_avaliacao';
