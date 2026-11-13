"""Original articulated fantasy cast. Pillow only; no external artwork."""
from PIL import Image, ImageDraw, ImageFont
import json
import math
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / 'dist/assets/sprites'
W, H, S = 128, 160, 3
STATES = ['idle', 'walk', 'attack', 'hit', 'death', 'victory', 'special', 'guard']
TYPES = ['p', 'n', 'b', 'r', 'q', 'k']
NAMES = dict(zip(TYPES, ['PION', 'CAVALIER', 'FOU', 'TOUR', 'DAME', 'ROI']))
ACCENTS = dict(zip(TYPES, ['#7ad5ad', '#76c9f1', '#9ca0ff', '#f2b368', '#f49ac5', '#ffe39b']))


def sprite(color, kind, state, frame):
    im = Image.new('RGBA', (W*S, H*S))
    d = ImageDraw.Draw(im)
    t, wave = frame/7, math.sin(frame*math.pi/4)
    # Anticipation, contact at frame 4, follow-through, recovery.
    strike = [0, -.20, -.35, .10, 1, .82, .40, 0][frame] if state == 'attack' else 0
    guard = math.sin(t*math.pi) if state == 'guard' else 0
    recoil = math.sin(t*math.pi) if state == 'hit' else 0
    lift = math.sin(t*math.pi) if state in ['victory', 'special'] else 0
    stride = wave if state == 'walk' else 0
    bob = wave*(1.1 if state == 'idle' else 2) if state in ['idle', 'walk'] else 0
    dx, dy = strike*4-recoil*7, bob-lift*3
    ink, gold = '#142132', '#eac47c' if color == 'w' else '#d6b684'
    armor, shade, shine = ('#f1ead8', '#a1b8bd', '#fff9e9') if color == 'w' else ('#59657f', '#303b56', '#b1c5dd')
    cloth, fold = ('#26675e', '#163d43') if color == 'w' else ('#693f70', '#362848')
    accent, skin = ACCENTS[kind], '#e9c2a0' if color == 'w' else '#b5a5bd'

    def pts(points): return [((x+dx)*S, (y+dy)*S) for x, y in points]

    def poly(points, fill, outline=ink, width=1.5):
        p = pts(points)
        d.polygon(p, fill=fill)
        if outline: d.line(p+[p[0]], fill=outline, width=round(width*S), joint='curve')

    def line(points, fill=gold, width=2): d.line(pts(points), fill=fill, width=round(width*S), joint='curve')

    def ellipse(box, fill, outline=None, width=1.5):
        d.ellipse(((box[0]+dx)*S, (box[1]+dy)*S, (box[2]+dx)*S, (box[3]+dy)*S), fill=fill, outline=outline, width=round(width*S))

    def gem(x, y, size=4):
        poly([(x,y-size),(x+size,y),(x,y+size),(x-size,y)], accent, gold, 1)
        line([(x-1,y-1),(x,y-2)], '#ffffff', 1)

    def cape(left, top, right, bottom):
        sway = stride*4-strike*6
        poly([(left,top),(right,top),(right+8+sway,bottom),((left+right)/2,bottom-7),(left-9+sway,bottom+1)], cloth)
        line([(left+4,top+4),(left-3+sway,bottom-9)], gold, 1.6)
        line([(right-5,top+13),(right+sway,bottom-10)], fold, 4)

    def boot(x,y,step=0,width=9):
        poly([(x-width,y-26),(x+width-2,y-26),(x+width-1+step,y-3),(x+width+5+step,y+3),(x-width-2+step,y+3)],shade)
        line([(x-width+2+step,y-4),(x+width-2+step,y-4)],gold,2)

    def shield(x,y,size=1):
        poly([(x-15*size,y-17*size),(x+10*size,y-21*size),(x+17*size,y-8*size),(x+10*size,y+15*size),(x,y+25*size),(x-15*size,y+12*size)],gold)
        poly([(x-11*size,y-14*size),(x+8*size,y-17*size),(x+12*size,y-7*size),(x+7*size,y+12*size),(x,y+20*size),(x-11*size,y+10*size)],cloth)
        gem(x,y,5*size)

    def crown(y,royal=False):
        if royal:
            poly([(44,y+16),(41,y),(51,y+6),(59,y-3),(69,y+6),(80,y),(76,y+16)],gold)
            line([(60,y-14),(60,y+2)],gold,4)
            line([(54,y-9),(66,y-9)],gold,4)
        else:
            poly([(42,y+18),(34,y-2),(48,y+6),(48,y-8),(59,y+3),(67,y-11),(72,y+6),(88,y-4),(78,y+18)],gold)
            for x,yy in [(34,y-2),(48,y-8),(67,y-11),(88,y-4)]: ellipse((x-2,yy-2,x+2,yy+2),accent,ink,1)
        gem(61,y+12)

    if kind == 'p':
        # Infantry: small round helmet, round shield, short tunic, spear.
        cape(40,76,67,128)
        boot(49,139,stride*5,7); boot(68,138,-stride*5,7)
        poly([(40,75),(69,75),(76,110),(65,121),(41,116)],armor)
        poly([(56,79),(69,79),(72,108),(57,115)],shade,None)
        line([(40,110),(70,113)],gold,4)
        ellipse((38,39,74,76),shade,ink); ellipse((42,46,72,74),skin,ink)
        ellipse((37,36,76,65),armor,ink)
        poly([(37,56),(76,56),(77,63),(36,63)],gold)
        poly([(48,37),(49,29),(63,30),(69,41)],cloth)
        line([(48,65),(66,65)],ink,3)
        hx,hy = 80+strike*5,91-strike*7
        line([(69,82),(hx,hy)],shade,11); ellipse((hx-4,hy-3,hx+4,hy+5),gold,ink)
        tx,ty = 89+strike*27,37+strike*42
        line([(hx-6,133-strike*23),(tx,ty+10)],'#a97c50',4)
        poly([(tx-5,ty+13),(tx,ty-4),(tx+5,ty+13)],shine)
        sx,sy = 35+guard*13,97-guard*9
        ellipse((sx-19,sy-21,sx+19,sy+21),gold,ink,2)
        ellipse((sx-15,sy-17,sx+15,sy+17),cloth,shine,1); gem(sx,sy,6)
    elif kind == 'n':
        # Horse-led silhouette, barding and animated hooves.
        rear = max(0,strike)*10+guard*7
        for x,phase in [(29,1),(43,-1),(78,-1),(94,1)]:
            step = stride*7*phase
            poly([(x-5,116),(x+5,115),(x+4+step,141-rear*(x>70)),(x+9+step,147-rear*(x>70)),(x-7+step,147-rear*(x>70))],shade)
            line([(x-4+step,145-rear*(x>70)),(x+8+step,145-rear*(x>70))],gold,3)
        poly([(23,98),(43,88),(83,91),(98,106),(86,126),(35,126),(21,115)],armor)
        poly([(25,101),(58,98),(70,126),(34,129)],cloth)
        line([(28,104),(54,102),(62,121),(37,124)],gold,2)
        poly([(76,105),(76,78-rear),(87,61-rear),(88,48-rear),(96,58-rear),(105,62-rear),(120,81-rear),(117,91-rear),(101,88-rear),(94,113)],armor)
        poly([(78,89-rear),(75,68-rear),(86,55-rear),(88,49-rear),(90,67-rear)],cloth)
        line([(88,69-rear),(103,81-rear),(117,83-rear)],gold,3); ellipse((101,66-rear,105,70-rear),ink)
        line([(23,101),(15,107),(10,126)],fold,5)
        cape(40,56,63,96)
        poly([(39,57),(67,54),(74,84),(58,101),(38,88)],armor)
        line([(48,88),(66,94),(64,115)],shade,9); line([(59,115),(70,115)],gold,3)
        poly([(41,31),(45,21),(64,18),(73,30),(69,52),(58,60),(42,48)],armor)
        poly([(60,25),(72,31),(69,50),(60,55)],shade,None); line([(45,37),(67,35)],ink,4)
        poly([(48,22),(44,12),(57,8),(77,14),(82,28),(67,20)],accent)
        shield(35+guard*7,75-guard*8,.68)
        line([(70,71),(80,82-strike*8)],shade,9)
        line([(78-strike*6,119-strike*31),(90+strike*26,14+strike*48)],gold,4)
        poly([(85+strike*26,25+strike*48),(90+strike*26,8+strike*48),(95+strike*26,25+strike*48)],shine)
    elif kind == 'b':
        # Split mitre, long robe, floating sleeves, luminous staff.
        cape(36,65,72,139)
        sway = stride*5
        poly([(44,65),(68,65),(83+sway,141),(60,135),(30+sway,143)],cloth)
        poly([(54,73),(63,73),(70+sway,136),(49+sway,137)],armor)
        line([(58,78),(59+sway,131)],gold,2); gem(60,102,5)
        ellipse((45,40,71,68),skin,ink)
        poly([(38,54),(39,34),(56,7),(62,7),(77,33),(78,54),(61,47)],cloth)
        line([(57,12),(67,25),(57,40)],gold,3); line([(39,48),(59,43),(77,48)],gold,3)
        line([(50,56),(65,56)],ink,2)
        hx,hy = 81+strike*17,80-strike*8
        poly([(68,70),(80,71),(hx+5,hy+13),(hx-5,hy+17)],cloth)
        line([(hx,hy+9),(hx+5,hy+6)],skin,7)
        line([(93,48),(94,138)],gold,4); ellipse((82,27,105,53),gold,ink)
        ellipse((85,29,102,49),accent,shine); gem(94,39,5)
        poly([(44,70),(35,76),(26,105),(46,109),(52,80)],cloth); line([(30,103),(42,106)],gold,3)
        if state in ['attack','guard','special']:
            r = 6+max(0,strike)*5+guard*9
            ellipse((hx-r,hy-r-3,hx+r,hy+r-3),accent,shine,2)
    elif kind == 'r':
        # Wide stone golem: battlements, block limbs, articulated maul.
        for x,step in [(43,stride*4),(80,-stride*4)]:
            poly([(x-13,104),(x+12,104),(x+14+step,138),(x-16+step,138)],shade,ink,2)
            line([(x-10+step,133),(x+10+step,133)],gold,3)
        poly([(27,61),(91,61),(97,110),(77,123),(41,121),(22,108)],armor,ink,2)
        poly([(61,65),(91,64),(94,108),(77,118),(61,115)],shade,None)
        line([(25,88),(94,88)],ink,2); line([(48,64),(46,87)],ink,2); line([(72,91),(75,117)],ink,2)
        poly([(32,61),(31,29),(30,18),(42,18),(42,30),(53,30),(53,16),(66,16),(66,30),(77,30),(77,18),(90,18),(88,61)],armor,ink,2)
        poly([(63,34),(87,34),(85,60),(63,61)],shade,None)
        line([(34,36),(85,36)],gold,3); line([(43,48),(55,48)],ink,4); line([(67,48),(79,48)],ink,4)
        line([(58,57),(65,57)],gold,3); gem(59,83,8)
        poly([(17+guard*4,70),(29,64),(36,88),(28,106),(10,99)],shade); line([(15,86),(28,84)],gold,3)
        hx,hy = 99+strike*5,91-strike*6
        line([(92,74),(hx,hy)],shade,14); line([(hx-1,hy-29),(hx,hy+36)],gold,6)
        poly([(hx-18,hy-51+strike*15),(hx+13,hy-51+strike*15),(hx+17,hy-25+strike*15),(hx-16,hy-25+strike*15)],shade,ink,2)
        line([(hx-13,hy-46+strike*15),(hx+10,hy-46+strike*15)],shine,4); gem(hx,hy-36+strike*15,4)
    elif kind == 'q':
        # Five-point crown, hourglass robe, crescent staff and orbiting jewels.
        cape(36,65,75,137)
        sway = stride*5+guard*5
        poly([(46,68),(69,68),(65,97),(85+sway,141),(58,134),(30+sway,142),(49,96)],cloth)
        poly([(50,70),(64,70),(60,95),(72+sway,135),(57,131),(42+sway,136),(55,94)],armor)
        line([(45,96),(66,96)],gold,4); gem(58,86,5)
        poly([(43,40),(51,32),(70,34),(78,47),(73,76),(65,70),(48,75),(40,60)],fold)
        ellipse((48,37,71,67),skin,ink); line([(52,51),(58,52)],ink,2); line([(64,52),(69,50)],ink,2)
        crown(21)
        hx,hy = 84+strike*13,85-strike*22
        poly([(68,69),(77,72),(hx+4,hy+12),(hx-8,hy+16)],cloth); line([(hx-3,hy+9),(hx+4,hy+6)],skin,6)
        line([(96,49),(95,138)],gold,3); ellipse((83,23,110,51),gold,ink); ellipse((88,21,111,43),fold); gem(96,39,5)
        line([(43,76),(31,90),(35,102)],cloth,10); gem(33,99,5)
        if state in ['attack','special','guard']:
            for i in range(3):
                a = t*math.pi*2+i*math.pi*2/3
                gem(61+math.cos(a)*43,75+math.sin(a)*29,3)
    else:
        # King: cross crown, fur mantle, broad shield, heavy sword.
        cape(28,62,80,139)
        boot(45,140,stride*4,10); boot(72,140,-stride*4,10)
        poly([(34,66),(80,66),(85,106),(72,120),(39,115)],armor)
        poly([(62,68),(80,68),(81,104),(68,114),(61,111)],shade,None)
        poly([(27,61),(45,59),(59,72),(77,59),(88,65),(80,80),(61,77),(43,80),(29,75)],shine)
        for x in [33,40,48,70,78,84]: ellipse((x-2,68,x+1,71),gold)
        line([(37,108),(78,108)],gold,5); gem(62,90,6)
        ellipse((44,34,77,66),skin,ink)
        poly([(47,53),(56,58),(64,57),(73,50),(70,69),(60,76),(48,66)],shade)
        line([(48,47),(56,49)],ink,2); line([(64,49),(72,47)],ink,2); crown(24,True)
        shield(30+guard*15,96-guard*12,1.05)
        hx,hy = 89+strike*8,91-strike*5-lift*27
        line([(79,76),(hx,hy)],shade,12)
        tx,ty = hx+strike*19,hy-57+strike*40
        poly([(hx-4,hy),(tx-5,ty+9),(tx,ty-4),(tx+5,ty+9),(hx+4,hy)],shine)
        line([(hx,hy),(tx,ty+5)],shade,1); line([(hx-12,hy+1),(hx+12,hy+1)],gold,4)
        line([(hx,hy+5),(hx,hy+19)],fold,5); gem(hx,hy+20,3)
    if state == 'special':
        for i in range(5):
            a = t*math.pi*2+i*math.pi*2/5
            gem(61+math.cos(a)*45,86+math.sin(a)*36,2)
    if state == 'death':
        angle = {'p':-76,'n':-26,'b':12,'r':-9,'q':-24,'k':-57}[kind]
        im = im.rotate(angle*t,resample=Image.Resampling.BICUBIC,center=(64*S,126*S))
        if kind in ['b','q']: im = im.transform(im.size,Image.Transform.AFFINE,(1,0,0,0,1+t*.2,-t*12*S))
        im.putalpha(im.getchannel('A').point(lambda v:round(v*max(0,1-max(0,t-.4)/.6))))
    return im.resize((W,H),Image.Resampling.LANCZOS)


def main():
    ROOT.mkdir(parents=True,exist_ok=True)
    for color in ['w','b']:
        for kind in TYPES:
            sheet = Image.new('RGBA',(W*8,H*len(STATES)))
            for row,state in enumerate(STATES):
                for frame in range(8): sheet.alpha_composite(sprite(color,kind,state,frame),(frame*W,row*H))
            sheet.save(ROOT/f'{color}{kind}.png',optimize=True)
    meta = {'frameWidth':W,'frameHeight':H,'columns':8,'anchor':{'x':.5,'y':.9},
            'artStatus':'Original articulated fantasy sprites with six distinct class silhouettes.',
            'animations':{state:{'row':i,'frames':8,'frameDuration':110 if state=='idle' else 85,
                'loop':state in ['idle','walk','guard'],'events':{'4':'impact'} if state=='attack' else {}}
                for i,state in enumerate(STATES)}}
    (ROOT/'atlas.json').write_text(json.dumps(meta,indent=2)+'\n')
    preview = Image.new('RGB',(W*6,380),'#182321'); draw = ImageDraw.Draw(preview)
    font = ImageFont.load_default(size=12)
    for row,color in enumerate(['w','b']):
        for col,kind in enumerate(TYPES):
            tile = sprite(color,kind,'idle',0); preview.paste(tile,(col*W,row*190),tile)
            draw.text((col*W+W/2,row*190+165),NAMES[kind],fill=ACCENTS[kind],font=font,anchor='mt')
    preview.save(PROJECT/'sprite-preview.png')
    print('12 original sheets: 8 states × 8 frames; contact sheet updated.')


if __name__ == '__main__': main()
