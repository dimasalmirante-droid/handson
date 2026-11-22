-- Handson · Learning · Pilot course (content only)
--
-- "Preparação para o Trabalho (piloto)", module 1: strengths with evidence and
-- choosing a direction. One reading, one practical exercise, one scenario
-- quiz (8 questions, pass mark 80% = 7 of 8).
--
-- The course is RESTRICTED: invisible to every student until they redeem the
-- pilot code PILOTO-HANDSON (50 uses, expires 31 January 2027). Safe to carry
-- to production: nobody sees it without the code.
--
-- Data only. Requires 20261123000100_lms_foundation.sql.

insert into public.courses (id, slug, category_id, title, summary, status, audience, sequential, pass_mark, badge_name, price_mzn, published_at, sort_order)
values (
  'a1f0c0de-0000-4000-8000-000000000001',
  'preparacao-para-o-trabalho-piloto',
  (select id from public.course_categories where slug = 'work-readiness'),
  'Preparação para o Trabalho (piloto)',
  'Módulo 1: identificar pontos fortes com prova e escolher uma direcção profissional. Inclui um exercício prático e um caso para resolver. Cerca de 30 minutos.',
  'published', 'restricted', true, 80,
  'Preparação para o Trabalho · Módulo 1',
  0, now(), 1
);

insert into public.course_modules (id, course_id, position, title, objective)
values (
  'a1f0c0de-0000-4000-8000-000000000101',
  'a1f0c0de-0000-4000-8000-000000000001',
  1,
  'Conhecer os seus pontos fortes e escolher uma direcção',
  'No fim do módulo, identifica três pontos fortes com prova concreta e escolhe uma ou duas áreas de trabalho para procurar.'
);

insert into public.course_lessons (id, module_id, position, title, lesson_type, body, duration_minutes)
values
(
  'a1f0c0de-0000-4000-8000-000000000201',
  'a1f0c0de-0000-4000-8000-000000000101',
  1,
  'Pontos fortes com prova',
  'text',
  $md$Um recrutador lê um CV em menos de um minuto. Nesse tempo, frases como «sou trabalhador, dedicado e responsável» não o distinguem de ninguém: todos os candidatos as escrevem e nenhum as prova.

### O que é um ponto forte

Um ponto forte tem três partes:

1. **Uma competência** — algo que faz bem, por exemplo organizar, analisar números, explicar, resolver problemas técnicos, negociar.
2. **Uma prova** — uma situação real em que a usou, com um resultado que outra pessoa pode confirmar.
3. **Uma relevância** — onde essa competência é útil no trabalho que procura.

Sem prova, é uma opinião. Com prova, é um argumento.

### Onde encontrar provas, mesmo sem emprego formal

Muitos estudantes acham que não têm experiência. Quase todos têm. Procure em:

- associações de estudantes, núcleos e comissões de curso;
- igreja, grupos de jovens, clubes desportivos;
- o negócio da família: a banca no mercado, a loja, a machamba, o transporte;
- voluntariado, campanhas, eventos da comunidade;
- projectos e trabalhos de grupo na faculdade ou no instituto;
- explicações a colegas ou a crianças do bairro.

### Dois exemplos

**Amina**, finalista de Contabilidade em Maputo, escreveu primeiro: «Sou rigorosa.» Depois de pensar nas provas, escreveu: «Fiz a contabilidade da associação de estudantes durante dois anos, 120 membros, quotas e despesas reconciliadas todos os meses, sem diferenças por justificar.» A competência é a mesma. A segunda frase convence.

**Délcio**, técnico de informática recém-formado na Beira, dizia que não tinha experiência. Mas há dois anos repara computadores e telemóveis de vizinhos e, num estágio de três meses numa escola, repôs a rede em duas horas numa semana de exames. Isto prova duas competências: resolver problemas técnicos sob pressão e explicar a pessoas que não são técnicas.

### Erros comuns

- Escolher qualidades de que gosta, em vez de qualidades que consegue provar.
- Dar exemplos sem resultado: «ajudei na associação» não diz o que mudou.
- Ignorar experiência informal por vergonha. Gerir o caixa diário de uma banca é experiência real.
- Escolher dez áreas «para ter mais hipóteses». Uma direcção clara é mais fácil de contratar.

No exercício seguinte, vai construir o seu próprio mapa de pontos fortes.$md$,
  6
),
(
  'a1f0c0de-0000-4000-8000-000000000202',
  'a1f0c0de-0000-4000-8000-000000000101',
  2,
  'Exercício: o seu mapa de pontos fortes',
  'text',
  $md$Reserve 20 minutos e uma folha ou um documento no telemóvel. Este mapa vai ser usado nos próximos módulos, no CV e na entrevista, por isso faça-o com cuidado.

### Passo 1 — Liste situações (5 minutos)

Escreva pelo menos **oito situações** dos últimos três anos em que fez algo bem, resolveu um problema ou em que outras pessoas confiaram em si. Use as fontes da lição anterior: associação, igreja, desporto, negócio da família, voluntariado, projectos.

### Passo 2 — Acrescente acção e resultado (7 minutos)

Para cada situação, escreva numa linha:

- **o que fez**, começando por um verbo: organizei, calculei, expliquei, reparei, negociei, coordenei;
- **o resultado**, com um número sempre que possível: quantas pessoas, quanto dinheiro, quanto tempo, que percentagem.

Exemplo: «Coordenei 12 voluntários na semana cultural da faculdade; 400 participantes em 3 dias, sem atrasos no programa.»

### Passo 3 — Escolha três pontos fortes (3 minutos)

Agrupe as situações pela competência que mostram. Escolha as **três competências com a melhor prova**, não as de que mais gosta.

### Passo 4 — Teste cada ponto forte (2 minutos)

Para cada um, responda com sim ou não:

1. Tenho pelo menos uma situação concreta?
2. Há um resultado que outra pessoa pode confirmar?
3. Há pelo menos um número?
4. Consigo explicá-lo em 30 segundos, sem usar adjectivos como «dedicado» ou «responsável»?

Se respondeu «não» a duas ou mais perguntas, troque esse ponto forte por outro com melhor prova.

### Passo 5 — Escolha uma direcção (3 minutos)

Para cada ponto forte, escreva duas funções em que ele é importante. Depois, escolha **uma ou duas áreas** onde aparecem pelo menos dois dos seus pontos fortes. Essa é a sua direcção para as próximas candidaturas.

### Passo 6 — Actualize o seu perfil

Em **O meu perfil**:

- escreva um título profissional que diga o que estuda ou faz e o que procura;
- em **O que procura**, seleccione as áreas que escolheu.

### Critérios de qualidade

O seu mapa está pronto quando:

- cada um dos três pontos fortes tem uma situação concreta e um resultado;
- pelo menos dois têm um número;
- nenhum depende de um adjectivo sem prova;
- as áreas escolhidas usam pelo menos dois dos seus pontos fortes;
- o título profissional e «O que procura» estão actualizados.

Quando terminar, marque a lição como concluída e passe ao caso prático.$md$,
  20
),
(
  'a1f0c0de-0000-4000-8000-000000000203',
  'a1f0c0de-0000-4000-8000-000000000101',
  3,
  'Caso prático: Amina e Délcio',
  'quiz',
  null,
  8
);

insert into public.quiz_questions (lesson_id, position, prompt, options, correct_index, explanation) values
('a1f0c0de-0000-4000-8000-000000000203', 1,
 'A Amina escreveu no CV: «Sou proactiva, responsável e trabalho bem em equipa.» Um recrutador lê isto em 30 segundos. Qual é o principal problema?',
 array['É demasiado curto.', 'São afirmações sem prova que qualquer candidato pode escrever.', 'Devia estar em inglês.', 'Devia listar mais qualidades.'],
 1, 'Adjectivos sem prova não distinguem ninguém. Uma situação concreta com resultado transforma uma opinião num argumento.'),

('a1f0c0de-0000-4000-8000-000000000203', 2,
 'Qual destas frases demonstra melhor o ponto forte «organização»?',
 array['«Sou muito organizada no meu dia-a-dia.»', '«Os meus colegas dizem que sou organizada.»', '«Coordenei a logística da semana cultural da faculdade: 12 voluntários, 3 dias, 400 participantes, sem atrasos no programa.»', '«Gosto de ter tudo planeado com antecedência.»'],
 2, 'Só esta frase tem acção, escala e resultado verificáveis. As outras são opiniões, mesmo quando vêm de colegas.'),

('a1f0c0de-0000-4000-8000-000000000203', 3,
 'O Délcio nunca teve emprego formal. Há três anos ajuda na banca de acessórios do tio, no mercado, onde controla o stock e fecha o caixa todos os dias. Como deve tratar esta experiência?',
 array['Não a mencionar, porque não é emprego formal.', 'Mencioná-la só se lhe perguntarem na entrevista.', 'Inventar um cargo mais importante para impressionar.', 'Descrevê-la como experiência, com tarefas e resultados concretos, como o controlo de stock e o fecho de caixa diário.'],
 3, 'Experiência informal é experiência real. Descrita com tarefas e resultados, prova responsabilidade com dinheiro e organização. Inventar cargos destrói a confiança.'),

('a1f0c0de-0000-4000-8000-000000000203', 4,
 'A Amina tem três pontos fortes com prova: rigor com números, explicar temas complexos de forma simples e persistência. Que direcção faz mais sentido como primeira escolha?',
 array['Auditoria e educação financeira de clientes, por exemplo numa instituição de microfinança.', 'Marketing digital e design gráfico.', 'Qualquer vaga, para aumentar as hipóteses.', 'Logística, porque tem mais vagas este ano.'],
 0, 'Esta direcção usa os três pontos fortes ao mesmo tempo. Escolher pelo número de vagas, ou por tudo, ignora o que a Amina consegue provar.'),

('a1f0c0de-0000-4000-8000-000000000203', 5,
 'Um colega aconselha o Délcio: «Candidata-te a tudo; quanto mais CVs enviares, melhor.» O que é mais provável acontecer?',
 array['Recebe mais respostas, porque a probabilidade aumenta.', 'É contratado mais depressa.', 'Os recrutadores valorizam a disponibilidade para qualquer função.', 'Recebe poucas respostas, porque um CV genérico não mostra adequação a nenhuma vaga.'],
 3, 'Os recrutadores procuram adequação à vaga. Um CV genérico perde para candidatos que mostram, com provas, porque servem para aquela função.'),

('a1f0c0de-0000-4000-8000-000000000203', 6,
 'Para confirmar que «resolução de problemas» é mesmo um ponto forte seu, qual é a melhor prova?',
 array['Uma situação concreta em que identificou um problema, agiu e obteve um resultado que outra pessoa pode confirmar.', 'Um resultado alto num teste de personalidade online.', 'Ter boas notas a Matemática.', 'Sentir que gosta de resolver problemas.'],
 0, 'Gostar de algo, ou ter notas numa disciplina, não prova a competência no trabalho. Uma situação real com resultado verificável prova.'),

('a1f0c0de-0000-4000-8000-000000000203', 7,
 'A Amina prefere trabalho de concentração; o Délcio ganha energia a falar com pessoas e explica bem temas técnicos. Para uma vaga de «técnico de apoio ao cliente — linha de suporte», quem é mais adequado e porquê?',
 array['A Amina, porque é rigorosa com números.', 'Nenhum, porque não têm experiência formal.', 'O Délcio, porque a função combina conhecimento técnico com contacto constante com clientes.', 'Ambos por igual, porque o perfil não interessa.'],
 2, 'A adequação vem da combinação de pontos fortes com o que a função exige no dia-a-dia. Aqui, as provas do Délcio correspondem directamente à vaga.'),

('a1f0c0de-0000-4000-8000-000000000203', 8,
 'Depois de escolher uma ou duas áreas, qual é o passo seguinte mais útil?',
 array['Esperar que as empresas o contactem.', 'Fazer mais cursos antes de se candidatar a qualquer vaga.', 'Mudar de área se não tiver resposta numa semana.', 'Registar as áreas no perfil, ajustar o título profissional e estudar vagas reais nessas áreas para confirmar o que pedem.'],
 3, 'A direcção só ajuda se for usada: no perfil, no título e na leitura de vagas reais, que mostram que provas deve preparar para o CV e para a entrevista.');

insert into public.course_vouchers (course_id, code, max_uses, expires_at, sponsor_name)
values ('a1f0c0de-0000-4000-8000-000000000001', 'PILOTO-HANDSON', 50, '2027-01-31 23:59:59+02', 'Piloto Handson');
