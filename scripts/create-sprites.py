"""Original vector-drawn, rasterized prototype artwork. No third-party sprites."""
from PIL import Image, ImageDraw
import math,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]/'dist/assets/sprites'
W,H,S=128,160,2
states=['idle','walk','attack','hit','death','victory','special']
for color in ['w','b']:
 for piece in ['p','n','b','r','q','k']:
  sheet=Image.new('RGBA',(W*8,H*7))
  for row,state in enumerate(states):
   for frame in range(8):
    im=Image.new('RGBA',(W*S,H*S));d=ImageDraw.Draw(im)
    t=frame/7;wave=math.sin(frame*math.pi/4)
    gold='#dfbb72' if color=='w' else '#c99d9f';metal='#e6e1cd' if color=='w' else '#77758a';mid='#9daca5' if color=='w' else '#454158';dark='#3c5050' if color=='w' else '#272331';cloth='#425f55' if color=='w' else '#673545';light='#f8f4d9' if color=='w' else '#b5a5b4';ink='#172526'
    y=wave*(1.4 if state=='idle' else 3) if state in ['idle','walk','victory'] else 0
    dx=14*math.sin(t*math.pi) if state=='attack' else -7*math.sin(t*math.pi) if state=='hit' else 0
    def poly(pts,fill,outline=ink,width=1):
     d.polygon([((x+dx)*S,(yy+y)*S) for x,yy in pts],fill=fill)
     if outline:d.line([((x+dx)*S,(yy+y)*S) for x,yy in pts+[pts[0]]],fill=outline,width=width*S)
    def line(pts,fill,width=1):d.line([((x+dx)*S,(yy+y)*S) for x,yy in pts],fill=fill,width=width*S)
    def ellipse(box,fill,outline=None):d.ellipse(tuple(v*S for v in (box[0]+dx,box[1]+y,box[2]+dx,box[3]+y)),fill,outline,width=S)
    ishorse=piece=='n';by=-13 if ishorse else 0
    # cape, legs, boots
    poly([(43,64+by),(75,64+by),(90,126+by),(64,119+by),(34,128+by)],cloth)
    line([(46,71+by),(42,115+by)],gold)
    step=7*wave if state=='walk' else 0
    for x,delta in [(52,step),(70,-step)]:
     poly([(x-7,99+by),(x+7,99+by),(x+6,130+by+delta),(x-5,130+by+delta)],mid)
     poly([(x-5,125+by+delta),(x+6,125+by+delta),(x+11,135+by+delta),(x-8,136+by+delta)],dark)
     line([(x-3,112+by),(x+4,112+by)],gold,2)
    # broad body, ornamental armor
    breadth=7 if piece=='r' else 0
    poly([(43-breadth,61+by),(73+breadth,61+by),(82+breadth,82+by),(73,106+by),(48,106+by),(35-breadth,81+by)],metal)
    poly([(61,63+by),(76+breadth,70+by),(73,101+by),(61,106+by)],mid)
    poly([(43,68+by),(59,74+by),(59,94+by),(46,87+by)],light,None)
    line([(61,67+by),(61,98+by)],gold,2);line([(46,100+by),(75,100+by)],gold,3)
    poly([(57,77+by),(61,72+by),(65,77+by),(61,84+by)],gold,None)
    for x in [38-breadth,77+breadth]:
     poly([(x-9,62+by),(x+8,59+by),(x+13,74+by),(x-7,78+by)],metal)
     line([(x-7,65+by),(x+6,63+by)],gold,2)
    # head, face, helmet
    ellipse((47,31+by,76,65+by),dark,ink)
    poly([(49,36+by),(69,32+by),(76,42+by),(72,58+by),(61,66+by),(49,57+by)],metal)
    poly([(62,34+by),(73,41+by),(70,60+by),(62,64+by)],mid)
    line([(50,47+by),(59,49+by)],ink,3);line([(65,49+by),(72,46+by)],ink,3)
    line([(61,44+by),(61,59+by)],gold,2)
    if piece=='p':
     poly([(47,40),(49,29),(61,23),(73,31),(77,40),(63,36)],metal)
     poly([(57,24),(57,18),(67,19),(67,26)],cloth)
    if piece in ['q','k']:
     poly([(47,36+by),(44,20+by),(54,27+by),(60,15+by),(67,27+by),(77,21+by),(73,37+by)],gold)
     ellipse((58,28+by,64,34+by),'#62bcb2' if color=='w' else '#d27da1')
     if piece=='k':line([(60,7),(60,19)],gold,3);line([(55,11),(65,11)],gold,3)
    if piece=='b':
     poly([(45,45),(48,29),(62,9),(76,29),(78,45),(64,36)],cloth)
     line([(62,16),(62,33)],gold,2)
    if piece=='r':
     poly([(44,39),(44,21),(52,21),(52,29),(60,29),(60,19),(67,19),(67,28),(74,28),(74,21),(81,21),(79,43)],metal)
     line([(48,35),(76,35)],gold,2)
    # weapon articulated per frame
    attack=math.sin(t*math.pi) if state=='attack' else 0
    wx=89+attack*17;wy=85-attack*36+by
    poly([(76,77+by),(87,81+by),(wx+5,wy+13),(wx-4,wy+16)],mid)
    if piece=='b':
     line([(wx,wy-37),(wx,wy+48)],gold,4)
     ellipse((wx-7,wy-47,wx+7,wy-33),'#90e6cb' if color=='w' else '#d48fe1',gold)
     if state in ['attack','special']:ellipse((wx-12,wy-52,wx+12,wy-28),(125,225,209,90))
    elif piece=='r':
     line([(wx,wy-21),(wx,wy+26)],gold,5)
     poly([(wx-16,wy-43),(wx+13,wy-43),(wx+18,wy-20),(wx-15,wy-18)],mid)
     line([(wx-12,wy-38),(wx+9,wy-38)],metal,4)
    else:
     endx=wx+attack*14;endy=wy-(70 if piece=='n' else 47)
     poly([(wx-3,wy),(endx-3,endy+8),(endx,endy),(endx+4,endy+8),(wx+3,wy)],light)
     line([(wx-9,wy+2),(wx+10,wy+2)],gold,3);line([(wx,wy+4),(wx,wy+15)],dark,4)
    # shield
    if piece in ['p','k','n']:
     poly([(27,78+by),(43,72+by),(52,82+by),(48,106+by),(35,115+by),(23,100+by)],gold)
     poly([(29,81+by),(42,77+by),(47,84+by),(44,103+by),(35,109+by),(28,98+by)],cloth)
     line([(36,84+by),(37,101+by)],gold,2);line([(31,90+by),(43,90+by)],gold,2)
    if ishorse:
     # barded horse in three-quarter view
     poly([(32,101),(75,95),(87,109),(79,132),(34,134),(22,121)],mid)
     for x in [29,42,69,80]:
      off=wave*4 if state=='walk' and x%2 else -wave*4 if state=='walk' else 0
      poly([(x-3,125),(x+4,125),(x+4+off,148),(x-5+off,149)],dark)
     poly([(71,108),(74,81),(83,68),(88,56),(94,66),(99,70),(107,87),(101,95),(89,90),(87,116)],metal)
     line([(82,74),(88,91),(102,91)],gold,2);ellipse((92,74,95,77),ink)
     poly([(27,105),(64,102),(66,128),(38,129)],cloth);line([(30,109),(60,107),(60,124),(38,125)],gold,2)
    if state=='victory':
     for i in range(4):ellipse((28+i*19,12+5*wave,30+i*19,15+5*wave),gold)
    if state=='death':
     im=im.rotate(-t*82,resample=Image.Resampling.BICUBIC,center=(64*S,125*S))
     im.putalpha(im.getchannel('A').point(lambda v:int(v*(1-max(0,t-.65)*2))))
    sheet.alpha_composite(im.resize((W,H),Image.Resampling.LANCZOS),(frame*W,row*H))
  sheet.save(ROOT/f'{color}{piece}.png',optimize=True)
meta={'frameWidth':W,'frameHeight':H,'columns':8,'anchor':{'x':.5,'y':.9},'artStatus':'Original procedural prototype sprites; illustrated HD replacement remains an art-production task.','animations':{s:{'row':i,'frames':8,'frameDuration':110 if s=='idle' else 85,'loop':s in ['idle','walk'],'events':{'4':'impact'} if s=='attack' else {}} for i,s in enumerate(states)}}
(ROOT/'atlas.json').write_text(json.dumps(meta,indent=2))
print('12 original PNG sheets, 672 nonempty animation frames created.')
