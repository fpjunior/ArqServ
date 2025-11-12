-- Atualizar senhas dos usuários de teste com hashs compatíveis bcryptjs

-- Atualizar admin@kralinfo.com
UPDATE users SET password = '$2b$12$8da4psNjeoWPRENqUQ6KguZzRpYbOIehh0a2Px/eaX/st2ozael2q' 
WHERE email = 'admin@kralinfo.com';

-- Atualizar empresa@test.com  
UPDATE users SET password = '$2b$12$Kk1iFYa5abHw9Nut0DDmI.mybmCBQ1reP1otbKeTcEdtUY3ylCZGu'
WHERE email = 'empresa@test.com';

-- Atualizar prefeitura@sp.gov.br
UPDATE users SET password = '$2b$12$4/SNkAkgyyRgcw78o72YRuNnzikEosEpnAhL3vmVVEIMvccE2.gR.'
WHERE email = 'prefeitura@sp.gov.br';

-- Atualizar prefeitura@rj.gov.br
UPDATE users SET password = '$2b$12$Wl.hSRD5yx84.92w64IbKeLC0VgrXej3f7.9FZaNUd5bDyv5jcqcC'
WHERE email = 'prefeitura@rj.gov.br';

-- Verificar as atualizações
SELECT email, 
       SUBSTRING(password, 1, 20) || '...' as password_preview,
       LENGTH(password) as password_length,
       name, 
       role 
FROM users 
ORDER BY email;