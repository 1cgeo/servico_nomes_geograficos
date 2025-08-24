#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from osgeo import gdal, osr
from PIL import Image
import base64
import uuid
import os
import tempfile
import io

app = Flask(__name__)
CORS(app)

def process_image(base64_data):
    """Decodifica base64 e retorna PIL Image"""
    try:
        image_data = base64_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        return image
    except Exception as e:
        raise Exception(f"Erro ao processar imagem: {str(e)}")

def calculate_geotransform(bounds, width, height):
    """Calcula GeoTransform para GDAL"""
    min_x = bounds['topLeft'][1]     # longitude esquerda
    max_y = bounds['topLeft'][0]     # latitude superior
    max_x = bounds['bottomRight'][1] # longitude direita
    min_y = bounds['bottomRight'][0] # latitude inferior
    
    pixel_width = (max_x - min_x) / width
    pixel_height = (max_y - min_y) / height
    
    return [min_x, pixel_width, 0, max_y, 0, -pixel_height]

def create_georeferenced_pdf(image_data, bounds, orientation):
    """Cria PDF georreferenciado usando GDAL"""
    
    temp_id = str(uuid.uuid4())[:8]
    temp_dir = tempfile.gettempdir()
    
    image_path = os.path.join(temp_dir, f"img_{temp_id}.png")
    pdf_path = os.path.join(temp_dir, f"pdf_{temp_id}.pdf")
    
    try:
        # 1. Processar imagem
        image = process_image(image_data)
        image.save(image_path, 'PNG')
        
        # 2. Abrir com GDAL
        dataset = gdal.Open(image_path)
        if not dataset:
            raise Exception("Erro ao abrir imagem com GDAL")
        
        width = dataset.RasterXSize
        height = dataset.RasterYSize
        bands = dataset.RasterCount
        
        # 3. Calcular GeoTransform
        geo_transform = calculate_geotransform(bounds, width, height)
        
        # 4. Opções do PDF
        pdf_options = [
            'COMPRESS=DEFLATE',
            'DPI=300',
            'GEOREF_SOURCES=NEATLINE',
            'GEO_ENCODING=ISO32000'
        ]
        
        # 5. Criar PDF dataset
        pdf_driver = gdal.GetDriverByName('PDF')
        if not pdf_driver:
            raise Exception("Driver PDF não disponível no GDAL")
        
        pdf_dataset = pdf_driver.Create(
            pdf_path, width, height, bands, gdal.GDT_Byte, pdf_options
        )
        
        # 6. Configurar projeção WGS84
        srs = osr.SpatialReference()
        srs.ImportFromEPSG(4326)
        pdf_dataset.SetProjection(srs.ExportToWkt())
        pdf_dataset.SetGeoTransform(geo_transform)
        
        # 7. Copiar dados das bandas
        for band_num in range(1, bands + 1):
            src_band = dataset.GetRasterBand(band_num)
            dst_band = pdf_dataset.GetRasterBand(band_num)
            data = src_band.ReadAsArray()
            dst_band.WriteArray(data)
        
        # 8. Finalizar
        pdf_dataset.FlushCache()
        pdf_dataset = None
        dataset = None
        
        # Cleanup imagem temporária
        try:
            os.unlink(image_path)
        except:
            pass
        
        return pdf_path
        
    except Exception as e:
        # Cleanup em caso de erro
        for path in [image_path, pdf_path]:
            try:
                if os.path.exists(path):
                    os.unlink(path)
            except:
                pass
        raise e

@app.route('/api/export-georeferenced-pdf', methods=['POST'])
def export_pdf():
    try:
        data = request.get_json()
        
        # Validação básica
        required_fields = ['image', 'bounds', 'orientation']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Campo {field} obrigatório'}), 400
        
        # Validar bounds
        bounds = data['bounds']
        required_bounds = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
        for bound in required_bounds:
            if bound not in bounds or len(bounds[bound]) != 2:
                return jsonify({'error': f'Bound {bound} inválido'}), 400
        
        # Validar orientação
        if data['orientation'] not in ['landscape', 'portrait']:
            return jsonify({'error': 'Orientação deve ser landscape ou portrait'}), 400
        
        print(f"Gerando PDF - Orientação: {data['orientation']}")
        
        # Gerar PDF
        pdf_path = create_georeferenced_pdf(
            data['image'],
            data['bounds'], 
            data['orientation']
        )
        
        # Enviar arquivo
        filename = f"mapa-georeferenciado-{uuid.uuid4().hex[:8]}.pdf"
        
        return send_file(
            pdf_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"Erro: {str(e)}")
        return jsonify({
            'error': 'Erro ao gerar PDF',
            'details': str(e)
        }), 500

@app.route('/api/export-georeferenced-pdf/status', methods=['GET'])
def status():
    """Endpoint para testar se GDAL está funcionando"""
    try:
        gdal_version = gdal.VersionInfo()
        pdf_driver = gdal.GetDriverByName('PDF')
        
        return jsonify({
            'status': 'ok',
            'gdal_version': gdal_version,
            'pdf_support': pdf_driver is not None,
            'message': 'Servidor PDF funcionando'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("🐍 Servidor PDF Georreferenciado iniciando...")
    print("📍 URL: http://localhost:3001")
    print("🔧 Status: http://localhost:3001/api/export-georeferenced-pdf/status")
    
    app.run(
        host='0.0.0.0',
        port=3001,
        debug=True
    )