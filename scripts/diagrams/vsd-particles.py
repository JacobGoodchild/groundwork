import math,sys
modes=[(-0.62,0.05,0.36,1.0),(0.62,-0.02,0.33,1.1),(0.05,0.55,0.3,0.25)]
def f(x,y):
    s=sum(w*math.exp(-((x-mx)**2+(y-my)**2*1.5)/(2*sd*sd)) for mx,my,sd,w in modes)
    return s*(1+0.07*math.sin(3*x+2*y)+0.05*math.cos(4*y-x))
def curve(cx,cy,lev,n=140,rmax=2.4):
    pts=[]
    for i in range(n):
        th=2*math.pi*i/n; dx,dy=math.cos(th),math.sin(th); lo,hi=0.0,rmax
        r=0.0
        while r<rmax and f(cx+dx*(r+0.01),cy+dy*(r+0.01))>lev: r+=0.01
        lo,hi=r,r+0.01
        for _ in range(20):
            m=(lo+hi)/2
            if f(cx+dx*m,cy+dy*m)>lev: lo=m
            else: hi=m
        pts.append((cx+dx*lo,cy+dy*lo))
    return pts
W,H=360,250; S=105; ox,oy=W/2,H/2
P=lambda p:f"{ox+p[0]*S:.1f},{oy+p[1]*S:.1f}"
saddle=f(0,0.03)
levels=[l for l in (0.03*1.22**k for k in range(24)) if l<1.0 and (l<0.85*saddle or l>1.08*saddle)]
paths=[]
for i,l in enumerate(levels):
    t=i/(len(levels)-1); col=f"rgb({int(40+t*205)},{int(110+t*115)},{int(205-t*125)})"
    for c in ([(0,0.05)] if l<saddle else [m[:2] for m in modes[:2]]):
        paths.append(f'<path d="M{" L".join(P(p) for p in curve(*c,l))}Z" stroke="{col}"/>')
parts=[]
for (x,y) in [(-1.3,-0.5),(-1.15,0.4),(-0.55,0.75),(-0.05,-0.8),(0.05,0.3),(0.6,-0.78),(1.1,-0.45),(1.35,0.15),(1.25,0.6),(0.75,0.65),(0.35,0.12),(-0.3,-0.25)]:
    e=1e-3
    gx=(math.log(f(x+e,y))-math.log(f(x-e,y)))/(2*e); gy=(math.log(f(x,y+e))-math.log(f(x,y-e)))/(2*e)
    n=math.hypot(gx,gy) or 1; L=0.24
    parts.append(f'<line x1="{ox+x*S:.1f}" y1="{oy+y*S:.1f}" x2="{ox+(x+gx/n*L)*S:.1f}" y2="{oy+(y+gy/n*L)*S:.1f}" stroke="#222" stroke-width="1.6" marker-end="url(#h)"/><circle cx="{ox+x*S:.1f}" cy="{oy+y*S:.1f}" r="5.5" fill="#e2412b" stroke="#9e2616"/>')
glow="".join(f'<ellipse cx="{ox+m[0]*S:.0f}" cy="{oy+m[1]*S:.0f}" rx="40" ry="30" fill="url(#g)"/>' for m in modes[:2])
print(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><defs><marker id="h" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#222"/></marker><radialGradient id="g"><stop offset="0" stop-color="#fff3a0"/><stop offset="1" stop-color="#fff3a0" stop-opacity="0"/></radialGradient></defs>{glow}<g fill="none" stroke-width="1.2">{"".join(paths)}</g>{"".join(parts)}</svg>''')
