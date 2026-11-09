"""Génère un classeur de test SYNTHÉTIQUE (fausses données) au format du journal Excel.
Usage : python3 make_sample.py"""
import datetime as dt
import openpyxl

wb = openpyxl.Workbook()
r = wb.active; r.title = 'Résumé'
r['A1'] = 'Journal de test'
h = ['Date','Paire','Scénario','Sens','Timeframe de confirmation','Résultat','Règles respectées ?','Notes','RR prévu','Pips']
bt = wb.create_sheet('Backtesting'); bt.append(h)
bt.append([dt.datetime(2026,1,8),'GBPUSD','Scénario 1','Vente','5min BOS','Perdant','Oui','Test & <accents> é à',  '1:1', None])
bt.append([dt.datetime(2026,1,15),'GBPUSD','Scénario 2','Achat','15min BOS','Gagnant','OUI','Très bien','1:1.5', 44.5])
bt.append([None]*10)
bt.append([dt.datetime(2026,2,3),'EURUSD','Scénario 1','','Pas de confirmation','Perdant','Non','Sans confirmation','1:2', None])
re_ = wb.create_sheet('Réel'); re_.append(h)
re_.append([dt.datetime(2026,3,2),'USDJPY','Scénario 1','Achat','5min BOS','Gagnant','Oui','Réel gagnant',2, 32])
re_.append(['pas une date','USDJPY','Scénario 1','Achat','5min BOS','Gagnant','Oui','ligne cassée',2, 32])
wb.save('sample.xlsx')
print('ok')
