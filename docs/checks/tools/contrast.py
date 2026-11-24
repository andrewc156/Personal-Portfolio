def lin(c):
    c/=255; return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def L(h):
    h=h.lstrip('#'); r,g,b=(int(h[i:i+2],16) for i in (0,2,4)); return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def cr(a,b):
    x,y=sorted([L(a),L(b)],reverse=True); return (x+0.05)/(y+0.05)
T={'light':dict(bg='#f7f4ee',surface='#fdfbf7',sunken='#efeae1',text='#1c1b19',muted='#5c574f',control='#8a8378',accent='#0b4f7a',hover='#083d5f',soft='#dce8f0',onacc='#ffffff',focus='#0b4f7a',border='#d9d2c5'),
   'dark':dict(bg='#111315',surface='#1a1d20',sunken='#0b0c0e',text='#e8e5df',muted='#a7a298',control='#7d786f',accent='#73b6e6',hover='#9dcbee',soft='#183247',onacc='#0c1114',focus='#73b6e6',border='#33373c')}
pairs=[('text','bg',4.5),('text','surface',4.5),('text','sunken',4.5),('muted','bg',4.5),('muted','surface',4.5),('accent','bg',4.5),('accent','surface',4.5),('hover','bg',4.5),('text','soft',4.5),('onacc','accent',4.5),('control','bg',3),('control','surface',3),('focus','bg',3),('focus','surface',3),('accent','soft',3),('text','bg',3)]
for th,t in T.items():
    for a,b,m in pairs:
        v=cr(t[a],t[b]); print(f"{th:5} {a:8} on {b:8} {v:5.2f} need {m} {'OK' if v>=m else 'FAIL'}")
