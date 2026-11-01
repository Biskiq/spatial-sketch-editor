import json,sys
sp='/private/tmp/claude-501/-Users-tony--claude-spares-spare-vozA9r/0d25f1f1-a1f7-4efb-9320-b95e11b2138a/scratchpad/flicker/'
out={}
for m in ['axis','common']:
    rows=json.loads(json.loads(open(sp+f'fade-{sys.argv[1]}-{m}.raw').read()))
    table=[]
    for r in rows:
        x,z=r['xBands'],r['zBands']; tot=sum(x)+sum(z)
        single=sum(a+b for a,b in zip(x,z) if (a+b)>0 and min(a,b)<0.1*max(a,b))
        table.append(dict(T=r['T'],el=r['el'],az=round(r['az'],2),singleDirPct=round(100*single/max(1,tot),1),xOverZ=r['xOverZ'],l1=r['l1'],l5=r['l5'],l25=r['l25'],depthLossPct=r['depthLossPct']))
    out[m]=table
    print('==',sys.argv[1],m)
    for t in table: print('  ',t)
json.dump(out,open(sp+f'fade-{sys.argv[1]}.json','w'),indent=1)
