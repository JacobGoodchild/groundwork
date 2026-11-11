import math,random
random.seed(7)
COL={'C':('#d9d3c3','#8d877a'),'N':('#2f6fe4','#1b3f8a'),'O':('#e0312b','#8a1b17'),'H':('#ffffff','#9a9a9a')}
def atoms_svg(atoms,bonds,cx,cy,scale):
    out=[]
    for a,b in bonds:
        (x1,y1,_),(x2,y2,_)=atoms[a],atoms[b]
        out.append(f'<line x1="{cx+x1*scale:.1f}" y1="{cy+y1*scale:.1f}" x2="{cx+x2*scale:.1f}" y2="{cy+y2*scale:.1f}" stroke="#bbb" stroke-width="2.4"/>')
    for x,y,e in sorted(atoms,key=lambda t:t[1]):
        r={'H':3.6,'C':5.4,'N':5.4,'O':5.4}[e]*scale/12
        f,s=COL[e]
        out.append(f'<circle cx="{cx+x*scale:.1f}" cy="{cy+y*scale:.1f}" r="{r:.1f}" fill="{f}" stroke="{s}" stroke-width="0.8"/>')
    return ''.join(out)
# final molecule: a six-ring with substituents
ring=[(math.cos(math.pi/6+k*math.pi/3)*1.2,math.sin(math.pi/6+k*math.pi/3)*1.2) for k in range(6)]
final=[(x,y,e) for (x,y),e in zip(ring,['C','N','C','C','N','C'])]
final+=[(2.3,-0.6,'N'),(-2.3,0.7,'C'),(-3.1,1.6,'O'),(0,-2.4,'H'),(2.9,-1.5,'H'),(2.9,0.3,'H'),(-2.6,-0.3,'H'),(0,2.4,'H'),(-1.2,2.0,'H')]
fb=[(i,(i+1)%6) for i in range(6)]+[(0,6),(3,7),(7,8),(4,9),(6,10),(6,11),(7,12),(1,13),(2,14)]
tiles=[]
n=len(final)
for k in range(5):
    t=k/4  # 0 = noise, 1 = final
    atoms=[]
    for (x,y,e) in final:
        nx,ny=random.uniform(-2.6,2.6),random.uniform(-2.6,2.6)
        atoms.append((nx*(1-t)+x*t,ny*(1-t)+y*t,e))
    bonds=fb if k>=3 else ([b for b in fb if random.random()<0.4] if k==2 else [])
    tiles.append((atoms,bonds))
W=1000
s=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} 400" font-family="Times New Roman, Times, serif">',
'<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#222"/></marker><marker id="b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#13a3e0"/></marker></defs>']
def tile(x,y,w,content):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{w}" rx="{w*0.14:.0f}" fill="#3a3a3a"/>'+content
# top-left box
s.append('<rect x="200" y="6" width="310" height="186" rx="16" fill="none" stroke="#555" stroke-dasharray="4 4"/>')
small=tiles[4]
s.append(tile(240,16,62,atoms_svg(*small,271,47,7)))
rot=[(x*math.cos(1.1)-y*math.sin(1.1),x*math.sin(1.1)+y*math.cos(1.1),e) for x,y,e in small[0]]
s.append(tile(400,16,62,atoms_svg(rot,small[1],431,47,7)))
s.append('<line x1="320" y1="50" x2="380" y2="50" stroke="#222" stroke-width="1.5" marker-end="url(#a)"/><path d="M342 38 a8 8 0 1 1 14 4" fill="none" stroke="#222" stroke-width="1.2" marker-end="url(#a)"/><text x="350" y="72" font-size="20" font-style="italic" text-anchor="middle">R</text>')
for x in (271,431):
    s.append(f'<line x1="{x-6}" y1="80" x2="{x-6}" y2="104" stroke="#222" marker-end="url(#a)"/>')
    s.append(f'<rect x="{x-44}" y="106" width="88" height="30" rx="4" fill="#b8f0a8" stroke="#3cb43c" stroke-width="1.5"/><text x="{x}" y="128" font-size="22" font-style="italic" text-anchor="middle">E</text>')
    s.append(f'<line x1="{x}" y1="136" x2="{x}" y2="152" stroke="#222" marker-end="url(#a)"/>')
# condition line
s.append('<polyline points="600,94 290,94 290,104" fill="none" stroke="#222" stroke-width="1.3" marker-end="url(#a)"/><line x1="448" y1="94" x2="448" y2="104" stroke="#222" stroke-width="1.3" marker-end="url(#a)"/>')
s.append('<text x="555" y="86" font-size="15" text-anchor="middle">Condition <tspan font-style="italic">c</tspan></text>')
s.append('<text x="355" y="178" font-size="21" text-anchor="middle" fill="#333"><tspan font-style="italic">E</tspan>(<tspan font-weight="bold" font-style="italic">z</tspan>, <tspan font-style="italic">c</tspan>, <tspan font-style="italic">t</tspan>)  =  <tspan font-style="italic">E</tspan>(<tspan font-style="italic">R</tspan><tspan font-weight="bold" font-style="italic">z</tspan>, <tspan font-style="italic">c</tspan>, <tspan font-style="italic">t</tspan>)</text>')
s.append('<text x="355" y="215" font-size="21" font-weight="bold" text-anchor="middle">Invariant Energy</text>')
# top-right box
s.append('<rect x="600" y="6" width="330" height="186" rx="16" fill="none" stroke="#555" stroke-dasharray="4 4"/>')
pent=[(645+18*math.cos(-math.pi/2+k*2*math.pi/5+math.pi),40+18*math.sin(-math.pi/2+k*2*math.pi/5+math.pi)) for k in range(5)]
s.append('<polygon points="'+' '.join(f'{x:.1f},{y:.1f}' for x,y in pent)+'" fill="none" stroke="#333" stroke-width="1.4"/>')
s.append('<text x="645" y="62" font-size="13" text-anchor="middle" fill="#333">N</text>')
s.append('<polyline points="672,58 692,44 712,58 732,46" fill="none" stroke="#333" stroke-width="1.4"/><line x1="752" y1="40" x2="752" y2="60" stroke="#333" stroke-width="1.4"/><text x="752" y="34" font-size="13" text-anchor="middle">O</text>')
for i in range(8):
    fill={0:'#7ee06a',6:'#e8d27a'}.get(i,'#cfe9ef')
    s.append(f'<rect x="{632+i*17}" y="110" width="17" height="17" fill="{fill}" stroke="#555" stroke-width="0.8"/>')
s.append('<line x1="640" y1="70" x2="640" y2="106" stroke="#222" marker-end="url(#a)"/><line x1="690" y1="74" x2="742" y2="108" stroke="#222" marker-end="url(#a)"/><line x1="752" y1="70" x2="700" y2="108" stroke="#222" marker-end="url(#a)"/>')
s.append('<text x="700" y="156" font-size="15" fill="#d58a2e" text-anchor="middle">Target Structure</text><text x="700" y="174" font-size="15" fill="#d58a2e" text-anchor="middle">as Fingerprint</text>')
for y,t in [(40,'Polarizability <tspan font-style="italic">α</tspan>'),(66,'Dipole Moment <tspan font-style="italic">μ</tspan>'),(92,'⋮'),(122,'Heat Capacity <tspan font-style="italic">C</tspan><tspan font-size="11" dy="4" font-style="italic">v</tspan>')]:
    s.append(f'<text x="{855}" y="{y}" font-size="16" text-anchor="middle">{t}</text>')
s.append('<text x="855" y="170" font-size="15" fill="#d58a2e" text-anchor="middle">Quantum Property</text>')
# bottom row
xs=[60+k*190 for k in range(5)]
for k,x in enumerate(xs):
    s.append(tile(x,262,124,atoms_svg(*tiles[k],x+62,262+62,12)))
    if k<4:
        s.append(f'<line x1="{x+136}" y1="324" x2="{x+178}" y2="324" stroke="#222" stroke-width="1.8" marker-end="url(#a)"/>')
# guidance lines
s.append(f'<polyline points="355,222 355,234" fill="none" stroke="#13a3e0" stroke-width="2.5"/><line x1="{xs[0]+136+21}" y1="234" x2="{xs[3]+157}" y2="234" stroke="#13a3e0" stroke-width="2.5"/>')
for k in range(4):
    x=xs[k]+157
    s.append(f'<line x1="{x}" y1="234" x2="{x}" y2="306" stroke="#13a3e0" stroke-width="2.5" marker-end="url(#b)"/>')
s.append('</svg>')
print(''.join(s))
