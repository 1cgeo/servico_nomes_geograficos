-- Inserção do modelo 3D (estatua)
INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, heightoffset,
    heading, pitch, roll, type, municipio, estado, palavras_chave
) VALUES (
    'Estátua do Duque de Caxias', 
    'Modelo 3D de uma estátua localizada em um ponto específico',
    '/thumbnails/estatua.png',
    '/estatua/estatua.glb',
    -44.44815069, -22.45461579, 407.2,
    35,
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
    '/thumbnails/aman.png',
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
    '/thumbnails/pcl.png',
    '/pcl/tileset.json',
    -44.47332385414955, -22.43976556982974, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/expoex.png',
    '/expoex/tileset.json',
    -51.1819601,-29.8555187, 1000,
    'Tiles 3D',
    35,
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
    35,
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
    '/thumbnails/mucum.png',
    '/mucum/tileset.json',
    -51.87051260777422, -29.166837165726406, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/roca-sales.png',
    '/roca-sales/tileset.json',
    -51.880902752339786, -29.284650148971576, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/arroio-do-meio.png',
    '/arroio-do-meio/tileset.json',
    -51.94302093562379, -29.402908542612245, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/lajeado.png',
    '/lajeado/tileset.json',
    -51.963585309510755, -29.468893479165846, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/estrela.png',
    '/estrela/tileset.json',
    -51.95899413146255, -29.473797198870912, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/cruzeiro-do-sul.png',
    '/cruzeiro-do-sul/tileset.json',
    -51.984399374677594, -29.51332092981287, 1000,
    'Tiles 3D',
    35,
    2.0,
    'Cruzeiro do Sul', 'Rio Grande do Sul',
    ARRAY['Taquari', 'Operação', 'Enchente']
);

INSERT INTO ng.catalogo_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightoffset, maximumscreenspaceerror, municipio, estado, palavras_chave
) VALUES (
    'Auditorio 1º CGEO', 
    'Modelo 3D em tiles do auditório do 1º CGEO',
    '/thumbnails/auditorio_1cgeo.png',
    '/auditorio-1cgeo/tileset.json',
    -51.219544297545646, -30.067747144201228, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/pavilhao_1cgeo.png',
    '/predio-comando-1cgeo/tileset.json',
    -51.220535040823975, -30.06715964469566, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/ca-sul.png',
    '/ca-sul/tileset.json',
    -53.84556781353387, -29.73566000369945, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/4blog.png',
    '/4blog/tileset.json',
    -53.8500754298179, -29.719992364759964, 1000,
    'Tiles 3D',
    35,
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
    '/thumbnails/1rcc.png',
    '/1rcc/tileset.json',
    -53.8496936257103, -29.71498606008087, 1000,
    'Tiles 3D',
    35,
    1.0,
    'Santa Maria', 'Rio Grande do Sul',
    ARRAY['1RCC']
);
 