"""Génère sample_images.xlsx : un classeur minimal avec des images ancrées sur des lignes et des RR stockés comme heures par Excel."""
import zipfile, base64
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
def s(r, c, v): return f'<c r="{c}{r}" t="inlineStr"><is><t>{v}</t></is></c>'
def n(r, c, v): return f'<c r="{c}{r}"><v>{v}</v></c>'
head = ''.join(s(1, c, h) for c, h in zip('ABCDEFGHIJK', ['Date','Paire','Scénario','Sens','Timeframe de confirmation','Résultat','Règles respectées ?','Référence / repère du graphique','Notes','RR prévu','Pips gagnés']))
r2 = n(2,'A',46317)+s(2,'B','GBPUSD')+s(2,'D','Vente')+s(2,'F','Gagnant')+n(2,'J',0.04236111111111111)+n(2,'K',32)
r3 = n(3,'A',46318)+s(3,'B','EURUSD')+s(3,'D','Achat')+s(3,'F','Perdant')+n(3,'J',0.0007118055555555556)
r4 = n(4,'A',46319)+s(4,'B','USDJPY')+s(4,'F','Gagnant')+n(4,'J',0.5)
sheet = f'<?xml version="1.0" encoding="UTF-8"?><worksheet {NS}><sheetData><row r="1">{head}</row><row r="2">{r2}</row><row r="3">{r3}</row><row r="4">{r4}</row></sheetData><drawing r:id="rId1"/></worksheet>'
def anchor(fr, to, rid):
    return (f'<xdr:twoCellAnchor><xdr:from><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>{fr}</xdr:row><xdr:rowOff>400000</xdr:rowOff></xdr:from>'
            f'<xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>{to}</xdr:row><xdr:rowOff>1500000</xdr:rowOff></xdr:to>'
            f'<xdr:pic><xdr:blipFill><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" r:embed="{rid}"/></xdr:blipFill></xdr:pic></xdr:twoCellAnchor>')
# image 1 déborde sur l'en-tête (de la ligne 1 à la ligne 2) ; image 2 sur la ligne 3 ; la ligne 4 n'a pas d'image
drawing = ('<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" '
           'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + anchor(0, 1, 'rId1') + anchor(2, 2, 'rId2') + '</xdr:wsDr>')
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
with zipfile.ZipFile('sample_images.xlsx', 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('xl/workbook.xml', f'<?xml version="1.0"?><workbook {NS}><sheets><sheet name="Backtesting" sheetId="1" r:id="rId1"/></sheets></workbook>')
    z.writestr('xl/_rels/workbook.xml.rels', f'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
    z.writestr('xl/worksheets/sheet1.xml', sheet)
    z.writestr('xl/worksheets/_rels/sheet1.xml.rels', f'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{R}/drawing" Target="../drawings/drawing1.xml"/></Relationships>')
    z.writestr('xl/drawings/drawing1.xml', drawing)
    z.writestr('xl/drawings/_rels/drawing1.xml.rels', f'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{R}/image" Target="../media/image1.png"/><Relationship Id="rId2" Type="{R}/image" Target="../media/image2.png"/></Relationships>')
    z.writestr('xl/media/image1.png', PNG)
    z.writestr('xl/media/image2.png', PNG + b'\x00')
