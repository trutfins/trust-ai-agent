from PIL import Image, ImageDraw, ImageFont
W='/tmp/claude-0/work/'
LA=lambda w: W+f'plex-la-{w}.ttf'
MONO='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
def ink(im, box, bg, thr=90):
    px=im.load(); x0,y0,x1,y1=box; xs=[];ys=[];cols=[]
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            p=px[x,y]; dd=sum(abs(a-b) for a,b in zip(p,bg))
            if dd>thr: xs.append(x); ys.append(y); cols.append((dd,p))
    cols.sort(reverse=True)
    return (min(xs),min(ys),max(xs),max(ys)), cols[0][1]
def fit(font_path, digit_h):
    for s in range(6,60):
        f=ImageFont.truetype(font_path,s); l,t,r,b=f.getbbox('0123456789')
        if b-t>=digit_h: return f
    return f
def replace(im, box, text, font_path, align='left', bgpt=None, pad=2, size=None, color=None):
    px=im.load(); x0,y0,x1,y1=box
    bg=px[bgpt] if bgpt else px[x0-pad-2, y0]
    (ix0,iy0,ix1,iy1),col=ink(im,box,bg)
    # digit height: use top of ink to baseline (exclude comma tail ~ 2px)
    f=ImageFont.truetype(font_path,size) if size else fit(font_path, iy1-iy0-2 if ',' in text else iy1-iy0)
    col=color or col
    d=ImageDraw.Draw(im)
    d.rectangle((ix0-pad,iy0-pad,ix1+pad,iy1+pad),fill=bg)
    l,t,r,b=d.textbbox((0,0),text,font=f)
    ref=f.getbbox('0'); y=iy0-ref[1] if not size else (iy0+iy1)//2-(ref[1]+ref[3])//2
    x=ix0-l if align=='left' else ix1-(r-l)-l
    d.text((x,y),text,font=f,fill=col)
    return im
r1=Image.open(W+'report/r1.png').convert('RGB')
for (sx0,sx1),box,t in [((439,449),(458,228,566,258),'2,474,441'),((1044,1053),(1062,228,1167,258),'2,359,741'),((1648,1656),(1667,228,1771,258),'779,410')]:
    sh=r1.crop((sx0-1,228,sx1+2,259)).copy(); bgc=r1.getpixel((box[0]+40,box[1]-8))
    ImageDraw.Draw(r1).rectangle((sx0-2,229,sx1+3,258),fill=bgc)
    replace(r1,box,t,LA(700),bgpt=(box[0]+40,box[1]-8),align='right',size=23)
    # find new number left edge and paste shekel sign 8px before it
    f=ImageFont.truetype(LA(700),23); l,t,r,bb=f.getbbox(t); left=box[2]-(r-l)
    r1.paste(sh,(left-8-sh.width,228))
r1.save(W+'report/r1s.png')
r2=Image.open(W+'report/r2.png').convert('RGB')
replace(r2,(866,207,896,222),'3.0M',LA(400),align='right',size=12)
replace(r2,(866,310,896,325),'1.5M',LA(400),align='right',size=12)
for box,t in [((960,339,1002,357),'323K'),((1110,342,1152,360),'298K'),((1262,260,1308,276),'779K')]:
    replace(r2,box,t,LA(600),bgpt=(box[0]+1,box[3]+3),size=12,color=(31,150,145))
r2.save(W+'report/r2s.png')
r3=Image.open(W+'report/r3.png').convert('RGB')
for box,t in [((260,148,324,166),'121,080'),((260,201,325,219),'386,939'),((260,255,325,273),'196,533'),
              ((958,148,1022,166),'312,130'),((958,201,1041,219),'2,162,311'),((958,255,1041,273),'2,474,441')]:
    replace(r3,box,t,MONO,size=15)
for box,t in [((416,327,468,344),'121,080'),((292,327,343,344),'196,533'),((511,352,574,369),'1,381,500'),((418,352,482,369),'1,498,498')]:
    replace(r3,box,t,LA(400),size=14,align='right')
for box,t in [((893,345,940,363),'444,142'),((1152,345,1210,363),'1,713,630'),((1288,374,1319,393),'4,540')]:
    replace(r3,box,t,LA(400),size=13,align='right',color=(108,118,130))
r3.save(W+'report/r3s.png')
print('ok')
