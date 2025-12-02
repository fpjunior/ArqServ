-- ============================================
-- INSERIR DADOS DE TESTE PARA SERVIDORES
-- Execute este script para testar o sistema
-- ============================================

-- Primeiro, vamos verificar se existe o município de Amaraji
SELECT code, name FROM municipalities WHERE name ILIKE '%amaraji%' LIMIT 5;

-- Se não existir, vamos inserir (ajuste o código conforme necessário)
INSERT INTO municipalities (code, name, state) 
VALUES ('2600401', 'Amaraji', 'PE') 
ON CONFLICT (code) DO NOTHING;

-- Inserir servidores de teste para Amaraji
-- Vamos criar servidores que começam com diferentes letras para testar

INSERT INTO servers (name, municipality_code) VALUES
  ('Ana Maria da Silva', '2600401'),
  ('Antonio Carlos', '2600401'),
  ('Alberto Santos', '2600401'),
  ('Bruno Costa', '2600401'),
  ('Beatriz Oliveira', '2600401'),
  ('Carlos Eduardo', '2600401'),
  ('Carla Pereira', '2600401'),
  ('Daniel Silva', '2600401'),
  ('Eduardo Lima', '2600401'),
  ('Fernanda Santos', '2600401'),
  ('Gabriel Oliveira', '2600401'),
  ('Helena Costa', '2600401'),
  ('Igor Pereira', '2600401'),
  ('Julia Santos', '2600401'),
  ('Karen Silva', '2600401'),
  ('Leonardo Lima', '2600401'),
  ('Mariana Costa', '2600401'),
  ('Nelson Oliveira', '2600401'),
  ('Patricia Silva', '2600401'),
  ('Roberto Santos', '2600401')
ON CONFLICT (name, municipality_code) DO NOTHING;

-- Verificar os servidores inseridos
SELECT 
  s.id,
  s.name,
  s.municipality_code,
  m.name as municipality_name,
  UPPER(LEFT(s.name, 1)) as primeira_letra
FROM servers s
LEFT JOIN municipalities m ON s.municipality_code = m.code
WHERE s.municipality_code = '2600401'
ORDER BY s.name;

-- Contar servidores por letra para Amaraji
SELECT 
  UPPER(LEFT(s.name, 1)) as letra,
  COUNT(*) as quantidade
FROM servers s
WHERE s.municipality_code = '2600401'
GROUP BY UPPER(LEFT(s.name, 1))
ORDER BY letra;