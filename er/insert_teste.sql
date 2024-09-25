-- Inserção do modelo 3D (estatua)
INSERT INTO ng.catalago_3d (
    name, description, thumbnail, url, lon, lat, height, 
    heading, pitch, roll, type, municipio, estado, palavras_chave
) VALUES (
    'Estátua do Duque de Caxias', 
    'Modelo 3D de uma estátua localizada em um ponto específico',
    '/thumbnails/estatua.jpg',
    '3d/estatua.glb',
    -44.4481491, -22.4546061, 424.7,
    164, -2, -1,
    'Modelos 3D',
    'Resende', 'Rio de Janeiro',
    ARRAY['estátua', 'duque de caxias', 'aman', 'agulhas negras']
);

-- Inserção do tile AMAN
INSERT INTO ng.catalago_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightOffset, maximumScreenSpaceError, municipio, estado, palavras_chave
) VALUES (
    'AMAN', 
    'Modelo 3D em tiles da Academia Militar das Agulhas Negras',
    '/thumbnails/aman.jpg',
    '/3d/AMAN/tileset.json',
    -44.449655, -22.455921, 2200,
    'Tiles 3D',
    50,
    16.0,
    'Resende', 'Rio de Janeiro',
    ARRAY['aman', 'academia militar', 'agulhas negras']
);

-- Inserção do tile ESA
INSERT INTO ng.catalago_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightOffset, maximumScreenSpaceError, municipio, estado, palavras_chave
) VALUES (
    'ESA', 
    'Modelo 3D em tiles da Escola de Sargentos das Armas',
    '/thumbnails/esa.jpg', 
    '/3d/Model_0/tileset.json',
    -45.25666459926732, -21.703613735103637, 1500,
    'Tiles 3D',
    75,
    2.0,
    'Três Corações', 'Minas Gerais',
    ARRAY['esa', 'escola de sargentos']
);

-- Inserção do tile PCL
INSERT INTO ng.catalago_3d (
    name, description, thumbnail, url, lon, lat, height, 
    type, heightOffset, maximumScreenSpaceError, municipio, estado, palavras_chave
) VALUES (
    'PCL', 
    'Modelo 3D em tiles do PCL/AMAN',
    '/thumbnails/pcl.jpg',
    '/3d/PCL/tileset.json',
    -44.47332385414955, -22.43976556982974, 1000,
    'Tiles 3D',
    35,
    16.0,
    'Resende', 'Rio de Janeiro',
    ARRAY['pcl', 'aman', 'agulhas negras']
);