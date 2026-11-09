-- Handson · Phase 3 · Reference data (Mozambique)
--
-- Starter catalogues in English and Portuguese. Administrators can add and
-- correct entries later from the admin portal. Requires 20261109000200_core_schema.sql.

-- ---------------------------------------------------------------------------
-- Provinces (11)
-- ---------------------------------------------------------------------------
insert into public.provinces (country_code, code, name_en, name_pt, sort_order) values
  ('MZ', 'MPM', 'Maputo City',      'Cidade de Maputo',   1),
  ('MZ', 'MPT', 'Maputo Province',  'Província de Maputo', 2),
  ('MZ', 'GAZ', 'Gaza',             'Gaza',               3),
  ('MZ', 'INH', 'Inhambane',        'Inhambane',          4),
  ('MZ', 'SOF', 'Sofala',           'Sofala',             5),
  ('MZ', 'MAN', 'Manica',           'Manica',             6),
  ('MZ', 'TET', 'Tete',             'Tete',               7),
  ('MZ', 'ZAM', 'Zambézia',         'Zambézia',           8),
  ('MZ', 'NAM', 'Nampula',          'Nampula',            9),
  ('MZ', 'CAB', 'Cabo Delgado',     'Cabo Delgado',       10),
  ('MZ', 'NIA', 'Niassa',           'Niassa',             11);

-- ---------------------------------------------------------------------------
-- Institutions (starter list; students can also enter an institution by name)
-- ---------------------------------------------------------------------------
insert into public.institutions (name, short_name, type, province_id, city)
select v.name, v.short_name, v.type::public.institution_type, p.id, v.city
from (values
  ('Universidade Eduardo Mondlane',                                   'UEM',          'university',  'MPM', 'Maputo'),
  ('Universidade Pedagógica de Maputo',                               'UP-Maputo',    'university',  'MPM', 'Maputo'),
  ('Universidade Joaquim Chissano',                                   'UJC',          'university',  'MPM', 'Maputo'),
  ('Universidade Save',                                               'UniSave',      'university',  'GAZ', 'Chongoene'),
  ('Universidade Zambeze',                                            'UniZambeze',   'university',  'SOF', 'Beira'),
  ('Universidade Púnguè',                                             'UniPúnguè',    'university',  'MAN', 'Chimoio'),
  ('Universidade Licungo',                                            'UniLicungo',   'university',  'ZAM', 'Quelimane'),
  ('Universidade Lúrio',                                              'UniLúrio',     'university',  'NAM', 'Nampula'),
  ('Universidade Rovuma',                                             'UniRovuma',    'university',  'NAM', 'Nampula'),
  ('Universidade Católica de Moçambique',                             'UCM',          'university',  'SOF', 'Beira'),
  ('Universidade São Tomás de Moçambique',                            'USTM',         'university',  'MPM', 'Maputo'),
  ('A Politécnica – Universidade Politécnica',                        'A Politécnica','university',  'MPM', 'Maputo'),
  ('Universidade Técnica de Moçambique',                              'UDM',          'university',  'MPM', 'Maputo'),
  ('Universidade Mussa Bin Bique',                                    'UMBB',         'university',  'NAM', 'Nampula'),
  ('Instituto Superior de Ciências e Tecnologia de Moçambique',       'ISCTEM',       'university',  'MPM', 'Maputo'),
  ('Instituto Superior de Transportes e Comunicações',                'ISUTC',        'university',  'MPM', 'Maputo'),
  ('Instituto Superior de Ciências de Saúde',                         'ISCISA',       'university',  'MPM', 'Maputo'),
  ('Instituto Superior de Contabilidade e Auditoria de Moçambique',   'ISCAM',        'university',  'MPM', 'Maputo'),
  ('Instituto Superior Politécnico de Gaza',                          'ISPG',         'polytechnic', 'GAZ', 'Chókwè'),
  ('Instituto Superior Politécnico de Manica',                        'ISPM',         'polytechnic', 'MAN', 'Chimoio'),
  ('Instituto Superior Politécnico de Tete',                          'ISPT',         'polytechnic', 'TET', 'Tete'),
  ('Instituto Superior Politécnico de Songo',                         'ISPS',         'polytechnic', 'TET', 'Songo'),
  ('Instituto Industrial de Maputo',                                  'IIM',          'tvet',        'MPM', 'Maputo'),
  ('Instituto Comercial de Maputo',                                   'ICM',          'tvet',        'MPM', 'Maputo'),
  ('Instituto de Formação Profissional e Estudos Laborais Alberto Cassimo', 'IFPELAC', 'tvet',     'MPM', 'Maputo')
) as v(name, short_name, type, province_code, city)
join public.provinces p on p.country_code = 'MZ' and p.code = v.province_code;

-- ---------------------------------------------------------------------------
-- Qualification types
-- ---------------------------------------------------------------------------
insert into public.qualification_types (code, name_en, name_pt, level, institution_types, sort_order) values
  ('secondary_certificate', 'Secondary school certificate (12th grade)', 'Certificado do Ensino Secundário (12.ª classe)', 1, '{secondary}', 1),
  ('vocational_certificate', 'Vocational certificate (CV1–CV5)',          'Certificado Vocacional (CV1–CV5)',               2, '{tvet}', 2),
  ('basic_technical',        'Basic technical (Técnico Básico)',          'Técnico Básico',                                 2, '{tvet}', 3),
  ('medium_technical',       'Medium technical (Técnico Médio)',          'Técnico Médio',                                  3, '{tvet}', 4),
  ('higher_diploma',         'Higher diploma',                            'Diploma de Ensino Superior',                     4, '{polytechnic,university}', 5),
  ('bachelor',               'Bachelor''s degree (Licenciatura)',         'Licenciatura',                                   5, '{university,polytechnic}', 6),
  ('postgraduate_diploma',   'Postgraduate diploma',                      'Pós-graduação',                                  6, '{university,polytechnic}', 7),
  ('master',                 'Master''s degree',                          'Mestrado',                                       7, '{university}', 8),
  ('doctorate',              'Doctorate',                                 'Doutoramento',                                   8, '{university}', 9),
  ('short_course',           'Short course or professional certification','Curso de curta duração ou certificação profissional', 2, '{tvet,polytechnic,university,other}', 10),
  ('other',                  'Other',                                     'Outro',                                          0, '{university,polytechnic,tvet,secondary,other}', 99);

-- ---------------------------------------------------------------------------
-- Fields of study
-- ---------------------------------------------------------------------------
insert into public.fields_of_study (code, name_en, name_pt, area, sort_order) values
  ('accounting_finance',     'Accounting and Finance',              'Contabilidade e Finanças',            'business', 1),
  ('economics',              'Economics',                           'Economia',                            'business', 2),
  ('business_management',    'Business Management',                 'Gestão de Empresas',                  'business', 3),
  ('marketing',              'Marketing',                           'Marketing',                           'business', 4),
  ('human_resources',        'Human Resources',                     'Recursos Humanos',                    'business', 5),
  ('logistics_transport',    'Logistics and Transport',             'Logística e Transportes',             'business', 6),
  ('tourism_hospitality',    'Tourism and Hospitality',             'Turismo e Hotelaria',                 'business', 7),
  ('law',                    'Law',                                 'Direito',                             'social', 10),
  ('public_administration',  'Public Administration',               'Administração Pública',               'social', 11),
  ('international_relations','International Relations',             'Relações Internacionais',             'social', 12),
  ('social_sciences',        'Social Sciences',                     'Ciências Sociais',                    'social', 13),
  ('psychology',             'Psychology',                          'Psicologia',                          'social', 14),
  ('journalism_communication','Journalism and Communication',       'Jornalismo e Comunicação',            'social', 15),
  ('languages_translation',  'Languages and Translation',           'Línguas e Tradução',                  'social', 16),
  ('education',              'Education and Teaching',              'Educação e Ensino',                   'social', 17),
  ('computer_science',       'Computer Science and IT',             'Informática',                         'technology', 20),
  ('software_engineering',   'Software Engineering',                'Engenharia de Software',              'technology', 21),
  ('information_systems',    'Information Systems',                 'Sistemas de Informação',              'technology', 22),
  ('data_statistics',        'Data Science and Statistics',         'Ciência de Dados e Estatística',      'technology', 23),
  ('civil_engineering',      'Civil Engineering',                   'Engenharia Civil',                    'engineering', 30),
  ('mechanical_engineering', 'Mechanical Engineering',              'Engenharia Mecânica',                 'engineering', 31),
  ('electrical_engineering', 'Electrical and Electronic Engineering','Engenharia Electrotécnica e Electrónica', 'engineering', 32),
  ('chemical_engineering',   'Chemical Engineering',                'Engenharia Química',                  'engineering', 33),
  ('mining_geology',         'Mining and Geology',                  'Minas e Geologia',                    'engineering', 34),
  ('oil_gas',                'Oil and Gas',                         'Petróleo e Gás',                      'engineering', 35),
  ('architecture_planning',  'Architecture and Urban Planning',     'Arquitectura e Planeamento Físico',   'engineering', 36),
  ('agriculture',            'Agriculture and Agronomy',            'Agricultura e Agronomia',             'natural', 40),
  ('veterinary',             'Veterinary Science',                  'Medicina Veterinária',                'natural', 41),
  ('environmental_science',  'Environmental Science',               'Ciências Ambientais',                 'natural', 42),
  ('biology_chemistry',      'Biology and Chemistry',               'Biologia e Química',                  'natural', 43),
  ('mathematics_physics',    'Mathematics and Physics',             'Matemática e Física',                 'natural', 44),
  ('medicine',               'Medicine',                            'Medicina',                            'health', 50),
  ('nursing',                'Nursing',                             'Enfermagem',                          'health', 51),
  ('pharmacy',               'Pharmacy',                            'Farmácia',                            'health', 52),
  ('public_health',          'Public Health',                       'Saúde Pública',                       'health', 53),
  ('arts_design',            'Arts and Design',                     'Artes e Design',                      'creative', 60),
  ('electrical_installation','Electrical Installation (trade)',     'Electricidade (instalações)',          'trades', 70),
  ('auto_mechanics',         'Automotive Mechanics (trade)',        'Mecânica Auto',                       'trades', 71),
  ('construction_trades',    'Construction Trades',                 'Construção Civil (ofícios)',          'trades', 72),
  ('welding_metalwork',      'Welding and Metalwork',               'Serralharia e Soldadura',             'trades', 73),
  ('catering',               'Hospitality and Catering',            'Hotelaria e Restauração',             'trades', 74),
  ('other',                  'Other',                               'Outro',                               'other', 99);

-- ---------------------------------------------------------------------------
-- Skills
-- ---------------------------------------------------------------------------
insert into public.skill_categories (code, name_en, name_pt, sort_order) values
  ('digital_office', 'Digital and office tools',     'Ferramentas digitais e de escritório', 1),
  ('technology',     'Technology and data',          'Tecnologia e dados',                   2),
  ('business',       'Business and finance',         'Negócios e finanças',                  3),
  ('languages',      'Languages and communication',  'Línguas e comunicação',                4),
  ('technical',      'Engineering and technical',    'Engenharia e técnica',                 5),
  ('professional',   'Professional and interpersonal','Profissionais e interpessoais',       6);

insert into public.skill_catalogue (category_id, name_en, name_pt, aliases)
select c.id, v.name_en, v.name_pt, v.aliases::text[]
from (values
  ('digital_office', 'Microsoft Excel',            'Microsoft Excel',                 '{excel,spreadsheets,folha de cálculo}'),
  ('digital_office', 'Microsoft Word',             'Microsoft Word',                  '{word}'),
  ('digital_office', 'Microsoft PowerPoint',       'Microsoft PowerPoint',            '{powerpoint,presentations}'),
  ('digital_office', 'Google Workspace',           'Google Workspace',                '{google docs,google sheets,gmail}'),
  ('digital_office', 'Data entry',                 'Introdução de dados',             '{typing,digitação}'),
  ('digital_office', 'Canva',                      'Canva',                           '{graphic design}'),
  ('technology',     'Python',                     'Python',                          '{}'),
  ('technology',     'JavaScript',                 'JavaScript',                      '{js,typescript}'),
  ('technology',     'SQL',                        'SQL',                             '{databases,bases de dados}'),
  ('technology',     'HTML and CSS',               'HTML e CSS',                      '{web design}'),
  ('technology',     'Java',                       'Java',                            '{}'),
  ('technology',     'PHP',                        'PHP',                             '{laravel}'),
  ('technology',     'Web development',            'Desenvolvimento web',             '{websites}'),
  ('technology',     'Mobile app development',     'Desenvolvimento de aplicações móveis', '{android,ios,flutter}'),
  ('technology',     'Data analysis',              'Análise de dados',                '{analytics}'),
  ('technology',     'Power BI',                   'Power BI',                        '{dashboards}'),
  ('technology',     'Computer networking',        'Redes de computadores',           '{networks,cisco}'),
  ('technology',     'Cybersecurity',              'Cibersegurança',                  '{security}'),
  ('technology',     'IT support',                 'Suporte informático',             '{helpdesk}'),
  ('technology',     'GIS (QGIS, ArcGIS)',         'SIG (QGIS, ArcGIS)',              '{gis,mapping}'),
  ('business',       'Accounting',                 'Contabilidade',                   '{}'),
  ('business',       'Bookkeeping',                'Escrituração',                    '{}'),
  ('business',       'Financial analysis',         'Análise financeira',              '{}'),
  ('business',       'Budgeting',                  'Orçamentação',                    '{}'),
  ('business',       'Auditing',                   'Auditoria',                       '{}'),
  ('business',       'Taxation (Mozambique)',      'Fiscalidade (Moçambique)',        '{tax,impostos,iva,irps,irpc}'),
  ('business',       'Primavera ERP',              'Primavera ERP',                   '{primavera}'),
  ('business',       'SAP',                        'SAP',                             '{}'),
  ('business',       'Procurement',                'Procurement',                     '{aquisições,compras}'),
  ('business',       'Inventory management',       'Gestão de stocks',                '{stock,armazém}'),
  ('business',       'Sales',                      'Vendas',                          '{}'),
  ('business',       'Marketing',                  'Marketing',                       '{}'),
  ('business',       'Digital marketing',          'Marketing digital',               '{seo}'),
  ('business',       'Social media management',    'Gestão de redes sociais',         '{facebook,instagram,tiktok}'),
  ('business',       'Customer service',           'Atendimento ao cliente',          '{}'),
  ('business',       'Project management',         'Gestão de projectos',             '{}'),
  ('business',       'Business analysis',          'Análise de negócio',              '{}'),
  ('languages',      'Portuguese',                 'Português',                       '{}'),
  ('languages',      'English',                    'Inglês',                          '{}'),
  ('languages',      'French',                     'Francês',                         '{}'),
  ('languages',      'Spanish',                    'Espanhol',                        '{}'),
  ('languages',      'Swahili',                    'Suaíli',                          '{kiswahili}'),
  ('languages',      'Emakhuwa',                   'Emakhuwa',                        '{macua,makhuwa}'),
  ('languages',      'Xichangana',                 'Xichangana',                      '{changana}'),
  ('languages',      'Cisena',                     'Cisena',                          '{sena}'),
  ('languages',      'Report writing',             'Redacção de relatórios',          '{}'),
  ('languages',      'Public speaking',            'Falar em público',                '{presentations}'),
  ('languages',      'Translation',                'Tradução',                        '{}'),
  ('technical',      'AutoCAD',                    'AutoCAD',                         '{cad,drafting}'),
  ('technical',      'Electrical installation',    'Instalações eléctricas',          '{}'),
  ('technical',      'Mechanical maintenance',     'Manutenção mecânica',             '{}'),
  ('technical',      'Welding',                    'Soldadura',                       '{}'),
  ('technical',      'Plumbing',                   'Canalização',                     '{}'),
  ('technical',      'Construction site supervision','Fiscalização de obras',         '{}'),
  ('technical',      'Health, safety and environment (HSE)', 'Higiene, segurança e ambiente (HSA)', '{hse,safety}'),
  ('technical',      'Laboratory techniques',      'Técnicas laboratoriais',          '{lab}'),
  ('technical',      'Surveying',                  'Topografia',                      '{}'),
  ('professional',   'Teamwork',                   'Trabalho em equipa',              '{}'),
  ('professional',   'Leadership',                 'Liderança',                       '{}'),
  ('professional',   'Problem solving',            'Resolução de problemas',          '{}'),
  ('professional',   'Time management',            'Gestão do tempo',                 '{}'),
  ('professional',   'Critical thinking',          'Pensamento crítico',              '{}'),
  ('professional',   'Adaptability',               'Adaptabilidade',                  '{}'),
  ('professional',   'Negotiation',                'Negociação',                      '{}'),
  ('professional',   'Research',                   'Pesquisa',                        '{}')
) as v(category_code, name_en, name_pt, aliases)
join public.skill_categories c on c.code = v.category_code;

-- ---------------------------------------------------------------------------
-- Industries
-- ---------------------------------------------------------------------------
insert into public.industries (code, name_en, name_pt, sort_order) values
  ('agriculture',      'Agriculture, Agribusiness and Fisheries', 'Agricultura, Agronegócio e Pescas', 1),
  ('banking',          'Banking and Financial Services',          'Banca e Serviços Financeiros',      2),
  ('insurance',        'Insurance',                               'Seguros',                           3),
  ('consulting',       'Consulting and Professional Services',    'Consultoria e Serviços Profissionais', 4),
  ('construction',     'Construction and Real Estate',            'Construção e Imobiliário',          5),
  ('education',        'Education',                               'Educação',                          6),
  ('energy',           'Energy (Oil, Gas and Power)',             'Energia (Petróleo, Gás e Electricidade)', 7),
  ('mining',           'Mining and Natural Resources',            'Mineração e Recursos Naturais',     8),
  ('government',       'Government and Public Sector',            'Governo e Sector Público',          9),
  ('health',           'Healthcare and Pharmaceuticals',          'Saúde e Farmacêutica',              10),
  ('hospitality',      'Hospitality and Tourism',                 'Hotelaria e Turismo',               11),
  ('ict',              'ICT and Telecommunications',              'TIC e Telecomunicações',            12),
  ('logistics',        'Logistics, Transport and Ports',          'Logística, Transportes e Portos',   13),
  ('manufacturing',    'Manufacturing',                           'Indústria Transformadora',          14),
  ('media',            'Media and Communications',                'Media e Comunicação',               15),
  ('ngo',              'NGOs and International Development',      'ONG e Cooperação Internacional',    16),
  ('retail',           'Retail and Consumer Goods',               'Comércio e Bens de Consumo',        17),
  ('legal',            'Legal Services',                          'Serviços Jurídicos',                18),
  ('other',            'Other',                                   'Outro',                             99);

-- ---------------------------------------------------------------------------
-- Job functions
-- ---------------------------------------------------------------------------
insert into public.job_functions (code, name_en, name_pt, sort_order) values
  ('finance',          'Accounting and Finance',             'Contabilidade e Finanças',       1),
  ('administration',   'Administration and Office Support',  'Administração e Apoio',          2),
  ('customer_service', 'Customer Service',                   'Atendimento ao Cliente',         3),
  ('data',             'Data and Analytics',                 'Dados e Análise',                4),
  ('engineering',      'Engineering',                        'Engenharia',                     5),
  ('hr',               'Human Resources',                    'Recursos Humanos',               6),
  ('it',               'IT and Software Development',        'Informática e Desenvolvimento',  7),
  ('legal',            'Legal and Compliance',               'Jurídico e Conformidade',        8),
  ('supply_chain',     'Logistics and Supply Chain',         'Logística e Cadeia de Abastecimento', 9),
  ('marketing',        'Marketing and Communications',       'Marketing e Comunicação',        10),
  ('operations',       'Operations',                         'Operações',                      11),
  ('procurement',      'Procurement',                        'Procurement',                    12),
  ('project_mgmt',     'Project Management',                 'Gestão de Projectos',            13),
  ('research',         'Research',                           'Investigação',                   14),
  ('sales',            'Sales and Business Development',     'Vendas e Desenvolvimento de Negócio', 15),
  ('hse',              'Health, Safety and Environment',     'Higiene, Segurança e Ambiente',  16),
  ('teaching',         'Teaching and Training',              'Ensino e Formação',              17),
  ('healthcare',       'Healthcare',                         'Saúde',                          18),
  ('other',            'Other',                              'Outro',                          99);
