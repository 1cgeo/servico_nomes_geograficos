-- Inserção do modelo 3D (estatua)
INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, heightoffset,
    heading, pitch, roll, type, municipio, estado, palavras_chave
) VALUES (
    'Estátua do Duque de Caxias', 
    'Modelo 3D de uma estátua localizada em um ponto específico',
    '/estatua/thumbnail.png',
    '/estatua/estatua.glb',
    -44.44815069, -22.45461579, 374.6,
    30,
    164, 0.5, 0.5,
    'Modelos 3D',
    'Resende', 'Rio de Janeiro',
    ARRAY['estátua', 'duque de caxias', 'aman', 'agulhas negras']
);

-- Inserção do tile AMAN
INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'AMAN', 
    'Modelo 3D em tiles da Academia Militar das Agulhas Negras',
    '/aman/thumbnail.png',
    '/aman/tileset.json',
    -44.449655, -22.455921, 2200,
    'Tiles 3D',
    50,
    16.0,
    'Resende', 'Rio de Janeiro',
    ARRAY['aman', 'academia militar', 'agulhas negras']
);

-- Inserção do tile ESA
INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'ESA', 
    'Modelo 3D em tiles da Escola de Sargentos das Armas',
    '/esa/thumbnail.png', 
    '/esa/tileset.json',
    -45.25666459926732, -21.703613735103637, 1500,
    'Tiles 3D',
    75,
    2.0,
    'Três Corações', 'Minas Gerais',
    ARRAY['esa', 'escola de sargentos']
);

-- Inserção do tile PCL
INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'PCL', 
    'Modelo 3D em tiles do PCL/AMAN',
    '/pcl/thumbnail.png',
    '/pcl/tileset.json',
    -44.47332385414955, -22.43976556982974, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Resende', 'Rio de Janeiro',
    ARRAY['pcl', 'aman', 'agulhas negras']
);


INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'EXPOEx', 
    'Modelo 3D em tiles da Região da EXPOEx no Parque de Exposições Assis Brasil',
    '/expoex/thumbnail.png',
    '/expoex/tileset.json',
    -51.1819601,-29.8555187, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Esteio', 'Rio Grande do Sul',
    ARRAY['Expointer']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Santa Tereza', 
    'Modelo 3D em tiles da Região de Santa Tereza afetada pelas enchentes de maio de 2024',
    '/santa-tereza/thumbnail.png',
    '/santa-tereza/tileset.json',
    -51.735423440934206, -29.172627292860327,  1000,
    'Tiles 3D',
    0,
    16.0,
    'Santa Tereza', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Muçum', 
    'Modelo 3D em tiles da Região de Muçum afetada pelas enchentes de maio de 2024',
    '/mucum/thumbnail.png',
    '/mucum/tileset.json',
    -51.87051260777422, -29.166837165726406, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Muçum', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Roca Sales', 
    'Modelo 3D em tiles da Região de Roca Sales afetada pelas enchentes de maio de 2024',
    '/roca-sales/thumbnail.png',
    '/roca-sales/tileset.json',
    -51.880902752339786, -29.284650148971576, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Roca Sales', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Arroio do Meio', 
    'Modelo 3D em tiles da Região de Arroio do Meio afetada pelas enchentes de maio de 2024',
    '/arroio-do-meio/thumbnail.png',
    '/arroio-do-meio/tileset.json',
    -51.94302093562379, -29.402908542612245, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Arroio do Meio', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Lajeado', 
    'Modelo 3D em tiles da Região de Lajeado afetada pelas enchentes de maio de 2024',
    '/lajeado/thumbnail.png',
    '/lajeado/tileset.json',
    -51.963585309510755, -29.468893479165846, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Lajeado', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Estrela', 
    'Modelo 3D em tiles da Região de Estrela afetada pelas enchentes de maio de 2024',
    '/estrela-merge/thumbnail.png',
    '/estrela-merge/tileset.json',
    -51.95899413146255, -29.473797198870912, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Estrela', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Cruzeiro do Sul', 
    'Modelo 3D em tiles da Região de Cruzeiro do Sul afetada pelas enchentes de maio de 2024',
    '/cruzeiro-do-sul/thumbnail.png',
    '/cruzeiro-do-sul/tileset.json',
    -51.984399374677594, -29.51332092981287, 1000,
    'Tiles 3D',
    0,
    2.0,
    'Cruzeiro do Sul', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Bom Retiro do Sul', 
    'Modelo 3D em tiles da Região de Bom Retiro do Sul afetada pelas enchentes de maio de 2024',
    '/bom-retiro-do-sul/thumbnail.png',
    '/bom-retiro-do-sul/tileset.json',
    -51.943428437067645, -29.607153616620362, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Bom Retiro do Sul', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Colinas', 
    'Modelo 3D em tiles da Região de Colinas afetada pelas enchentes de maio de 2024',
    '/colinas/thumbnail.png',
    '/colinas/tileset.json',
    -51.87268457683399, -29.385153073885824, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Colinas', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Encantado', 
    'Modelo 3D em tiles da Região de Encantado afetada pelas enchentes de maio de 2024',
    '/encantado/thumbnail.png',
    '/encantado/tileset.json',
    -51.8587166195042, -29.229346235086567, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Encantado', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Auditorio 1º CGEO', 
    'Modelo 3D em tiles do auditório do 1º CGEO',
    '/auditorio-1cgeo/thumbnail.png',
    '/auditorio-1cgeo/tileset.json',
    -51.219544297545646, -30.067747144201228, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['1CGEO', '1º CGEO', '1º Centro de Geoinformação', '1ª DL', 'CCGB']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Pavilhão de Comando do 1º CGEO', 
    'Modelo 3D em tiles do pavilhão de comando do 1º CGEO',
    '/predio-comando-1cgeo/thumbnail.png',
    '/predio-comando-1cgeo/tileset.json',
    -51.220535040823975, -30.06715964469566, 1000,
    'Tiles 3D',
    0,
    16.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['1CGEO', '1º CGEO', '1º Centro de Geoinformação', '1ª DL', 'CCGB']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Centro de Adestramento Sul', 
    'Modelo 3D em tiles do Centro de Adestramento Sul',
    '/ca-sul/thumbnail.png',
    '/ca-sul/tileset.json',
    -53.84556781353387, -29.73566000369945, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Santa Maria', 'Rio Grande do Sul',
    ARRAY['CA-SUL', 'SIMACEM']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '4º Batalhão Logístico', 
    'Modelo 3D em tiles do 4º Batalhão Logístico',
    '/4blog/thumbnail.png',
    '/4blog/tileset.json',
    -53.8500754298179, -29.719992364759964, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Santa Maria', 'Rio Grande do Sul',
    ARRAY['4BLog']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '1º Regimento de Carros de Combate', 
    'Modelo 3D em tiles do 1º Regimento de Carros de Combate',
    '/1rcc/thumbnail.png',
    '/1rcc/tileset.json',
    -53.8496936257103, -29.71498606008087, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Santa Maria', 'Rio Grande do Sul',
    ARRAY['1RCC']
);

INSERT INTO  ng.catalogo_3d(
        name,
        description,
        municipio,
        estado,
        thumbnail,
        palavras_chave,
        url,
        type,
        style
)
VALUES
(
        'ESAO',
        'Nuvem de pontos da Escola de Aperfeiçoamento de Oficiais',
        'Rio de Janeiro',
        'Rio de Janeiro',
        '/esao/thumbnail.png',
        '{esao,"escola de aperfeiçoamento de oficiais"}',
        '/esao/tileset.json',
        'Nuvem de Pontos',
        '{
                "color": {
                        "conditions": [
                               ["${POSITION}[2] < 7", "color(''lightgreen'')"],
                                ["${POSITION}[2] < 7.5", "color(''green'')"],
                                ["${POSITION}[2] < 8", "color(''yellowgreen'')"],
                                ["${POSITION}[2] < 8.5", "color(''yellow'')"],
                                ["${POSITION}[2] < 9", "color(''gold'')"],
                                ["${POSITION}[2] < 9.5", "color(''orange'')"],
                                ["${POSITION}[2] < 10", "color(''darkorange'')"],
                                ["${POSITION}[2] < 10.5", "color(''red'')"],
                                ["${POSITION}[2] < 11", "color(''white'')"],
                                ["true", "color(''violet'')"]

                        ]
                },
                "pointSize": 2
        }'::jsonb
);
 

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '3º Batalhão de Comunicações', 
    'Modelo 3D em tiles do 3º Batalhão de Comunicações',
    '/3bcom/thumbnail.png',
    '/3bcom/tileset.json',
    -51.21474144153603, -30.164513801781798, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['3BCom']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '8º Esquadrão de Cavalaria Mecanizado', 
    'Modelo 3D em tiles do 8º Esquadrão de Cavalaria Mecanizado',
    '/8esqdcmec/thumbnail.png',
    '/8esqdcmec/tileset.json',
    -51.22519137901395, -30.16414193474354, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['8EsqdCMec']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Colégio Militar de Porto Alegre', 
    'Modelo 3D em tiles do Colégio Militar de Porto Alegre',
    '/cmpa/thumbnail.png',
    '/cmpa/tileset.json',
    -51.21348839826647, -30.038776255632662, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['CMPA']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Policlínica Militar de Porto Alegre', 
    'Modelo 3D em tiles da Policlínica Militar de Porto Alegre',
    '/pmpa/thumbnail.png',
    '/pmpa/tileset.json',
    -51.219517270235016, -30.03771310615151, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['PMPA']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '18º Batalhão de Infantaria Motorizado', 
    'Modelo 3D em tiles do 18º Batalhão de Infantaria Motorizado',
    '/18bi/thumbnail.png',
    '/18bi/tileset.json',
    -51.140329353635465, -29.81349270679423, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['18BI']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '19º Batalhão de Infantaria Motorizado', 
    'Modelo 3D em tiles do 19º Batalhão de Infantaria Motorizado',
    '/19bi/thumbnail.png',
    '/19bi/tileset.json',
    -51.14699023740182, -29.777035526702182, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['19BI']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '3° Centro de Gestão, Contabilidade e Finanças do Exército', 
    'Modelo 3D em tiles do 3° Centro de Gestão, Contabilidade e Finanças do Exército',
    '/cgcfex/thumbnail.png',
    '/cgcfex/tileset.json',
    -51.22178079790531, -30.062676420863806, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['CGCFEx']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '3° Batalhão de Polícia do Exército', 
    'Modelo 3D em tiles do 3° Batalhão de Polícia do Exército',
    '/3bpe/thumbnail.png',
    '/3bpe/tileset.json',
    -51.22268381796232, -30.06392566523734, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['3BPE']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '3° Batalhão de Suprimento', 
    'Modelo 3D em tiles do 3° Batalhão de Suprimento',
    '/3bsup/thumbnail.png',
    '/3bsup/tileset.json',
    -51.2768643811893, -29.8917123986599, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['3BSup']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '6° Esquadrão de Cavalaria Mecanizado', 
    'Modelo 3D em tiles do 6° Esquadrão de Cavalaria Mecanizado',
    '/6esqdcmec/thumbnail.png',
    '/6esqdcmec/tileset.json',
    -53.8444734840243, -29.712557965801626, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['6EsqdCMec']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '29° Batalhão de Infantaria Blindado', 
    'Modelo 3D em tiles do 29° Batalhão de Infantaria Blindado',
    '/29bib/thumbnail.png',
    '/29bib/tileset.json',
    -53.84896554024129, -29.723712968862202, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['29BIB']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Centro de Instrução de Blindados', 
    'Modelo 3D em tiles do Centro de Instrução de Blindados',
    '/cibld/thumbnail.png',
    '/cibld/tileset.json',
    -53.84813500939526, -29.71764939938415, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Porto Alegre', 'Rio Grande do Sul',
    ARRAY['CIBld']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    '2ª Bateria de Artilharia Antiaérea', 
    'Modelo 3D em tiles da 2ª Bateria de Artilharia Antiaérea',
    '/2biaaae/thumbnail.png',
    '/2biaaae/tileset.json',
    -55.53557102538833, -30.883787195161897, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Sant''Ana do Livramento', 'Rio Grande do Sul',
    ARRAY['2BIAAAE', 'Op FOGO']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Ponte Rio Ibirapuitã com BR 377', 
    'Modelo 3D em tiles da Ponte Rio Ibirapuitã com BR 377',
    '/ponte377/thumbnail.png',
    '/ponte377/tileset.json',
    -55.78310517937053, -29.805494325391436, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Alegrete', 'Rio Grande do Sul',
    ARRAY['Ponte', 'Op FOGO']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Ponte Borges de Medeiros', 
    'Modelo 3D em tiles da Ponte Borges de Medeiros',
    '/ponte-borges-de-medeiros/thumbnail.png',
    '/ponte-borges-de-medeiros/tileset.json',
    -55.77453032939263, -29.784927041729613, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Alegrete', 'Rio Grande do Sul',
    ARRAY['Ponte', 'Op FOGO']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Ponte General Osório', 
    'Modelo 3D em tiles da Ponte General Osório',
    '/ponte-general-osorio/thumbnail.png',
    '/ponte-general-osorio/tileset.json',
    -55.4816627677828, -29.596464009914392, 1000,
    'Tiles 3D',
    0,
    1.0,
    'Manoel Viana', 'Rio Grande do Sul',
    ARRAY['Ponte', 'Op FOGO']
);
